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
  /** Grundvorrat (ADR-047): zaehlt in Rezepten nie als fehlend. Fehlt = false. */
  staple?: boolean;
};

/** Fertige Zeile, wie sie in die Tabelle products geschrieben wird. */
export type ProductRow = {
  id: string;
  name: string;
  categoryId: string;
  defaultUnit: Unit;
  isBuiltin: true;
  isStaple: boolean;
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
    isStaple: product.staple ?? false,
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

/**
 * Stand des mitgelieferten Katalogs. Version 1 ist der Auslieferungsstand,
 * Version 2 bringt die Gewuerze und das Grundvorrat-Kennzeichen (ADR-047).
 */
export const CATALOG_SEED_VERSION = 2;

/**
 * Was in welcher Katalogversion neu dazugekommen ist - und nur das.
 *
 * Warum eine Liste der Neuzugaenge statt "alles einfuegen, was fehlt": Ein
 * mitgeliefertes Produkt, das auf dem Geraet fehlt, kann der Nutzer geloescht
 * haben. Geloeschtes bleibt geloescht, bis er selbst "Katalog zuruecksetzen"
 * waehlt (ADR-031). Nachgesaet wird deshalb nur, was das Geraet in seiner
 * Version noch nie gesehen haben kann.
 */
export const CATALOG_SEED_ADDITIONS: Record<number, string[]> = {
  2: [
    'p-oregano',
    'p-basilikum-getrocknet',
    'p-thymian',
    'p-currypulver',
    'p-zimt',
    'p-kuemmel',
    'p-muskatnuss',
    'p-chiliflocken',
    'p-vanillezucker',
  ],
};

export interface CatalogUpgradePlan {
  insert: ProductRow[];
  markStaple: string[];
  version: number;
}

/**
 * Plant das einmalige Nachsaeen auf einem Geraet mit aelterem Katalog
 * (ADR-047, T-16.2).
 *
 * - insert: Neuzugaenge aus Versionen nach storedVersion, die es auf dem
 *   Geraet noch nicht gibt. Ein eigenes Produkt mit derselben ID (gleicher
 *   Name, siehe slugify) blockiert wie beim Zuruecksetzen (ADR-031); ein
 *   gleichnamiges mit anderer ID faengt der eindeutige Namensindex mit
 *   onConflictDoNothing ab.
 * - markStaple: mitgelieferte Grundvorrat-Produkte, die noch vorhanden sind.
 *   Nur Kennzeichen setzen, nie einfuegen - ein geloeschtes Salz kommt nicht
 *   zurueck.
 *
 * storedVersion 0 bedeutet "nie gelaufen" (Version 1 = Auslieferungsstand).
 */
export function planCatalogUpgrade(
  storedVersion: number,
  seedRows: ProductRow[],
  existingIds: string[],
): CatalogUpgradePlan {
  if (storedVersion >= CATALOG_SEED_VERSION) {
    return { insert: [], markStaple: [], version: CATALOG_SEED_VERSION };
  }

  const existing = new Set(existingIds);
  const added = new Set(
    Object.entries(CATALOG_SEED_ADDITIONS)
      .filter(([version]) => Number(version) > storedVersion)
      .flatMap(([, ids]) => ids),
  );

  const insert = seedRows.filter((row) => added.has(row.id) && !existing.has(row.id));
  const markStaple = seedRows
    .filter((row) => row.isStaple && existing.has(row.id))
    .map((row) => row.id);

  return { insert, markStaple, version: CATALOG_SEED_VERSION };
}

/** Rohform eines Grundstock-Gerichts, wie es in recipes.json steht (ADR-044). */
export interface SeedRecipe {
  name: string;
  note?: string;
  items: { product: string; quantity?: number; unit?: string }[];
  /** Zubereitung als reiner Text, ein Eintrag pro Schritt (ADR-047). */
  steps?: string[];
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

/** Fertige Zeile fuer einen Zubereitungsschritt eines Gerichts (ADR-047). */
export interface RecipeStepRow {
  id: string;
  recipeId: string;
  position: number;
  text: string;
}

/** Laengster erlaubter Text eines Zubereitungsschritts. */
export const MAX_STEP_LENGTH = 500;

/**
 * Wandelt die Grundstock-Gerichte in Datenbankzeilen um.
 *
 * Anders als beim Produktkatalog gibt es hier keinen stillen Rueckfall: Eine
 * Zutat, die nicht im Katalog steht, oder eine ungueltige Einheit ist ein
 * Fehler in den ausgelieferten Daten und soll laut auffallen, statt ein
 * halbes Gericht in die Datenbank zu schreiben. Der Name der Zutat wird als
 * Kopie gespeichert (ADR-007).
 *
 * Schritte werden getrimmt, leere verworfen; ein Schritt ueber
 * MAX_STEP_LENGTH Zeichen wirft, damit der Seed nicht still kaputtgeht.
 */
export function buildRecipeRows(
  recipes: SeedRecipe[],
  products: ProductRow[],
): { recipes: RecipeRow[]; items: RecipeItemRow[]; steps: RecipeStepRow[] } {
  const productsByName = new Map(products.map((product) => [product.name, product]));
  const recipeRows: RecipeRow[] = [];
  const itemRows: RecipeItemRow[] = [];
  const stepRows: RecipeStepRow[] = [];

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

    const texts = (recipe.steps ?? []).map((step) => step.trim()).filter((text) => text !== '');
    texts.forEach((text, index) => {
      if (text.length > MAX_STEP_LENGTH) {
        throw new Error(
          `Gericht "${recipe.name}": Schritt ${index + 1} ist laenger als ${MAX_STEP_LENGTH} Zeichen`,
        );
      }
      stepRows.push({ id: `${recipeId}-s${index}`, recipeId, position: index, text });
    });
  }

  return { recipes: recipeRows, items: itemRows, steps: stepRows };
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
