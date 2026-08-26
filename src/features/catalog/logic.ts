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
 * Wo im Produktnamen steht die Suche? -1 heisst: nirgends.
 *
 * Der Name wird in zwei Schreibweisen geprueft - "musli" und "muesli" sollen
 * beide "Müsli" finden. Die Eingabe selbst wird dabei nie umgeschrieben, nur
 * verglichen (siehe src/lib/text.ts).
 *
 * Die Eingabe muss bereits normalisiert sein; der Aufrufer tut das einmal
 * statt einmal je Produkt.
 */
export function matchPosition(name: string, normalizedQuery: string): number {
  if (normalizedQuery.length === 0) {
    return 0;
  }

  const positions = [
    normalizeForSearch(name).indexOf(normalizedQuery),
    expandForSearch(name).indexOf(normalizedQuery),
  ].filter((index) => index >= 0);

  return positions.length > 0 ? Math.min(...positions) : -1;
}

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

    const position = matchPosition(product.name, needle);

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

export type CatalogCategory = {
  id: string;
  name: string;
  defaultPosition: number;
};

export type CatalogSection = {
  /** Kategorie-ID, oder '' fuer den Sammelabschnitt ohne Kategorie. */
  id: string;
  title: string;
  data: CatalogProduct[];
};

/**
 * Baut den Katalog-Screen: Produkte nach Kategorien gruppiert, gefiltert
 * durch die Suche (FR-4.3).
 *
 * Reine Funktion ohne Datenbankzugriff (ADR-008). Die Reihenfolge der
 * Kategorien ist hier die Standardreihenfolge aus dem Seed, nicht das
 * Ladenlayout: Der Katalog ist eine Nachschlagehilfe, keine Laufstrecke.
 * Das Ladenlayout betrifft die Liste und kommt in M5.
 *
 * Leere Abschnitte fallen weg. Waehrend der Suche bleibt sonst ein Bildschirm
 * voller Ueberschriften ohne Inhalt uebrig, durch den man scrollen muss.
 *
 * Produkte ohne Kategorie - oder mit einer geloeschten - landen gesammelt am
 * Ende, statt unsichtbar zu sein. Ein unsichtbares Produkt waere fuer den
 * Nutzer ein verlorenes Produkt.
 */
export function buildCatalogSections(
  products: CatalogProduct[],
  categories: CatalogCategory[],
  query: string,
  fallbackTitle: string,
): CatalogSection[] {
  const needle = normalizeForSearch(query);

  const ordered = [...categories].sort((a, b) => {
    if (a.defaultPosition !== b.defaultPosition) {
      return a.defaultPosition - b.defaultPosition;
    }
    return a.name.localeCompare(b.name, 'de');
  });

  const known = new Set(ordered.map((category) => category.id));
  const byCategory = new Map<string, CatalogProduct[]>();

  for (const product of products) {
    if (matchPosition(product.name, needle) < 0) {
      continue;
    }

    const key = product.categoryId && known.has(product.categoryId) ? product.categoryId : '';
    const bucket = byCategory.get(key);

    if (bucket) {
      bucket.push(product);
    } else {
      byCategory.set(key, [product]);
    }
  }

  const sections: CatalogSection[] = [];

  for (const category of ordered) {
    const data = byCategory.get(category.id);
    if (data && data.length > 0) {
      sections.push({ id: category.id, title: category.name, data: sortByName(data) });
    }
  }

  const orphans = byCategory.get('');
  if (orphans && orphans.length > 0) {
    sections.push({ id: '', title: fallbackTitle, data: sortByName(orphans) });
  }

  return sections;
}

function sortByName(products: CatalogProduct[]): CatalogProduct[] {
  return [...products].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/**
 * Welche der ausgewaehlten Produkte kommen tatsaechlich auf die Liste (T-4.4)?
 *
 * Was offen schon draufsteht, wird uebersprungen - zwei Zeilen "Milch"
 * untereinander sind ein Fehler, kein Wunsch. Abgehakte Artikel zaehlen nicht
 * dazu: Wer Milch abgehakt hat und sie erneut auswaehlt, will sie wirklich
 * noch einmal.
 *
 * Die Auswahlreihenfolge bleibt erhalten, damit die Artikel in der Liste in
 * der Reihenfolge auftauchen, in der sie angetippt wurden.
 */
export function idsToAdd(selectedIds: string[], productIdsOnList: string[]): string[] {
  const onList = new Set(productIdsOnList);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of selectedIds) {
    if (onList.has(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    result.push(id);
  }

  return result;
}
