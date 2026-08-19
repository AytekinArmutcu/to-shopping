import { expandForSearch, normalizeForSearch } from '@/lib/text';

export type CatalogProduct = {
  id: string;
  name: string;
  categoryId: string | null;
  defaultUnit: string;
};

export type Suggestion = {
  product: CatalogProduct;
  /** 0 = Treffer am Wortanfang, 1 = Treffer in der Wortmitte. */
  matchQuality: 0 | 1;
};

export type SuggestionResult = {
  suggestions: Suggestion[];
  /**
   * true, wenn die Eingabe kein Produkt exakt trifft. Dann bietet die
   * Oberflaeche "'<Eingabe>' anlegen" als letzten Eintrag an (PRD Flow 1.6).
   */
  canCreate: boolean;
};

export const SUGGESTION_LIMIT = 8;

/**
 * Sucht passende Produkte zu einer Eingabe.
 *
 * Reine Funktion ohne Datenbankzugriff (ADR-008). Die Reihenfolge ist in M2
 * bewusst schlicht: Treffer am Wortanfang zuerst, dann alphabetisch. Die
 * Gewichtung nach Kaufhaeufigkeit und Aktualitaet kommt in M10 dazu - sie
 * braucht Historie, die es jetzt noch nicht gibt.
 *
 * Bereits offen auf der Liste stehende Produkte werden ausgeblendet: Sie ein
 * zweites Mal anzubieten waere ein Fehlklick-Angebot.
 */
export function findSuggestions(
  query: string,
  products: CatalogProduct[],
  productIdsOnList: string[] = [],
  limit: number = SUGGESTION_LIMIT,
): SuggestionResult {
  const needle = normalizeForSearch(query);
  const excluded = new Set(productIdsOnList);

  const matches: Suggestion[] = [];
  let exactMatch = false;

  for (const product of products) {
    // Zwei Schreibweisen desselben Namens: "musli" und "muesli" fuer "Müsli".
    const folded = normalizeForSearch(product.name);
    const expanded = expandForSearch(product.name);

    if (needle.length > 0 && (folded === needle || expanded === needle)) {
      exactMatch = true;
    }

    if (excluded.has(product.id)) {
      continue;
    }

    if (needle.length === 0) {
      matches.push({ product, matchQuality: 0 });
      continue;
    }

    const positions = [folded.indexOf(needle), expanded.indexOf(needle)].filter(
      (index) => index >= 0,
    );
    const position = positions.length > 0 ? Math.min(...positions) : -1;

    if (position === 0) {
      matches.push({ product, matchQuality: 0 });
    } else if (position > 0) {
      matches.push({ product, matchQuality: 1 });
    }
  }

  matches.sort((a, b) => {
    if (a.matchQuality !== b.matchQuality) {
      return a.matchQuality - b.matchQuality;
    }
    // Stabile Reihenfolge bei Gleichstand, damit die Liste nicht springt
    // und der Test ein festes Ergebnis pruefen kann.
    return a.product.name.localeCompare(b.product.name, 'de');
  });

  return {
    suggestions: matches.slice(0, limit),
    canCreate: needle.length > 0 && !exactMatch,
  };
}

/**
 * Bereinigt eine Nutzereingabe, bevor daraus ein Produktname wird.
 *
 * Ohne das entstehen Produkte mit fuehrenden Leerzeichen, die dann als
 * eigenstaendige Eintraege neben dem richtigen stehen.
 */
export function cleanProductName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
