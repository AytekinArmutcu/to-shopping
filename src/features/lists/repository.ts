import { asc, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { lists } from '@/db/schema';

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
