import { asc, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { products } from '@/db/schema';
import { DEFAULT_UNIT } from '@/db/units';
import { slugify } from '@/lib/slug';

import { cleanProductName } from './logic';

/** Datenzugriff fuer den Produktkatalog. */

export const FALLBACK_CATEGORY_ID = 'sonstiges';

export async function getProducts() {
  return db.select().from(products).orderBy(asc(products.name));
}

/**
 * Legt ein Produkt an, das der Nutzer selbst eingetippt hat (FR-2.2).
 *
 * Gibt es den Namen bereits - unabhaengig von der Schreibweise -, wird das
 * vorhandene Produkt zurueckgegeben statt ein zweites anzulegen. Der
 * eindeutige Index auf lower(name) wuerde das Einfuegen ohnehin ablehnen;
 * hier wird daraus ein sinnvolles Verhalten statt eines Fehlers.
 */
export async function createProduct(
  rawName: string,
  categoryId: string = FALLBACK_CATEGORY_ID,
): Promise<{ id: string; name: string; categoryId: string | null; defaultUnit: string } | null> {
  const name = cleanProductName(rawName);

  if (name.length === 0) {
    return null;
  }

  const existing = await db
    .select()
    .from(products)
    .where(sql`lower(${products.name}) = lower(${name})`)
    .limit(1);

  const found = existing[0];
  if (found) {
    return found;
  }

  const id = `p-${slugify(name)}` || `p-${Date.now().toString(36)}`;

  await db.insert(products).values({
    id,
    name,
    categoryId,
    defaultUnit: DEFAULT_UNIT,
    isBuiltin: false,
  });

  const created = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return created[0] ?? null;
}
