import { sql } from 'drizzle-orm';

import { detachMissingProducts } from '@/features/recipes/logic';

import { getFlag, setFlag } from '../appState';
import type { Database } from '../client';
import {
  categories as categoriesTable,
  products as productsTable,
  recipeItems as recipeItemsTable,
  recipes as recipesTable,
} from '../schema';
import categoriesJson from './categories.json';
import {
  buildProductRows,
  buildRecipeRows,
  type ProductRow,
  type SeedCategory,
  type SeedProduct,
  type SeedRecipe,
} from './logic';
import productsJson from './products.json';
import recipesJson from './recipes.json';

export const SEED_CATEGORIES = categoriesJson as SeedCategory[];
export const SEED_PRODUCTS = productsJson as SeedProduct[];
export const SEED_RECIPES = recipesJson as SeedRecipe[];

/**
 * Merker in app_state: Der Rezept-Grundstock wurde schon einmal gesaet.
 *
 * Warum ein Merker und nicht "die Tabelle ist leer": Der Grundstock ist
 * Starthilfe und darf geloescht werden (ADR-044). Wer alle Gerichte loescht,
 * soll sie nicht beim naechsten Start wiederfinden - zurueck kommen sie nur
 * ueber "Rezepte zuruecksetzen". Eine leere Tabelle sagt nicht, ob noch nie
 * gesaet wurde oder ob der Nutzer aufgeraeumt hat; der Merker schon.
 */
export const RECIPES_SEEDED_KEY = 'recipes_seeded';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Legt Kategorien und Startkatalog an, falls die Datenbank noch leer ist -
 * und mit ihnen den Grundstock an Rezepten (ADR-044, T-14.4).
 *
 * Warum in einer Transaktion (CLAUDE.md): Ein Abbruch mitten im Schreiben
 * wuerde sonst einen halben Katalog hinterlassen - und weil der Aufruf nur bei
 * leerer Datenbank passiert, wuerde er nie wieder nachgeholt. Die Rezepte
 * gehoeren in dieselbe Transaktion: Ihre Zutaten zeigen auf die Produkte, die
 * hier gerade erst entstehen.
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
    await insertSeedRecipes(tx, productRows);
  });
  await setFlag(RECIPES_SEEDED_KEY, true);

  return true;
}

/**
 * Saet den Rezept-Grundstock genau einmal pro Installation (ADR-044, T-14.4).
 *
 * Warum zusaetzlich zu seedIfEmpty: Auf Geraeten, die die App schon vor den
 * Rezepten hatten, gibt es Kategorien - seedIfEmpty tut dort nichts, und die
 * Rezepte kaemen nie an. Gehoert in _layout.tsx direkt hinter seedIfEmpty(db).
 * Bei einer frischen Installation hat seedIfEmpty den Merker schon gesetzt,
 * dann passiert hier nichts.
 *
 * Bedingung ist der Merker RECIPES_SEEDED_KEY, nicht "recipes ist leer" -
 * Begruendung dort.
 *
 * Der Merker wird direkt nach der Transaktion gesetzt, nicht in ihr: setFlag
 * schreibt ueber die gemeinsame Verbindung und nimmt keine Transaktion an.
 * Geht genau dazwischen etwas schief, wird beim naechsten Start noch einmal
 * gesaet - wegen onConflictDoNothing ohne doppelte Zeilen.
 *
 * Der Katalog wird dabei nicht angefasst: Es werden nur Rezepte und Zutaten
 * geschrieben. Hat der Nutzer ein mitgeliefertes Produkt geloescht, steht die
 * Zutat ohne Produktbezug da (detachMissingProducts).
 */
export async function seedRecipesOnce(db: Database): Promise<boolean> {
  if (await getFlag(RECIPES_SEEDED_KEY)) {
    return false;
  }

  const productRows = buildProductRows(SEED_PRODUCTS, SEED_CATEGORIES);

  await db.transaction(async (tx) => {
    await insertSeedRecipes(tx, productRows);
  });
  await setFlag(RECIPES_SEEDED_KEY, true);

  return true;
}

/**
 * Schreibt die Grundstock-Rezepte, erst die Gerichte, dann ihre Zutaten.
 *
 * Die vorhandenen Produkt-IDs werden innerhalb der Transaktion gelesen: Bei
 * seedIfEmpty sind die Produkte gerade erst eingefuegt worden und muessen
 * mitzaehlen.
 */
async function insertSeedRecipes(tx: Transaction, productRows: ProductRow[]): Promise<void> {
  const rows = buildRecipeRows(SEED_RECIPES, productRows);
  if (rows.recipes.length === 0) {
    return;
  }

  const existingProducts = await tx.select({ id: productsTable.id }).from(productsTable);
  const items = detachMissingProducts(
    rows.items,
    existingProducts.map((product) => product.id),
  );

  await tx.insert(recipesTable).values(rows.recipes).onConflictDoNothing();
  if (items.length > 0) {
    await tx.insert(recipeItemsTable).values(items).onConflictDoNothing();
  }
}
