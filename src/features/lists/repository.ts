import { asc, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { listCategoryOrder, lists } from '@/db/schema';

/**
 * Datenzugriff fuer Listen. Screens rufen ausschliesslich diese Funktionen
 * auf, niemals Drizzle direkt (CLAUDE.md, Schichtenregel 1).
 */

export const DEFAULT_LIST_NAME = 'Einkauf';

function newId(): string {
  // Ausreichend eindeutig fuer ein Geraet ohne Server. Zeitanteil vorn haelt
  // die IDs grob sortierbar, was beim Lesen von Datenbankinhalten hilft.
  return `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createList(name: string): Promise<string> {
  const id = newId();
  const [{ value: count } = { value: 0 }] = await db
    .select({ value: sql<number>`count(*)` })
    .from(lists);

  await db.insert(lists).values({
    id,
    name,
    position: count,
    lastOpenedAt: Date.now(),
  });

  return id;
}

export async function getLists() {
  return db.select().from(lists).orderBy(asc(lists.position));
}

/**
 * Liefert die zuletzt geoeffnete Liste - und legt beim allerersten Start eine
 * an, damit der Nutzer nie vor einer leeren App steht (PRD Flow 1.1).
 */
export async function getOrCreateActiveList() {
  const existing = await db
    .select()
    .from(lists)
    .orderBy(sql`${lists.lastOpenedAt} desc nulls last`)
    .limit(1);

  const first = existing[0];
  if (first) {
    return first;
  }

  const id = await createList(DEFAULT_LIST_NAME);
  const created = await db.select().from(lists).where(eq(lists.id, id)).limit(1);
  return created[0] ?? null;
}

export async function touchList(id: string): Promise<void> {
  await db.update(lists).set({ lastOpenedAt: Date.now() }).where(eq(lists.id, id));
}

export async function renameList(id: string, name: string): Promise<void> {
  await db.update(lists).set({ name }).where(eq(lists.id, id));
}

export async function deleteList(id: string): Promise<void> {
  // Artikel und Ladenlayout haengen per Fremdschluessel-Kaskade daran und
  // verschwinden mit - vorausgesetzt PRAGMA foreign_keys ist an (db/client.ts).
  await db.delete(lists).where(eq(lists.id, id));
}

/**
 * Bauplan fuer die Kategorie-Reihenfolge einer Liste (ADR-027).
 *
 * Ist nichts gespeichert, kommt eine leere Antwort zurueck - und genau daraus
 * macht orderCategories die Standardreihenfolge (T-5.4). Es gibt also keinen
 * zweiten Weg fuer den Fall "noch nie eingestellt".
 */
export function categoryOrderQuery(listId: string) {
  return db
    .select({
      categoryId: listCategoryOrder.categoryId,
      position: listCategoryOrder.position,
    })
    .from(listCategoryOrder)
    .where(eq(listCategoryOrder.listId, listId))
    .orderBy(asc(listCategoryOrder.position));
}

/**
 * Speichert das Ladenlayout einer Liste (FR-1.3).
 *
 * Loeschen und neu schreiben statt einzelner Aktualisierungen: Positionen sind
 * nur als Ganzes sinnvoll. Wuerde man sie einzeln verschieben, gaebe es
 * zwischendurch zwei Kategorien auf demselben Platz - und der Primaerschluessel
 * aus (Liste, Kategorie) haette nichts dagegen.
 *
 * In einer Transaktion (CLAUDE.md): Ein Abbruch zwischen Loeschen und
 * Schreiben wuerde die Liste ohne jede Reihenfolge zuruecklassen. Das faellt
 * nicht als Fehler auf - die Liste faellt still auf die Standardreihenfolge
 * zurueck, und die Einstellung des Nutzers waere weg.
 */
export async function saveCategoryOrder(listId: string, categoryIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(listCategoryOrder).where(eq(listCategoryOrder.listId, listId));

    if (categoryIds.length > 0) {
      await tx.insert(listCategoryOrder).values(
        categoryIds.map((categoryId, position) => ({
          listId,
          categoryId,
          position,
        })),
      );
    }
  });
}
