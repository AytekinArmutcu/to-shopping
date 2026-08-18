import { sql } from 'drizzle-orm';

import type { Database } from '../client';
import { categories as categoriesTable, products as productsTable } from '../schema';
import categoriesJson from './categories.json';
import { buildProductRows, type SeedCategory, type SeedProduct } from './logic';
import productsJson from './products.json';

export const SEED_CATEGORIES = categoriesJson as SeedCategory[];
export const SEED_PRODUCTS = productsJson as SeedProduct[];

/**
 * Legt Kategorien und Startkatalog an, falls die Datenbank noch leer ist.
 *
 * Warum in einer Transaktion (CLAUDE.md): Ein Abbruch mitten im Schreiben
 * wuerde sonst einen halben Katalog hinterlassen - und weil der Aufruf nur bei
 * leerer Datenbank passiert, wuerde er nie wieder nachgeholt.
 *
 * Warum "onConflictDoNothing" statt eines Fehlers: Beim Zuruecksetzen des
 * Katalogs (FR-4.4) wird dieselbe Funktion mit force benutzt. Dann sollen
 * fehlende mitgelieferte Produkte zurueckkehren, ohne die eigenen des Nutzers
 * anzufassen.
 */
export async function seedIfEmpty(db: Database, force = false): Promise<boolean> {
  if (!force) {
    const existing = await db.select({ count: sql<number>`count(*)` }).from(categoriesTable);
    if ((existing[0]?.count ?? 0) > 0) {
      return false;
    }
  }

  const categoryRows = SEED_CATEGORIES.map((category) => ({
    id: category.id,
    name: category.name,
    defaultPosition: category.defaultPosition,
    isBuiltin: true,
  }));

  const productRows = buildProductRows(SEED_PRODUCTS, SEED_CATEGORIES);

  await db.transaction(async (tx) => {
    await tx.insert(categoriesTable).values(categoryRows).onConflictDoNothing();
    await tx.insert(productsTable).values(productRows).onConflictDoNothing();
  });

  return true;
}
