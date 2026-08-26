import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { categories, listCategoryOrder, listItems, lists, products } from '@/db/schema';

import { buildSharedList, planImport, type SharedItem, type SharedListFile } from './logic';

/**
 * Datenzugriff fuers Teilen und Empfangen.
 *
 * Alles Entscheidende steckt in logic.ts und ist dort getestet; hier stehen
 * nur die Lese- und Schreibvorgaenge.
 */

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Packt eine Liste in das Teilen-Format (FR-6.1).
 *
 * Nur **offene** Artikel wandern mit: Was abgehakt ist, liegt bereits im
 * Wagen. Wer eine Liste weitergibt, meint das, was noch zu holen ist - eine
 * Kopie inklusive erledigter Posten waere fuer den Empfaenger irrefuehrend.
 *
 * Kategorien reisen als Name, nicht als ID (architecture.md 5.1).
 */
export async function buildSharedListForList(listId: string): Promise<SharedListFile | null> {
  const found = await db.select().from(lists).where(eq(lists.id, listId)).limit(1);
  const list = found[0];

  if (!list) {
    return null;
  }

  const categoryRows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories);
  const nameById = new Map(categoryRows.map((category) => [category.id, category.name]));

  const rows = await db
    .select()
    .from(listItems)
    .where(and(eq(listItems.listId, listId), eq(listItems.isChecked, false)))
    .orderBy(asc(listItems.position));

  const items: SharedItem[] = rows.map((row) => ({
    name: row.name,
    category: row.categoryId === null ? null : (nameById.get(row.categoryId) ?? null),
    quantity: row.quantity,
    unit: row.unit,
    note: row.note,
  }));

  const order = await db
    .select({ categoryId: listCategoryOrder.categoryId })
    .from(listCategoryOrder)
    .where(eq(listCategoryOrder.listId, listId))
    .orderBy(asc(listCategoryOrder.position));

  const categoryOrder = order
    .map((entry) => nameById.get(entry.categoryId))
    .filter((name): name is string => name !== undefined);

  return buildSharedList(list.name, items, categoryOrder);
}

export type ImportResult = {
  listId: string;
  itemCount: number;
  newProductCount: number;
};

/**
 * Uebernimmt eine empfangene Liste (FR-6.2, FR-6.3, architecture.md 4.5).
 *
 * Es entsteht **immer eine neue Liste**. Eine bestehende zu ergaenzen waere
 * die gefaehrlichere Voreinstellung: Der Empfaenger koennte seine eigene Liste
 * nicht mehr von der fremden trennen, und ein Import liesse sich nicht
 * rueckgaengig machen, ohne die eigene Arbeit mitzureissen. Eine ueberfluessige
 * Liste ist dagegen mit einem Tipp geloescht.
 *
 * Alles in einer Transaktion (CLAUDE.md): Eine Liste ohne ihre Artikel oder
 * Artikel ohne ihre neu angelegten Produkte waeren ein Zustand, den der
 * Nutzer nicht als Fehler erkennt.
 */
export async function importSharedList(
  file: SharedListFile,
  listName: string,
  fallbackCategoryId: string,
): Promise<ImportResult> {
  const knownProducts = await db.select({ id: products.id, name: products.name }).from(products);
  const knownCategories = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories);

  const plan = planImport(file, knownProducts, knownCategories, fallbackCategoryId);

  const listId = newId('l');
  const existing = await db.select({ id: lists.id }).from(lists);

  await db.transaction(async (tx) => {
    await tx.insert(lists).values({
      id: listId,
      name: listName,
      position: existing.length,
      lastOpenedAt: Date.now(),
    });

    if (plan.newProducts.length > 0) {
      await tx.insert(products).values(
        plan.newProducts.map((product) => ({
          id: product.id,
          name: product.name,
          categoryId: product.categoryId,
          isBuiltin: false,
        })),
      );
    }

    if (plan.items.length > 0) {
      await tx.insert(listItems).values(
        plan.items.map((entry, index) => ({
          id: `${listId}-i${index}`,
          listId,
          productId: entry.productId,
          name: entry.name,
          categoryId: entry.categoryId,
          quantity: entry.quantity,
          unit: entry.unit,
          note: entry.note,
          position: entry.position,
        })),
      );
    }

    if (plan.categoryOrder.length > 0) {
      await tx.insert(listCategoryOrder).values(
        plan.categoryOrder.map((categoryId, position) => ({
          listId,
          categoryId,
          position,
        })),
      );
    }
  });

  return {
    listId,
    itemCount: plan.items.length,
    newProductCount: plan.newProducts.length,
  };
}
