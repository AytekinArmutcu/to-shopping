import { asc, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { appState, listCategoryOrder, listItems, lists } from '@/db/schema';

import { copyName, parseListRoute, resolveStartRoute } from './logic';

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

/* ------------------------------------------------------------------ *
 * M6: mehrere Listen nebeneinander
 * ------------------------------------------------------------------ */

/** Bauplaene fuer die Uebersicht (ADR-027). */
export function listsQuery() {
  return db
    .select({ id: lists.id, name: lists.name, position: lists.position })
    .from(lists)
    .orderBy(asc(lists.position));
}

/**
 * Offene Artikel je Liste - gezaehlt in der Datenbank, nicht in der App.
 *
 * Die Alternative waere, alle Artikel aller Listen zu laden und zu zaehlen.
 * Bei einer Handvoll Listen faellt das nicht auf, aber es waere die falsche
 * Gewohnheit: Zaehlen ist genau das, wofuer eine Datenbank da ist.
 */
export function openCountsQuery() {
  return db
    .select({ listId: listItems.listId, openCount: sql<number>`count(*)` })
    .from(listItems)
    .where(eq(listItems.isChecked, false))
    .groupBy(listItems.listId);
}

/**
 * Alle Artikel aller Listen, schmal - fuer Farbleiste und Vorschau der
 * Listenkarten (T-18.3).
 *
 * Eine Abfrage fuer die ganze Uebersicht statt einer je Karte: useLiveQuery
 * fuehrt jede Abfrage bei jeder Aenderung neu aus, und zehn Karten hiessen
 * dann zehn Runden. Die Gruppierung macht buildListPreviews in der App, weil
 * sie dieselbe Ladenreihenfolge braucht wie die Liste selbst - und die steckt
 * in reiner Logik, nicht in SQL.
 *
 * Die Kategorie kommt aus dem Listeneintrag, nicht aus dem Produkt: Genau
 * danach gruppiert auch die Liste (ADR-007, Kopie beim Hinzufuegen). Die
 * Farbleiste soll dieselben Abteilungen zeigen, die man nach dem Antippen sieht.
 */
export function listPreviewItemsQuery() {
  return db
    .select({
      id: listItems.id,
      listId: listItems.listId,
      name: listItems.name,
      categoryId: listItems.categoryId,
      isChecked: listItems.isChecked,
      position: listItems.position,
      createdAt: listItems.createdAt,
    })
    .from(listItems);
}

/** Das Ladenlayout aller Listen auf einmal - Gegenstueck zu categoryOrderQuery. */
export function allCategoryOrdersQuery() {
  return db
    .select({
      listId: listCategoryOrder.listId,
      categoryId: listCategoryOrder.categoryId,
      position: listCategoryOrder.position,
    })
    .from(listCategoryOrder);
}

export async function getList(id: string) {
  const found = await db.select().from(lists).where(eq(lists.id, id)).limit(1);
  return found[0] ?? null;
}

/**
 * Dupliziert eine Liste samt Artikeln und Ladenlayout (T-6.3).
 *
 * Die Haken werden dabei zurueckgesetzt. Eine Kopie entsteht, um denselben
 * Einkauf noch einmal zu machen - abgehakte Artikel waeren dann von Anfang an
 * unsichtbar, und der Nutzer haette eine halb leere Liste vor sich, ohne zu
 * verstehen, warum.
 *
 * Alles in einer Transaktion (CLAUDE.md): Eine Kopie ohne ihre Artikel waere
 * nicht als Fehler erkennbar - sie saehe aus wie eine leere neue Liste.
 *
 * Rueckgabe: die ID der Kopie, oder null, wenn es die Vorlage nicht gibt.
 */
export async function duplicateList(listId: string, copySuffix: string): Promise<string | null> {
  const source = await getList(listId);

  if (!source) {
    return null;
  }

  const existing = await db.select({ name: lists.name }).from(lists);
  const name = copyName(
    source.name,
    existing.map((entry) => entry.name),
    copySuffix,
  );

  const id = newId();
  const now = Date.now();

  const items = await db
    .select()
    .from(listItems)
    .where(eq(listItems.listId, listId))
    .orderBy(asc(listItems.position));

  const order = await db
    .select()
    .from(listCategoryOrder)
    .where(eq(listCategoryOrder.listId, listId));

  await db.transaction(async (tx) => {
    await tx.insert(lists).values({
      id,
      name,
      position: existing.length,
      lastOpenedAt: now,
    });

    if (items.length > 0) {
      await tx.insert(listItems).values(
        items.map((item, index) => ({
          id: `${id}-i${index}`,
          listId: id,
          productId: item.productId,
          name: item.name,
          categoryId: item.categoryId,
          quantity: item.quantity,
          unit: item.unit,
          note: item.note,
          isChecked: false,
          checkedAt: null,
          position: item.position,
        })),
      );
    }

    if (order.length > 0) {
      await tx.insert(listCategoryOrder).values(
        order.map((entry) => ({
          listId: id,
          categoryId: entry.categoryId,
          position: entry.position,
        })),
      );
    }
  });

  return id;
}

/* ------------------------------------------------------------------ *
 * Zuletzt genutzte Route (FR-1.5)
 * ------------------------------------------------------------------ */

export const LAST_ROUTE_KEY = 'last_route';

export async function getLastRoute(): Promise<string | null> {
  const found = await db.select().from(appState).where(eq(appState.key, LAST_ROUTE_KEY)).limit(1);

  return found[0]?.value ?? null;
}

/**
 * Merkt sich den zuletzt gesehenen Screen.
 *
 * In app_state und nicht im Zustand-Store: Der Store haelt nur UI-Zustand und
 * ueberlebt das Beenden der App nicht (ADR-020) - genau das ist hier aber der
 * Sinn der Sache.
 */
export async function setLastRoute(route: string): Promise<void> {
  await db
    .insert(appState)
    .values({ key: LAST_ROUTE_KEY, value: route })
    .onConflictDoUpdate({ target: appState.key, set: { value: route } });
}

/** Bauplan fuer eine einzelne Liste - damit eine Umbenennung sofort ankommt. */
export function listQuery(listId: string) {
  return db.select({ id: lists.id, name: lists.name }).from(lists).where(eq(lists.id, listId));
}

/**
 * Womit startet die App (FR-1.5)?
 *
 * Die reine Entscheidung steckt in resolveStartRoute und ist getestet; hier
 * kommt nur dazu, was ohne Datenbank nicht zu beantworten ist: Gibt es die
 * Liste hinter der gemerkten Route ueberhaupt noch? Wer seine zuletzt genutzte
 * Liste geloescht hat, soll nicht auf einem leeren Bildschirm landen.
 *
 * Beim allerersten Start gibt es keine gemerkte Route. Dann entsteht die
 * Standardliste und die App oeffnet sie direkt - der Nutzer soll nicht mit
 * einer leeren Uebersicht beginnen, sondern mit etwas, das er benutzen kann
 * (PRD Flow 1.1).
 */
export type StartTarget = {
  /** null bedeutet: die Uebersicht. */
  listId: string | null;
};

export async function resolveStartTarget(): Promise<StartTarget> {
  const stored = await getLastRoute();

  if (stored !== null) {
    const id = parseListRoute(resolveStartRoute(stored));

    if (id === null) {
      return { listId: null };
    }

    const list = await getList(id);
    return { listId: list ? id : null };
  }

  const active = await getOrCreateActiveList();
  return { listId: active?.id ?? null };
}
