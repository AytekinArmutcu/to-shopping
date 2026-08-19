import { and, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { listItems, lists, products, purchaseHistory } from '@/db/schema';
import { DEFAULT_UNIT, isUnit, type Unit } from '@/db/units';

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
