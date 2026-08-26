import { and, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { listItems, lists, products, purchaseHistory } from '@/db/schema';
import { DEFAULT_UNIT, isUnit, type Unit } from '@/db/units';

import { idsToAdd } from '@/features/catalog/logic';

import { buildHistoryDrafts, idsToRemoveOnFinish } from './logic';

/**
 * Datenzugriff fuer Listeneintraege.
 *
 * Zentral hier: Der Produktname wird als Kopie in die Zeile geschrieben
 * (ADR-007). Ein spaeter geloeschtes oder umbenanntes Produkt laesst den
 * Eintrag dadurch unberuehrt.
 */

function newId(): string {
  return `i-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export type AddItemInput = {
  listId: string;
  name: string;
  productId?: string | null;
  categoryId?: string | null;
  quantity?: number;
  unit?: Unit | string;
};

export async function addItem(input: AddItemInput): Promise<string> {
  const id = newId();

  const [{ value: count } = { value: 0 }] = await db
    .select({ value: sql<number>`count(*)` })
    .from(listItems)
    .where(eq(listItems.listId, input.listId));

  await db.insert(listItems).values({
    id,
    listId: input.listId,
    productId: input.productId ?? null,
    name: input.name,
    categoryId: input.categoryId ?? null,
    quantity: input.quantity ?? 1,
    unit: input.unit && isUnit(String(input.unit)) ? String(input.unit) : DEFAULT_UNIT,
    position: count,
  });

  return id;
}

/**
 * Setzt ein Katalogprodukt auf die Liste und uebernimmt dabei Kategorie und
 * Standardeinheit als Kopie.
 */
export async function addProductToList(listId: string, productId: string): Promise<string | null> {
  const found = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  const product = found[0];

  if (!product) {
    return null;
  }

  return addItem({
    listId,
    name: product.name,
    productId: product.id,
    categoryId: product.categoryId,
    unit: product.defaultUnit,
  });
}

export async function removeItem(id: string): Promise<void> {
  await db.delete(listItems).where(eq(listItems.id, id));
}

export async function clearList(listId: string): Promise<void> {
  await db.delete(listItems).where(eq(listItems.listId, listId));
}

/** Produkt-IDs der offenen Eintraege - Grundlage fuer das Ausblenden in der Suche. */
export async function getOpenProductIds(listId: string): Promise<string[]> {
  const rows = await db
    .select({ productId: listItems.productId })
    .from(listItems)
    .where(and(eq(listItems.listId, listId), eq(listItems.isChecked, false)));

  return rows
    .map((row) => row.productId)
    .filter((productId): productId is string => productId !== null);
}

/** Hakt einen Artikel ab oder nimmt das Haken zurueck (FR-3.1, FR-3.3). */
export async function setItemChecked(id: string, isChecked: boolean): Promise<void> {
  await db
    .update(listItems)
    .set({ isChecked, checkedAt: isChecked ? Date.now() : null })
    .where(eq(listItems.id, id));
}

/**
 * Schliesst den Einkauf ab (FR-3.8): Abgehaktes wandert in die Historie und
 * verschwindet von der Liste, Liegengebliebenes bleibt stehen.
 *
 * Alles in einer Transaktion (CLAUDE.md). Ohne sie koennte ein Abbruch
 * zwischen Schreiben und Loeschen entweder Historie ohne Loeschung erzeugen
 * (Artikel taucht doppelt in der Statistik auf) oder Loeschung ohne Historie
 * (der Einkauf verschwindet spurlos).
 *
 * Rueckgabe: Anzahl der uebernommenen Artikel - die Oberflaeche meldet sie.
 */
export async function finishShopping(listId: string, now: number = Date.now()): Promise<number> {
  const rows = await db.select().from(listItems).where(eq(listItems.listId, listId));

  const drafts = buildHistoryDrafts(rows, now);
  const removeIds = idsToRemoveOnFinish(rows);

  if (removeIds.length === 0) {
    return 0;
  }

  await db.transaction(async (tx) => {
    await tx.insert(purchaseHistory).values(
      drafts.map((draft, index) => ({
        id: `h-${now.toString(36)}-${index}`,
        ...draft,
      })),
    );
    await tx.delete(listItems).where(inArray(listItems.id, removeIds));
    await tx.update(lists).set({ lastOpenedAt: now }).where(eq(lists.id, listId));
  });

  return removeIds.length;
}

/**
 * Abfrage der Artikel einer Liste - als Bauplan, nicht als Ergebnis.
 *
 * useLiveQuery braucht die Abfrage selbst, um sie bei jeder Aenderung erneut
 * auszufuehren; ein fertiges Promise waere nur eine Momentaufnahme. Deshalb
 * liefert diese Funktion den Drizzle-Bauplan. Der Screen bekommt so trotzdem
 * keine Tabellen und keine Bedingungen zu sehen (CLAUDE.md, Schichtenregel 1).
 */
export function listItemsQuery(listId: string) {
  return db
    .select()
    .from(listItems)
    .where(eq(listItems.listId, listId))
    .orderBy(listItems.position);
}

export type ItemDetails = {
  quantity: number;
  unit: Unit | string;
  note: string | null;
};

/** Speichert Menge, Einheit und Notiz eines Artikels (FR-2.4, FR-2.5). */
export async function updateItemDetails(id: string, details: ItemDetails): Promise<void> {
  await db
    .update(listItems)
    .set({
      quantity: details.quantity,
      unit: isUnit(String(details.unit)) ? String(details.unit) : DEFAULT_UNIT,
      note: details.note,
    })
    .where(eq(listItems.id, id));
}

/**
 * Setzt mehrere Katalogprodukte auf einmal auf die Liste (FR-2.3, T-4.4).
 *
 * In einer Transaktion, weil aus einer Auswahl ein Vorgang wird: Entweder die
 * ganze Auswahl landet auf der Liste oder keiner ihrer Artikel. Ein halb
 * uebernommener Katalogbesuch waere fuer den Nutzer nicht erkennbar.
 *
 * Die Doppelt-Pruefung passiert hier und nicht im Screen: Zwischen dem Oeffnen
 * des Katalogs und dem Uebernehmen kann sich die Liste geaendert haben.
 *
 * Rueckgabe: Anzahl der tatsaechlich eingefuegten Artikel.
 */
export async function addProductsToList(listId: string, productIds: string[]): Promise<number> {
  if (productIds.length === 0) {
    return 0;
  }

  const onList = await getOpenProductIds(listId);
  const wanted = idsToAdd(productIds, onList);

  if (wanted.length === 0) {
    return 0;
  }

  const found = await db.select().from(products).where(inArray(products.id, wanted));
  const byId = new Map(found.map((product) => [product.id, product]));

  const [{ value: count } = { value: 0 }] = await db
    .select({ value: sql<number>`count(*)` })
    .from(listItems)
    .where(eq(listItems.listId, listId));

  const rows = wanted
    .map((id) => byId.get(id))
    .filter((product): product is (typeof found)[number] => product !== undefined)
    .map((product, index) => ({
      id: `${newId()}-${index}`,
      listId,
      productId: product.id,
      name: product.name,
      categoryId: product.categoryId,
      unit: isUnit(product.defaultUnit) ? product.defaultUnit : DEFAULT_UNIT,
      position: count + index,
    }));

  if (rows.length === 0) {
    return 0;
  }

  await db.transaction(async (tx) => {
    await tx.insert(listItems).values(rows);
  });

  return rows.length;
}
