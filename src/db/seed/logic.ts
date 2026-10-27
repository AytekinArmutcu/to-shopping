import { slugify } from '@/lib/slug';

import { DEFAULT_UNIT, isUnit, type Unit } from '../units';

/** Rohform, wie sie in categories.json und products.json steht. */
export type SeedCategory = {
  id: string;
  name: string;
  defaultPosition: number;
};

export type SeedProduct = {
  name: string;
  category: string;
  unit: string;
};

/** Fertige Zeile, wie sie in die Tabelle products geschrieben wird. */
export type ProductRow = {
  id: string;
  name: string;
  categoryId: string;
  defaultUnit: Unit;
  isBuiltin: true;
};

/**
 * Wandelt die Rohdaten des Startkatalogs in Datenbankzeilen um.
 *
 * Reine Funktion ohne Datenbankzugriff (ADR-008): Eingabe rein, Zeilen raus.
 * Dadurch laesst sich der komplette Katalog pruefen, ohne die App zu starten.
 *
 * Unbekannte Kategorien landen in "sonstiges" statt zu einem Fehler zu fuehren -
 * ein einzelner Tippfehler in der Datei soll nicht die Erstinstallation
 * verhindern. Unbekannte Einheiten fallen auf "stueck" zurueck.
 */
export function buildProductRows(
  products: SeedProduct[],
  categories: SeedCategory[],
  fallbackCategoryId = 'sonstiges',
): ProductRow[] {
  const knownCategories = new Set(categories.map((category) => category.id));

  return products.map((product) => ({
    id: `p-${slugify(product.name)}`,
    name: product.name,
    categoryId: knownCategories.has(product.category) ? product.category : fallbackCategoryId,
    defaultUnit: isUnit(product.unit) ? product.unit : DEFAULT_UNIT,
    isBuiltin: true,
  }));
}

/**
 * Findet Namen, die sich nur in der Gross-/Kleinschreibung unterscheiden.
 *
 * Solche Paare wuerden am eindeutigen Index auf lower(name) scheitern und die
 * Erstinstallation abbrechen lassen. Der Test prueft das vor der Auslieferung.
 */
export function findDuplicateNames(products: SeedProduct[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const product of products) {
    const key = product.name.toLowerCase();
    if (seen.has(key)) {
      duplicates.push(product.name);
    }
    seen.add(key);
  }

  return duplicates;
}

/** Findet Produkte, deren erzeugte ID mit einer anderen kollidiert. */
export function findDuplicateIds(rows: ProductRow[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const row of rows) {
    if (seen.has(row.id)) {
      duplicates.push(row.id);
    }
    seen.add(row.id);
  }

  return duplicates;
}

/** Rohform eines Grundstock-Gerichts, wie es in recipes.json steht (ADR-044). */
export interface SeedRecipe {
  name: string;
  note?: string;
  items: { product: string; quantity?: number; unit?: string }[];
}

/** Fertige Zeile fuer die Tabelle der Gerichte. */
export interface RecipeRow {
  id: string;
  name: string;
  note: string | null;
  isBuiltin: true;
}

/** Fertige Zeile fuer eine Zutat eines Gerichts. */
export interface RecipeItemRow {
  id: string;
  recipeId: string;
  productId: string;
  name: string;
  quantity: number;
  unit: Unit;
  position: number;
}

/**
 * Wandelt die Grundstock-Gerichte in Datenbankzeilen um.
 *
 * Anders als beim Produktkatalog gibt es hier keinen stillen Rueckfall: Eine
 * Zutat, die nicht im Katalog steht, oder eine ungueltige Einheit ist ein
 * Fehler in den ausgelieferten Daten und soll laut auffallen, statt ein
 * halbes Gericht in die Datenbank zu schreiben. Der Name der Zutat wird als
 * Kopie gespeichert (ADR-007).
 */
export function buildRecipeRows(
  recipes: SeedRecipe[],
  products: ProductRow[],
): { recipes: RecipeRow[]; items: RecipeItemRow[] } {
  const productsByName = new Map(products.map((product) => [product.name, product]));
  const recipeRows: RecipeRow[] = [];
  const itemRows: RecipeItemRow[] = [];

  for (const recipe of recipes) {
    const recipeId = `r-${slugify(recipe.name)}`;
    recipeRows.push({
      id: recipeId,
      name: recipe.name,
      note: recipe.note ?? null,
      isBuiltin: true,
    });

    recipe.items.forEach((item, index) => {
      const product = productsByName.get(item.product);
      if (!product) {
        throw new Error(`Gericht "${recipe.name}": unbekanntes Produkt "${item.product}"`);
      }
      const unit = item.unit ?? product.defaultUnit;
      if (!isUnit(unit)) {
        throw new Error(
          `Gericht "${recipe.name}": ungueltige Einheit "${unit}" bei "${item.product}"`,
        );
      }
      itemRows.push({
        id: `${recipeId}-i${index}`,
        recipeId,
        productId: product.id,
        name: product.name,
        quantity: item.quantity ?? 1,
        unit,
        position: index,
      });
    });
  }

  return { recipes: recipeRows, items: itemRows };
}

/** Nennt die Gerichte, die auf ein Produkt ausserhalb des Katalogs verweisen. */
export function findRecipesWithUnknownProducts(
  recipes: SeedRecipe[],
  products: ProductRow[],
): string[] {
  const known = new Set(products.map((product) => product.name));
  return recipes
    .filter((recipe) => recipe.items.some((item) => !known.has(item.product)))
    .map((recipe) => recipe.name);
}

/** Findet Gerichtnamen, die sich nur in der Gross-/Kleinschreibung unterscheiden. */
export function findDuplicateRecipeNames(recipes: SeedRecipe[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const recipe of recipes) {
    const key = recipe.name.toLowerCase();
    if (seen.has(key)) {
      duplicates.push(recipe.name);
    }
    seen.add(key);
  }

  return duplicates;
}
