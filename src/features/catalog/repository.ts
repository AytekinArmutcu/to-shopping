import { asc, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { categories, products } from '@/db/schema';
import { SEED_CATEGORIES, SEED_PRODUCTS } from '@/db/seed';
import { buildProductRows } from '@/db/seed/logic';
import { DEFAULT_UNIT } from '@/db/units';
import { slugify } from '@/lib/slug';

import { cleanProductName, planCatalogReset } from './logic';

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

/**
 * Bauplaene fuer die Live-Abfragen des Katalogs.
 *
 * Warum Bauplaene statt fertiger Ergebnisse: useLiveQuery fuehrt die Abfrage bei
 * jeder Datenaenderung erneut aus und braucht sie deshalb als Objekt. Die
 * Screens kennen so weiterhin keine Tabellen (CLAUDE.md, Schichtenregel 1).
 */
export function catalogProductsQuery() {
  return db
    .select({
      id: products.id,
      name: products.name,
      categoryId: products.categoryId,
      defaultUnit: products.defaultUnit,
    })
    .from(products);
}

/**
 * Die IDs aller Grundvorrat-Produkte (ADR-047, FR-10.10). Eigene Abfrage statt
 * eines weiteren Felds in catalogProductsQuery: Nur Rezepte und Katalogpflege
 * fragen danach, die anderen Screens bleiben, wie sie sind.
 */
export function stapleProductIdsQuery() {
  return db.select({ id: products.id }).from(products).where(eq(products.isStaple, true));
}

export function categoriesQuery() {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      defaultPosition: categories.defaultPosition,
    })
    .from(categories);
}

/* ------------------------------------------------------------------ *
 * M7: Katalogpflege
 * ------------------------------------------------------------------ */

/**
 * Aendert Name und Kategorie eines Produkts (FR-4.2) - auch bei einem
 * mitgelieferten.
 *
 * Mitgelieferte Produkte sind bewusst nicht geschuetzt: Wer "Quark" nie kauft
 * und stattdessen "Skyr" braucht, soll das aendern duerfen. Das Kennzeichen
 * isBuiltin bleibt dabei erhalten, damit "Katalog zuruecksetzen" das Produkt
 * spaeter wiederfindet.
 *
 * Rueckgabe false, wenn der Name schon vergeben ist. Der eindeutige Index auf
 * lower(name) wuerde das ohnehin ablehnen; hier wird daraus eine Antwort
 * statt eines Fehlers.
 */
export async function updateProduct(
  id: string,
  rawName: string,
  categoryId: string,
): Promise<boolean> {
  const name = cleanProductName(rawName);

  if (name.length === 0) {
    return false;
  }

  const taken = await db
    .select({ id: products.id })
    .from(products)
    .where(sql`lower(${products.name}) = lower(${name}) and ${products.id} <> ${id}`)
    .limit(1);

  if (taken.length > 0) {
    return false;
  }

  await db.update(products).set({ name, categoryId }).where(eq(products.id, id));
  return true;
}

/**
 * Schaltet das Grundvorrat-Kennzeichen eines Produkts um (ADR-047, FR-4.5).
 *
 * Eigene Funktion statt Teil von updateProduct: Wer nur den Namen aendert,
 * soll das Kennzeichen nicht versehentlich mit ueberschreiben.
 */
export async function setProductStaple(id: string, isStaple: boolean): Promise<void> {
  await db.update(products).set({ isStaple }).where(eq(products.id, id));
}

/**
 * Loescht ein Produkt aus dem Katalog (FR-4.2).
 *
 * Bestehende Listeneintraege bleiben stehen: Sie tragen den Namen als Kopie,
 * und der Fremdschluessel loest nur die Verknuepfung (ADR-007, geprueft in
 * db/schema.test.ts). Wer im Laden steht, verliert seinen Zettel nicht, weil
 * jemand im Katalog aufgeraeumt hat.
 */
export async function deleteProduct(id: string): Promise<void> {
  await db.delete(products).where(eq(products.id, id));
}

export type CatalogResetResult = {
  restored: number;
  blocked: number;
};

/**
 * Setzt den mitgelieferten Katalog auf den Auslieferungszustand zurueck
 * (FR-4.4, T-7.4).
 *
 * Eigene Produkte bleiben unangetastet (ADR-031). Welche Zeilen ueberhaupt
 * angefasst werden, entscheidet die reine Funktion planCatalogReset - hier
 * steht nur der Schreibvorgang.
 *
 * In einer Transaktion (CLAUDE.md): Ein halb zurueckgesetzter Katalog waere
 * schlimmer als ein gar nicht zurueckgesetzter, weil er wie ein vollstaendiger
 * aussieht.
 */
export async function resetCatalog(): Promise<CatalogResetResult> {
  const existing = await db.select({ id: products.id, name: products.name }).from(products);

  const categoryRows = SEED_CATEGORIES.map((category) => ({
    id: category.id,
    name: category.name,
    defaultPosition: category.defaultPosition,
    isBuiltin: true,
  }));

  const { restore, blocked } = planCatalogReset(
    buildProductRows(SEED_PRODUCTS, SEED_CATEGORIES),
    existing,
  );

  await db.transaction(async (tx) => {
    for (const category of categoryRows) {
      await tx
        .insert(categories)
        .values(category)
        .onConflictDoUpdate({
          target: categories.id,
          set: { name: category.name, defaultPosition: category.defaultPosition },
        });
    }

    for (const product of restore) {
      await tx
        .insert(products)
        .values(product)
        .onConflictDoUpdate({
          target: products.id,
          set: {
            name: product.name,
            categoryId: product.categoryId,
            defaultUnit: product.defaultUnit,
            isBuiltin: true,
            isStaple: product.isStaple,
          },
        });
    }
  });

  return { restored: restore.length, blocked: blocked.length };
}
