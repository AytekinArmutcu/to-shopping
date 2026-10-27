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

/** Laenge eines Zubereitungsschritts - ein Schritt ist Text, kein Kapitel (ADR-047). */
export const MAX_STEP_LENGTH = 500;

/*
 * Grundvorrat (FR-10.10, ADR-047): Salz, Pfeffer, Oel stehen im Rezept, weil
 * man sie braucht - aber wuerde jedes Gericht "3 fehlen: Salz, Pfeffer, Oel"
 * zeigen, bis der Vorrat sie kennt, waere die Zahl nur Rauschen. Deshalb gilt
 * eine Zutat, deren Produkt Grundvorrat ist, nie als fehlend und geht nie
 * automatisch auf die Liste. Das Kennzeichen haengt am Produkt; eine Zutat
 * ohne productId kann deshalb nie Grundvorrat sein. Der Grundvorrat wird vor
 * dem Vorrat geprueft: Liegt Salz zufaellig auch im Vorrat, bleibt es
 * trotzdem Grundvorrat - so zeigt die Ansicht es immer mit demselben
 * Kennzeichen.
 */
function isStaple(item: { productId: string | null }, staples: Set<string>): boolean {
  return item.productId !== null && staples.has(item.productId);
}

/* ------------------------------------------------------------------ *
 * Zutat gegen Vorrat und Liste
 * ------------------------------------------------------------------ */

export type IngredientStatus = 'staple' | 'have' | 'onList' | 'missing';

export interface RecipeShoppingPlan<T> {
  /** Produkt ist Grundvorrat - fehlt nie, geht nie automatisch auf die Liste (ADR-047). */
  staple: T[];
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
 * Grundvorrat schlaegt beides (ADR-047, siehe isStaple): Eine Zutat, deren
 * Produkt in stapleProductIds steht, landet in "staple" - auch wenn sie im
 * Vorrat liegt oder offen auf der Liste steht. Ohne stapleProductIds (der
 * Standard) ist "staple" leer und alles verhaelt sich wie vor T-16.3.
 *
 * Jede Gruppe behaelt die Reihenfolge der Eingabe.
 */
export function planRecipeShopping<T extends { productId: string | null; name: string }>(
  items: T[],
  pantryProductIds: string[],
  openListItems: TargetItem[],
  stapleProductIds: string[] = [],
): RecipeShoppingPlan<T> {
  const pantry = new Set(pantryProductIds);
  const staples = new Set(stapleProductIds);
  const statuses: IngredientStatus[] = items.map((item) => {
    if (isStaple(item, staples)) {
      return 'staple';
    }
    return item.productId !== null && pantry.has(item.productId) ? 'have' : 'missing';
  });

  // Ueber den Index statt ueber das Objekt selbst zuordnen: Dasselbe Objekt
  // kann zweimal in der Eingabe stehen, dann waere die Identitaet mehrdeutig.
  const candidates = items
    .map((item, index) => ({ productId: item.productId, name: item.name, index }))
    .filter((candidate) => statuses[candidate.index] === 'missing');

  for (const candidate of planTemplateApply(candidates, openListItems).skipped) {
    statuses[candidate.index] = 'onList';
  }

  const plan: RecipeShoppingPlan<T> = { staple: [], have: [], onList: [], missing: [] };
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
 * Grundvorrat fehlt nie (ADR-047, siehe isStaple): Er zaehlt weder in
 * missingCount noch erscheint er in missingNames. totalCount bleibt die Zahl
 * aller Zutaten, Grundvorrat eingeschlossen - die Zeile zeigt, wie gross das
 * Rezept ist.
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
  stapleProductIds: string[] = [],
): RecipeOverviewRow[] {
  const pantry = new Set(pantryProductIds);
  const planned = new Set(plannedRecipeIds);
  const staples = new Set(stapleProductIds);

  const rows = recipes.map((recipe): RecipeOverviewRow => {
    const items = [...ingredientsOf(itemsByRecipe, recipe.id)].sort(
      (a, b) => a.position - b.position,
    );
    const missing = items.filter(
      (item) =>
        !isStaple(item, staples) && (item.productId === null || !pantry.has(item.productId)),
    );

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
  /**
   * Grundvorrat-Zutaten ueber alle Rezepte gezaehlt (ADR-047). Getrennt von
   * skipped: Sie wurden nicht uebersprungen, sie waren nie gefragt.
   */
  staples: number;
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
 *
 * Grundvorrat (ADR-047, siehe isStaple) kommt nie auf die Liste und zaehlt
 * nicht in skipped, sondern - ebenfalls vor der Vereinigung - in staples.
 */
export function planWeeklyShopping(
  plannedItems: RecipeIngredient[][],
  pantryProductIds: string[],
  openListItems: TargetItem[],
  stapleProductIds: string[] = [],
): WeeklyShoppingPlan {
  const productIds: string[] = [];
  const unresolvedNames: string[] = [];
  const seenProducts = new Set<string>();
  const seenNames = new Set<string>();
  let skipped = 0;
  let staples = 0;

  for (const items of plannedItems) {
    const plan = planRecipeShopping(items, pantryProductIds, openListItems, stapleProductIds);
    skipped += plan.have.length + plan.onList.length;
    staples += plan.staple.length;

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

  return { productIds, unresolvedNames, skipped, staples };
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

/* ------------------------------------------------------------------ *
 * Zubereitungsschritte
 * ------------------------------------------------------------------ */

export interface RecipeStepLike {
  position: number;
  text: string;
}

/**
 * Macht aus den eingegebenen Texten die Schritte eines Rezepts (FR-10.9,
 * ADR-047: ein Schritt ist nur Text).
 *
 * Innerhalb einer Zeile werden Leerzeichen und Tabs zu einem Leerzeichen
 * zusammengezogen und die Zeilenraender abgeschnitten; Zeilenumbrueche bleiben
 * stehen - ein Schritt darf mehrzeilig sein. Was danach leer ist, faellt weg.
 * Zu lange Schritte werden auf MAX_STEP_LENGTH Zeichen gekuerzt. Die
 * Positionen werden lueckenlos neu durchgezaehlt, in der Reihenfolge der
 * Eingabe.
 */
export function cleanRecipeSteps(texts: string[]): RecipeStepLike[] {
  return texts
    .map((text) =>
      text
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .join('\n')
        .trim()
        .slice(0, MAX_STEP_LENGTH)
        .trimEnd(),
    )
    .filter((text) => text.length > 0)
    .map((text, index) => ({ position: index, text }));
}

/**
 * Verschiebt einen Schritt von Index from nach Index to - fuer die Pfeile im
 * Bearbeiten (ADR-028: jede Umsortierung auch per Antippen). Gibt immer ein
 * neues Array zurueck. Ein ungueltiger Index (ausserhalb, keine ganze Zahl)
 * aendert nichts an der Reihenfolge.
 */
export function moveStep<T>(steps: T[], from: number, to: number): T[] {
  const result = [...steps];
  const valid = (index: number) => Number.isInteger(index) && index >= 0 && index < steps.length;
  if (!valid(from) || !valid(to) || from === to) {
    return result;
  }
  const moved = result.splice(from, 1);
  result.splice(to, 0, ...moved);
  return result;
}
