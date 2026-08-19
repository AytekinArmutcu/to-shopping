import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { listItems, products } from '@/db/schema';
import { DEFAULT_UNIT, isUnit, type Unit } from '@/db/units';

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
