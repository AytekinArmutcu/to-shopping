import { asc, eq, inArray, sql } from 'drizzle-orm';

import { getAppState, setAppState } from '@/db/appState';
import { db } from '@/db/client';
import { products, recipeItems, recipeSteps, recipes, weeklyPlan } from '@/db/schema';
import { SEED_CATEGORIES, SEED_PRODUCTS, SEED_RECIPES } from '@/db/seed';
import { buildProductRows, buildRecipeRows } from '@/db/seed/logic';
import { addProductsToList } from '@/features/items/repository';

import {
  buildRecipeIngredients,
  cleanRecipeName,
  cleanRecipeNote,
  cleanRecipeSteps,
  detachMissingProducts,
  isRecipeFilter,
  planRecipeReset,
  type RecipeFilter,
  type RecipeIngredient,
  type RecipeStepLike,
} from './logic';

/**
 * Datenzugriff fuer Rezepte und Wochenplan (ADR-044, T-14.4).
 *
 * Die Regeln stehen in logic.ts und sind dort getestet; hier stehen nur die
 * Lese- und Schreibvorgaenge - nach dem Muster der Vorlagen.
 */

export type NewIngredient = {
  productId: string | null;
  name: string;
  quantity: number;
  unit: string;
};

export type RecipeResetResult = {
  restored: number;
  untouched: number;
};

/** Gleiche Bauart wie bei den Vorlagen: Zeitstempel plus Zufall. */
function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/* ------------------------------------------------------------------ *
 * Live-Abfragen (ADR-027)
 * ------------------------------------------------------------------ */

/** Alle Rezepte - die Sortierung macht buildRecipeOverview. */
export function recipesQuery() {
  return db
    .select({
      id: recipes.id,
      name: recipes.name,
      isBuiltin: recipes.isBuiltin,
      note: recipes.note,
    })
    .from(recipes);
}

/** Alle Zutaten aller Rezepte - die Uebersicht braucht sie fuer "was fehlt". */
export function recipeItemsQuery() {
  return db
    .select({
      id: recipeItems.id,
      recipeId: recipeItems.recipeId,
      productId: recipeItems.productId,
      name: recipeItems.name,
      quantity: recipeItems.quantity,
      unit: recipeItems.unit,
      position: recipeItems.position,
    })
    .from(recipeItems)
    .orderBy(asc(recipeItems.recipeId), asc(recipeItems.position));
}

/** Die Zutaten eines Rezepts, in der gespeicherten Reihenfolge. */
export function recipeItemsOfQuery(recipeId: string) {
  return db
    .select({
      id: recipeItems.id,
      recipeId: recipeItems.recipeId,
      productId: recipeItems.productId,
      name: recipeItems.name,
      quantity: recipeItems.quantity,
      unit: recipeItems.unit,
      position: recipeItems.position,
    })
    .from(recipeItems)
    .where(eq(recipeItems.recipeId, recipeId))
    .orderBy(asc(recipeItems.position));
}

/** Die Zubereitungsschritte eines Rezepts, in der gespeicherten Reihenfolge (ADR-047). */
export function recipeStepsOfQuery(recipeId: string) {
  return db
    .select({
      id: recipeSteps.id,
      recipeId: recipeSteps.recipeId,
      position: recipeSteps.position,
      text: recipeSteps.text,
    })
    .from(recipeSteps)
    .where(eq(recipeSteps.recipeId, recipeId))
    .orderBy(asc(recipeSteps.position));
}

export function weeklyPlanQuery() {
  return db.select({ recipeId: weeklyPlan.recipeId }).from(weeklyPlan);
}

/* ------------------------------------------------------------------ *
 * Anlegen, Aendern, Loeschen
 * ------------------------------------------------------------------ */

/**
 * Name und Notiz bereinigen. Ein leerer Name verhindert schon der Screen; das
 * Repository haelt die Regel trotzdem, damit kein namenloses Rezept in die
 * Datenbank gelangt.
 */
function cleanHeader(name: string, note: string | null): { name: string; note: string | null } {
  const cleanName = cleanRecipeName(name);
  if (cleanName === null) {
    throw new Error('Rezept ohne Namen');
  }
  return { name: cleanName, note: note === null ? null : cleanRecipeNote(note) };
}

async function insertIngredients(
  tx: Transaction,
  recipeId: string,
  items: RecipeIngredient[],
): Promise<void> {
  if (items.length === 0) {
    return;
  }
  await tx.insert(recipeItems).values(
    items.map((item, index) => ({
      id: `${recipeId}-i${index}`,
      recipeId,
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      position: item.position,
    })),
  );
}

/**
 * Schreibt die Zubereitungsschritte eines Rezepts. Die IDs folgen dem Muster
 * des Grundstocks (`<rezept>-s<position>`, buildRecipeRows) - so hat jeder
 * Schritt dieselbe ID, egal ob gesaet, zurueckgesetzt oder selbst angelegt.
 */
async function insertSteps(
  tx: Transaction,
  recipeId: string,
  steps: RecipeStepLike[],
): Promise<void> {
  if (steps.length === 0) {
    return;
  }
  await tx.insert(recipeSteps).values(
    steps.map((step) => ({
      id: `${recipeId}-s${step.position}`,
      recipeId,
      position: step.position,
      text: step.text,
    })),
  );
}

/**
 * Legt ein eigenes Rezept an (FR-10.2). Rueckgabe: die neue ID.
 *
 * Die ID entsteht wie bei Vorlagen aus Zeit und Zufall, nicht aus dem Namen:
 * Ein eigenes Gericht "Pfannkuchen" soll nicht mit dem mitgelieferten
 * zusammenstossen (dessen ID ist r-<slug>).
 *
 * In einer Transaktion (CLAUDE.md): Ein Rezept ohne seine Zutaten saehe aus
 * wie ein leeres und stuende in der Uebersicht ganz oben bei "Alles da".
 *
 * Die Schritte kommen als rohe Texte; leere fallen weg, die Reihenfolge der
 * Eingabe bleibt (cleanRecipeSteps, FR-10.9).
 */
export async function createRecipe(
  name: string,
  note: string | null,
  items: NewIngredient[],
  steps: string[],
): Promise<string> {
  const header = cleanHeader(name, note);
  const ingredients = buildRecipeIngredients(items);
  const cleanSteps = cleanRecipeSteps(steps);
  const id = newId('r');

  await db.transaction(async (tx) => {
    await tx.insert(recipes).values({ id, name: header.name, note: header.note, isBuiltin: false });
    await insertIngredients(tx, id, ingredients);
    await insertSteps(tx, id, cleanSteps);
  });

  return id;
}

/**
 * Aendert ein Rezept - auch ein mitgeliefertes (ADR-044).
 *
 * Die Zutaten werden vollstaendig ersetzt statt einzeln abgeglichen: Ein
 * Rezept hat eine Handvoll Zutaten, und "loeschen und neu schreiben" kann
 * keine Position doppelt vergeben. Fuer die Schritte gilt dasselbe - und dort
 * erst recht, weil die ID die Position enthaelt.
 *
 * isBuiltin bleibt, wie es ist (ADR-031): Nur so findet "Rezepte
 * zuruecksetzen" ein geaendertes mitgeliefertes Gericht wieder.
 */
export async function updateRecipe(
  id: string,
  name: string,
  note: string | null,
  items: NewIngredient[],
  steps: string[],
): Promise<void> {
  const header = cleanHeader(name, note);
  const ingredients = buildRecipeIngredients(items);
  const cleanSteps = cleanRecipeSteps(steps);

  await db.transaction(async (tx) => {
    await tx
      .update(recipes)
      .set({ name: header.name, note: header.note })
      .where(eq(recipes.id, id));
    await tx.delete(recipeItems).where(eq(recipeItems.recipeId, id));
    await insertIngredients(tx, id, ingredients);
    await tx.delete(recipeSteps).where(eq(recipeSteps.recipeId, id));
    await insertSteps(tx, id, cleanSteps);
  });
}

/**
 * Loescht ein Rezept. Zutaten, Schritte und Wochenplan-Eintrag gehen per
 * Fremdschluessel-Kaskade mit (schema.ts).
 */
export async function deleteRecipe(id: string): Promise<void> {
  await db.delete(recipes).where(eq(recipes.id, id));
}

/* ------------------------------------------------------------------ *
 * Wochenplan (FR-10.6)
 * ------------------------------------------------------------------ */

export async function setInWeeklyPlan(recipeId: string, inPlan: boolean): Promise<void> {
  if (inPlan) {
    await db.insert(weeklyPlan).values({ recipeId, addedAt: Date.now() }).onConflictDoNothing();
  } else {
    await db.delete(weeklyPlan).where(eq(weeklyPlan.recipeId, recipeId));
  }
}

export async function clearWeeklyPlan(): Promise<void> {
  await db.delete(weeklyPlan);
}

/**
 * Setzt fehlende Zutaten auf eine Einkaufsliste (FR-10.5, FR-10.6).
 *
 * Keine eigene Schreiblogik - wie beim Vorrat (addMissingToList):
 * addProductsToList prueft auf Duplikate, uebernimmt Kategorie und
 * Standardeinheit als Kopie (ADR-007) und schreibt in einer Transaktion.
 *
 * Rueckgabe: Anzahl der tatsaechlich hinzugefuegten Artikel.
 */
export async function addRecipeMissingToList(
  listId: string,
  productIds: string[],
): Promise<number> {
  return addProductsToList(listId, productIds);
}

/* ------------------------------------------------------------------ *
 * Gemerkter Filter der Uebersicht (ADR-048, ADR-020)
 * ------------------------------------------------------------------ */

export const RECIPES_FILTER_KEY = 'recipes_filter';

/**
 * Der zuletzt gewaehlte Filter-Chip. Was in app_state steht, kann aus einer
 * aelteren Version stammen oder fehlen - dann gilt "Alle".
 */
export async function getRecipeFilter(): Promise<RecipeFilter> {
  const stored = await getAppState(RECIPES_FILTER_KEY);
  return isRecipeFilter(stored) ? stored : 'all';
}

export async function setRecipeFilter(filter: RecipeFilter): Promise<void> {
  await setAppState(RECIPES_FILTER_KEY, filter);
}

/* ------------------------------------------------------------------ *
 * Zuruecksetzen (ADR-031, ADR-044)
 * ------------------------------------------------------------------ */

/**
 * Setzt die mitgelieferten Rezepte auf den Auslieferungszustand zurueck.
 *
 * Welche Rezepte angefasst werden, entscheidet planRecipeReset: Eigene
 * bleiben, auch wenn sie zufaellig eine Seed-ID tragen. Mitgelieferte, die es
 * im aktuellen Grundstock nicht mehr gibt, bleiben ebenfalls stehen.
 *
 * Zutaten, deren Produkt der Nutzer geloescht hat, kommen ohne Produktbezug
 * zurueck (detachMissingProducts) - sonst lehnte der Fremdschluessel das
 * Einfuegen ab, und mit ihm das ganze Zuruecksetzen.
 *
 * In einer Transaktion (CLAUDE.md): Ein halb zurueckgesetzter Grundstock
 * saehe aus wie ein vollstaendiger.
 */
export async function resetRecipes(): Promise<RecipeResetResult> {
  const seed = buildRecipeRows(SEED_RECIPES, buildProductRows(SEED_PRODUCTS, SEED_CATEGORIES));

  const existing = await db.select({ id: recipes.id, isBuiltin: recipes.isBuiltin }).from(recipes);
  const existingProducts = await db.select({ id: products.id }).from(products);

  const { restore, untouched } = planRecipeReset(
    seed.recipes.map((recipe) => recipe.id),
    existing,
  );

  const restoreIds = new Set(restore);
  const recipeRows = seed.recipes.filter((recipe) => restoreIds.has(recipe.id));
  const itemRows = detachMissingProducts(
    seed.items.filter((item) => restoreIds.has(item.recipeId)),
    existingProducts.map((product) => product.id),
  );
  const stepRows = seed.steps.filter((step) => restoreIds.has(step.recipeId));

  if (recipeRows.length === 0) {
    return { restored: 0, untouched: untouched.length };
  }

  /*
   * Fuenf Befehle statt fuenf je Gericht. Jeder Befehl ist ueber expo-sqlite
   * ein eigener Weg von JavaScript zur Datenbank und zurueck; mit einer
   * Schleife ueber 35 Gerichte waren das rund 175, und das Zuruecksetzen
   * dauerte auf dem Emulator ueber 15 Sekunden ohne Rueckmeldung.
   *
   * Die Mengen bleiben weit unter der Grenze von SQLite (32766 Platzhalter je
   * Befehl in der mitgelieferten Fassung 3.50): 35 Gerichte, gut 300 Zutaten
   * mit je 7 Spalten, gut 150 Schritte mit je 4.
   *
   * Beim Gericht gewinnt der Grundstock (excluded = die einzufuegende Zeile),
   * isBuiltin wird wieder gesetzt. Zutaten und Schritte - auch vom Nutzer
   * geaenderte oder geloeschte (ADR-047) - werden geloescht und neu geschrieben.
   */
  await db.transaction(async (tx) => {
    await tx
      .insert(recipes)
      .values(recipeRows)
      .onConflictDoUpdate({
        target: recipes.id,
        set: { name: sql`excluded.name`, note: sql`excluded.note`, isBuiltin: true },
      });

    await tx.delete(recipeItems).where(inArray(recipeItems.recipeId, restore));
    await tx.delete(recipeSteps).where(inArray(recipeSteps.recipeId, restore));

    if (itemRows.length > 0) {
      await tx.insert(recipeItems).values(itemRows);
    }
    if (stepRows.length > 0) {
      await tx.insert(recipeSteps).values(stepRows);
    }
  });

  return { restored: restore.length, untouched: untouched.length };
}
