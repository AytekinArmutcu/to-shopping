import { cleanProductName } from '@/features/catalog/logic';
import { planTemplateApply, type TargetItem } from '@/features/templates/logic';

/**
 * Rezepte: was davon da ist, was fehlt, was gesammelt auf die Liste geht
 * (ADR-044, FR-10.3 bis FR-10.6, T-14.3).
 *
 * Reine Funktionen ohne Datenbankzugriff (ADR-008). Ein Rezept ist fast eine
 * Vorlage - der einzige Unterschied ist die Frage "was davon ist schon zu
 * Hause?". Deshalb steckt hier keine eigene Listen-Regel: Was "steht schon
 * offen auf der Liste" bedeutet, entscheidet weiter planTemplateApply
 * (ADR-038). Dieses Modul legt nur den Vorrat davor.
 */

/**
 * Rezeptnamen folgen derselben Regel wie Vorlagennamen (60 Zeichen,
 * Leerzeichen aufgeraeumt, leer wird null). Bewusst kein zweiter Regelsatz:
 * Weichen die beiden auseinander, fragt sich bei jeder Aenderung "gilt das fuer
 * beide?" (ADR-044).
 */
export { cleanTemplateName as cleanRecipeName } from '@/features/templates/logic';

export interface RecipeIngredient {
  productId: string | null;
  name: string;
  quantity: number;
  unit: string;
  position: number;
}

export interface RecipeLike {
  id: string;
  name: string;
  isBuiltin: boolean;
  note: string | null;
}

/** Laenge einer Rezeptnotiz - ein Hinweis, keine Zubereitung (ADR-044). */
export const MAX_RECIPE_NOTE_LENGTH = 200;

/** Wie viele fehlende Zutaten eine Zeile der Uebersicht nennt (FR-10.3). */
export const MISSING_NAMES_LIMIT = 2;

/* ------------------------------------------------------------------ *
 * Zutat gegen Vorrat und Liste
 * ------------------------------------------------------------------ */

export type IngredientStatus = 'have' | 'onList' | 'missing';

export interface RecipeShoppingPlan<T> {
  /** Liegt im Vorrat. */
  have: T[];
  /** Nicht im Vorrat, steht aber offen auf der Liste. */
  onList: T[];
  /** Weder im Vorrat noch offen auf der Liste - das geht auf die Liste. */
  missing: T[];
}

/**
 * Ordnet jede Zutat eines Rezepts ein: da, schon auf der Liste, oder fehlt
 * (FR-10.4, FR-10.5).
 *
 * Der Vorrat schlaegt die Liste: Eine Zutat, die zu Hause ist und zugleich
 * offen auf der Liste steht, gilt als "da". Fuer das Rezept zaehlt, ob man
 * kochen kann - dass sie zusaetzlich auf der Liste steht, ist Sache der Liste.
 *
 * Eine Zutat ohne productId (das Produkt wurde geloescht, ADR-007) kann nie
 * "da" sein, denn der Vorrat kennt nur Produkte (ADR-043). Per Name kann sie
 * aber auf der Liste erkannt werden - genau wie beim Anwenden einer Vorlage.
 *
 * Fuer "auf der Liste" wird planTemplateApply aufgerufen statt nachgebaut. Das
 * hat eine Folge, die bewusst hingenommen ist: Steht dieselbe Zutat zweimal im
 * Rezept (ein Datenfehler) und liegt sie nicht im Vorrat, landet das zweite
 * Vorkommen bei "onList" - planTemplateApply ueberspringt es, weil das erste
 * ja schon auf die Liste kommt. So geht sie nur einmal auf die Liste, und
 * darauf kommt es an.
 *
 * Jede Gruppe behaelt die Reihenfolge der Eingabe.
 */
export function planRecipeShopping<T extends { productId: string | null; name: string }>(
  items: T[],
  pantryProductIds: string[],
  openListItems: TargetItem[],
): RecipeShoppingPlan<T> {
  const pantry = new Set(pantryProductIds);
  const statuses: IngredientStatus[] = items.map((item) =>
    item.productId !== null && pantry.has(item.productId) ? 'have' : 'missing',
  );

  // Ueber den Index statt ueber das Objekt selbst zuordnen: Dasselbe Objekt
  // kann zweimal in der Eingabe stehen, dann waere die Identitaet mehrdeutig.
  const candidates = items
    .map((item, index) => ({ productId: item.productId, name: item.name, index }))
    .filter((candidate) => statuses[candidate.index] !== 'have');

  for (const candidate of planTemplateApply(candidates, openListItems).skipped) {
    statuses[candidate.index] = 'onList';
  }

  const plan: RecipeShoppingPlan<T> = { have: [], onList: [], missing: [] };
  items.forEach((item, index) => {
    plan[statuses[index] ?? 'missing'].push(item);
  });
  return plan;
}

/* ------------------------------------------------------------------ *
 * Uebersicht
 * ------------------------------------------------------------------ */

export interface RecipeOverviewRow {
  id: string;
  name: string;
  isBuiltin: boolean;
  totalCount: number;
  missingCount: number;
  missingNames: string[];
  inPlan: boolean;
}

/**
 * Die Rezeptuebersicht, "Alles da" zuerst (FR-10.3).
 *
 * Fehlend heisst hier: **nicht im Vorrat**. Ob die Zutat schon auf der Liste
 * steht, spielt keine Rolle - "Alles da" soll heissen "ich kann heute kochen",
 * und was erst noch eingekauft werden muss, ist eben nicht da.
 *
 * Sortiert nach Zahl der fehlenden Zutaten, dann alphabetisch nach deutschem
 * Alphabet, dann nach ID, damit gleichnamige Rezepte nicht springen.
 *
 * Ein Rezept ohne Zutaten hat nichts, was fehlen koennte, und steht deshalb
 * oben bei "Alles da". Das ist hinnehmbar: Ein leeres Rezept ist ein frisch
 * angelegtes, und es oben wiederzufinden schadet nicht.
 *
 * Dieselbe Zutat zweimal im Rezept (ein Datenfehler) zaehlt hier zweimal und
 * kann auch zweimal in missingNames stehen - die Zeile zeigt das Rezept, wie
 * es gespeichert ist.
 */
export function buildRecipeOverview(
  recipes: RecipeLike[],
  itemsByRecipe: Map<string, RecipeIngredient[]> | Record<string, RecipeIngredient[]>,
  pantryProductIds: string[],
  plannedRecipeIds: string[],
): RecipeOverviewRow[] {
  const pantry = new Set(pantryProductIds);
  const planned = new Set(plannedRecipeIds);

  const rows = recipes.map((recipe): RecipeOverviewRow => {
    const items = [...ingredientsOf(itemsByRecipe, recipe.id)].sort(
      (a, b) => a.position - b.position,
    );
    const missing = items.filter((item) => item.productId === null || !pantry.has(item.productId));

    return {
      id: recipe.id,
      name: recipe.name,
      isBuiltin: recipe.isBuiltin,
      totalCount: items.length,
      missingCount: missing.length,
      missingNames: missing.slice(0, MISSING_NAMES_LIMIT).map((item) => item.name),
      inPlan: planned.has(recipe.id),
    };
  });

  return rows.sort((a, b) => {
    if (a.missingCount !== b.missingCount) {
      return a.missingCount - b.missingCount;
    }
    const byName = a.name.localeCompare(b.name, 'de');
    return byName !== 0 ? byName : a.id.localeCompare(b.id);
  });
}

/**
 * Zutaten eines Rezepts aus Map oder einfachem Objekt. Beim Objekt nur eigene
 * Schluessel: Eine Rezept-ID "constructor" saehe sonst eine Funktion statt
 * einer Zutatenliste.
 */
function ingredientsOf(
  itemsByRecipe: Map<string, RecipeIngredient[]> | Record<string, RecipeIngredient[]>,
  recipeId: string,
): RecipeIngredient[] {
  if (itemsByRecipe instanceof Map) {
    return itemsByRecipe.get(recipeId) ?? [];
  }
  return Object.prototype.hasOwnProperty.call(itemsByRecipe, recipeId)
    ? (itemsByRecipe[recipeId] ?? [])
    : [];
}

/* ------------------------------------------------------------------ *
 * Wochenplan
 * ------------------------------------------------------------------ */

export interface WeeklyShoppingPlan {
  /** Fehlende Produkte, je einmal, in Reihenfolge des ersten Auftretens - fuer addProductsToList. */
  productIds: string[];
  /** Fehlende Zutaten ohne Produktbezug, je Name einmal - koennen nicht automatisch auf die Liste. */
  unresolvedNames: string[];
  /** Zutaten, die wegen Vorrat oder Liste nicht gebraucht wurden, ueber alle Rezepte gezaehlt. */
  skipped: number;
}

/**
 * Sammelt, was fuer die Rezepte der Woche fehlt (FR-10.6).
 *
 * Jedes Rezept wird fuer sich mit planRecipeShopping eingeordnet - gegen
 * denselben Vorrat und dieselbe Liste. Die fehlenden Zutaten werden dann
 * vereinigt: Brauchen Bolognese und Lasagne beide Hackfleisch, kommt es
 * einmal auf die Liste. Wie viel man davon braucht, steht nicht auf der Liste
 * (Mengen sind optional, ADR-044) - zwei Zeilen "Hackfleisch" waeren ein
 * Fehler, kein Hinweis auf die Menge.
 *
 * Zutaten ohne productId (geloeschtes Produkt) koennen nicht ueber
 * addProductsToList auf die Liste; sie werden gesondert gemeldet, damit der
 * Screen sie nennen kann statt sie still zu verschlucken. Gleich ist hier, was
 * ohne Ruecksicht auf Gross- und Kleinschreibung gleich heisst; behalten wird
 * die Schreibweise des ersten Auftretens.
 *
 * skipped zaehlt vor der Vereinigung: Wie viele Zutaten ueber alle Rezepte
 * hinweg schon da waren oder schon auf der Liste standen.
 */
export function planWeeklyShopping(
  plannedItems: RecipeIngredient[][],
  pantryProductIds: string[],
  openListItems: TargetItem[],
): WeeklyShoppingPlan {
  const productIds: string[] = [];
  const unresolvedNames: string[] = [];
  const seenProducts = new Set<string>();
  const seenNames = new Set<string>();
  let skipped = 0;

  for (const items of plannedItems) {
    const plan = planRecipeShopping(items, pantryProductIds, openListItems);
    skipped += plan.have.length + plan.onList.length;

    for (const item of plan.missing) {
      if (item.productId !== null) {
        if (!seenProducts.has(item.productId)) {
          seenProducts.add(item.productId);
          productIds.push(item.productId);
        }
        continue;
      }

      const key = item.name.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        unresolvedNames.push(item.name);
      }
    }
  }

  return { productIds, unresolvedNames, skipped };
}

/* ------------------------------------------------------------------ *
 * Zuruecksetzen
 * ------------------------------------------------------------------ */

export interface RecipeResetPlan {
  /** Seed-IDs, die neu angelegt oder auf den Auslieferungszustand gesetzt werden. */
  restore: string[];
  /** IDs eigener Rezepte - werden nicht angefasst. */
  untouched: string[];
}

/**
 * Plant "Rezepte zuruecksetzen" nach dem Muster des Katalogs (ADR-031,
 * ADR-044).
 *
 * Mitgelieferte Rezepte kehren in den Auslieferungszustand zurueck, geloeschte
 * kommen wieder. Eigene Rezepte bleiben, wie sie sind - "zuruecksetzen"
 * bezieht sich auf das, was die App mitgebracht hat.
 *
 * Der Sonderfall: Ein **eigenes** Rezept traegt zufaellig eine Seed-ID. Das
 * passiert, wenn der Nutzer ein mitgeliefertes Gericht geloescht und spaeter
 * unter demselben Namen selbst angelegt hat - die ID entsteht aus dem Namen.
 * Beim Katalog waere das "blocked"; hier gewinnt das Eigene: Es steht in
 * untouched und nicht in restore. Ueberschreiben hiesse, die Arbeit des
 * Nutzers durch die Vorlage der App zu ersetzen.
 *
 * Mitgelieferte Rezepte, die es im aktuellen Seed nicht mehr gibt, stehen in
 * keiner der beiden Gruppen - was mit ihnen geschieht, entscheidet der
 * Aufrufer.
 */
export function planRecipeReset(
  seedRecipeIds: string[],
  existing: { id: string; isBuiltin: boolean }[],
): RecipeResetPlan {
  const untouched = existing.filter((recipe) => !recipe.isBuiltin).map((recipe) => recipe.id);
  const own = new Set(untouched);

  return {
    restore: seedRecipeIds.filter((id) => !own.has(id)),
    untouched,
  };
}

/**
 * Loest bei Zutaten den Produktbezug, wenn das Produkt nicht (mehr) im Katalog
 * steht (ADR-044, T-14.4).
 *
 * Der Fall: Der Nutzer hat ein mitgeliefertes Produkt geloescht, und danach
 * werden die mitgelieferten Rezepte gesaet oder zurueckgesetzt. Die Zutat
 * zeigt dann auf eine ID, die es nicht gibt - der Fremdschluessel wuerde das
 * Einfuegen ablehnen und mit ihm die ganze Transaktion. Statt dessen bleibt
 * die Zutat als Text stehen und zaehlt als "fehlt", genau wie eine Zutat,
 * deren Produkt nach dem Anlegen geloescht wurde (ADR-007, SET NULL).
 *
 * Zutaten ohne productId bleiben, wie sie sind. Reihenfolge und alle anderen
 * Felder bleiben unveraendert.
 */
export function detachMissingProducts<T extends { productId: string | null }>(
  items: T[],
  existingProductIds: string[],
): (Omit<T, 'productId'> & { productId: string | null })[] {
  const existing = new Set(existingProductIds);
  return items.map((item) =>
    item.productId !== null && !existing.has(item.productId) ? { ...item, productId: null } : item,
  );
}

/* ------------------------------------------------------------------ *
 * Hilfen
 * ------------------------------------------------------------------ */

/**
 * Bereinigt die Notiz eines Rezepts: Raender weg, leer wird null, hoechstens
 * MAX_RECIPE_NOTE_LENGTH Zeichen. Zeilenumbrueche im Inneren bleiben - eine
 * Notiz darf zwei Zeilen haben.
 */
export function cleanRecipeNote(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, MAX_RECIPE_NOTE_LENGTH);
}

/**
 * Macht aus den eingegebenen Zutaten die Zeilen eines Rezepts.
 *
 * Namen werden wie Produktnamen bereinigt (cleanProductName); was danach leer
 * ist, faellt weg - eine Zutat ohne Namen kann man weder anzeigen noch
 * einkaufen. Die Positionen werden lueckenlos neu durchgezaehlt, in der
 * Reihenfolge der Eingabe.
 */
export function buildRecipeIngredients(
  items: { productId: string | null; name: string; quantity: number; unit: string }[],
): RecipeIngredient[] {
  return items
    .map((item) => ({ ...item, name: cleanProductName(item.name) }))
    .filter((item) => item.name.length > 0)
    .map((item, index) => ({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      position: index,
    }));
}
