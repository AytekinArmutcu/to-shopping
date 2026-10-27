import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { pantry } from '@/db/schema';

import { addProductsToList } from '@/features/items/repository';

/**
 * Datenzugriff fuer den Vorrat (ADR-043, T-13.3).
 *
 * Der Vorrat ist nur eine Menge von Produkt-IDs. Welche Produkte auf der
 * Checkliste stehen, in welcher Reihenfolge und was fehlt, entscheidet
 * logic.ts - dort ist es getestet. Hier stehen nur Lese- und
 * Schreibvorgaenge.
 *
 * Das Befuellen nach dem Einkauf steht nicht hier, sondern in finishShopping
 * (features/items/repository.ts): Es muss in derselben Transaktion laufen wie
 * das Schreiben der Historie.
 */

/** Live-Abfrage: alle Produkt-IDs im Vorrat - als Bauplan fuer useLiveQuery (ADR-027). */
export function pantryQuery() {
  return db.select({ productId: pantry.productId }).from(pantry);
}

/**
 * Legt Produkte in den Vorrat.
 *
 * Schon vorhandene bleiben unberuehrt (onConflictDoNothing): Ein Haken auf
 * etwas, das schon da ist, ist kein Fehler, und das urspruengliche addedAt
 * bleibt erhalten.
 */
export async function addToPantry(productIds: string[]): Promise<void> {
  if (productIds.length === 0) {
    return;
  }

  const now = Date.now();

  await db
    .insert(pantry)
    .values(productIds.map((productId) => ({ productId, addedAt: now })))
    .onConflictDoNothing();
}

export async function removeFromPantry(productId: string): Promise<void> {
  await db.delete(pantry).where(eq(pantry.productId, productId));
}

/** Bequeme Huelle fuer den Haken auf der Checkliste. */
export async function setInPantry(productId: string, inPantry: boolean): Promise<void> {
  if (inPantry) {
    await addToPantry([productId]);
  } else {
    await removeFromPantry(productId);
  }
}

/**
 * Setzt fehlende Vorratsartikel auf eine Einkaufsliste.
 *
 * Keine eigene Schreiblogik: addProductsToList prueft schon auf Duplikate,
 * uebernimmt Kategorie und Standardeinheit als Kopie (ADR-007) und schreibt in
 * einer Transaktion. Ein zweiter Weg fuer dasselbe wuerde frueher oder spaeter
 * anders entscheiden als der erste.
 *
 * Rueckgabe: Anzahl der tatsaechlich hinzugefuegten Artikel.
 */
export async function addMissingToList(listId: string, productIds: string[]): Promise<number> {
  return addProductsToList(listId, productIds);
}
