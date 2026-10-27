import { asc, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { products, recipeItems, recipes, weeklyPlan } from '@/db/schema';
import { SEED_CATEGORIES, SEED_PRODUCTS, SEED_RECIPES } from '@/db/seed';
import { buildProductRows, buildRecipeRows } from '@/db/seed/logic';
import { addProductsToList } from '@/features/items/repository';

import {
  buildRecipeIngredients,
  cleanRecipeName,
  cleanRecipeNote,
  detachMissingProducts,
  planRecipeReset,
  type RecipeIngredient,
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
 * Legt ein eigenes Rezept an (FR-10.2). Rueckgabe: die neue ID.
 *
 * Die ID entsteht wie bei Vorlagen aus Zeit und Zufall, nicht aus dem Namen:
 * Ein eigenes Gericht "Pfannkuchen" soll nicht mit dem mitgelieferten
 * zusammenstossen (dessen ID ist r-<slug>).
 *
 * In einer Transaktion (CLAUDE.md): Ein Rezept ohne seine Zutaten saehe aus
 * wie ein leeres und stuende in der Uebersicht ganz oben bei "Alles da".
 */
export async function createRecipe(
  name: string,
  note: string | null,
  items: NewIngredient[],
): Promise<string> {
  const header = cleanHeader(name, note);
  const ingredients = buildRecipeIngredients(items);
  const id = newId('r');

  await db.transaction(async (tx) => {
    await tx.insert(recipes).values({ id, name: header.name, note: header.note, isBuiltin: false });
    await insertIngredients(tx, id, ingredients);
  });

  return id;
}

/**
 * Aendert ein Rezept - auch ein mitgeliefertes (ADR-044).
 *
 * Die Zutaten werden vollstaendig ersetzt statt einzeln abgeglichen: Ein
 * Rezept hat eine Handvoll Zutaten, und "loeschen und neu schreiben" kann
 * keine Position doppelt vergeben.
 *
 * isBuiltin bleibt, wie es ist (ADR-031): Nur so findet "Rezepte
 * zuruecksetzen" ein geaendertes mitgeliefertes Gericht wieder.
 */
export async function updateRecipe(
  id: string,
  name: string,
  note: string | null,
  items: NewIngredient[],
): Promise<void> {
  const header = cleanHeader(name, note);
  const ingredients = buildRecipeIngredients(items);

  await db.transaction(async (tx) => {
    await tx
      .update(recipes)
      .set({ name: header.name, note: header.note })
      .where(eq(recipes.id, id));
    await tx.delete(recipeItems).where(eq(recipeItems.recipeId, id));
    await insertIngredients(tx, id, ingredients);
  });
}

/**
 * Loescht ein Rezept. Zutaten und Wochenplan-Eintrag gehen per
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

  await db.transaction(async (tx) => {
    for (const recipe of recipeRows) {
      await tx
        .insert(recipes)
        .values(recipe)
        .onConflictDoUpdate({
          target: recipes.id,
          set: { name: recipe.name, note: recipe.note, isBuiltin: true },
        });

      await tx.delete(recipeItems).where(eq(recipeItems.recipeId, recipe.id));

      const items = itemRows.filter((item) => item.recipeId === recipe.id);
      if (items.length > 0) {
        await tx.insert(recipeItems).values(items);
      }
    }
  });

  return { restored: restore.length, untouched: untouched.length };
}
