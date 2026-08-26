import { expandForSearch, normalizeForSearch } from '@/lib/text';

export type CatalogProduct = {
  id: string;
  name: string;
  categoryId: string | null;
  defaultUnit: string;
};

/** Wie viele Vorschlaege hoechstens erscheinen (architecture.md 4.2). */
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
  /**
   * Kategorie-ID, oder '' fuer den Sammelabschnitt ohne Kategorie.
   *
   * Heisst "key", weil SectionList diesen Namen liest - siehe die
   * ausfuehrliche Begruendung an ListSection in features/lists/logic.ts.
   */
  key: string;
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
      sections.push({ key: category.id, title: category.name, data: sortByName(data) });
    }
  }

  const orphans = byCategory.get('');
  if (orphans && orphans.length > 0) {
    sections.push({ key: '', title: fallbackTitle, data: sortByName(orphans) });
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

/* ------------------------------------------------------------------ *
 * M7: Katalogpflege
 * ------------------------------------------------------------------ */

export type NamedProduct = {
  id: string;
  name: string;
};

/**
 * Traegt ein anderes Produkt diesen Namen schon (FR-4.2)?
 *
 * Verglichen wird ohne Ruecksicht auf Gross- und Kleinschreibung, weil der
 * eindeutige Index in der Datenbank es genauso haelt (siehe schema.ts). Ohne
 * diese Pruefung liefe der Nutzer in einen Datenbankfehler statt in eine
 * verstaendliche Meldung.
 *
 * "ignoreId" ist das Produkt, das gerade bearbeitet wird - es darf seinen
 * eigenen Namen behalten, sonst waere jede Aenderung der Kategorie blockiert.
 */
export function hasNameConflict(
  name: string,
  products: NamedProduct[],
  ignoreId?: string,
): boolean {
  const needle = cleanProductName(name).toLowerCase();

  if (needle.length === 0) {
    return false;
  }

  return products.some(
    (product) => product.id !== ignoreId && product.name.toLowerCase() === needle,
  );
}

export type ResettableProduct = {
  id: string;
  name: string;
};

export type CatalogResetPlan<T> = {
  /** Wird auf den Auslieferungszustand zurueckgesetzt oder neu angelegt. */
  restore: T[];
  /**
   * Bleibt aussen vor, weil ein anderes Produkt diesen Namen traegt. Ohne die
   * Trennung liefe das Zuruecksetzen in den eindeutigen Index und schluege
   * ganz fehl - eine einzelne Namenskollision darf nicht den ganzen Katalog
   * blockieren.
   */
  blocked: T[];
};

/**
 * Plant das Zuruecksetzen des Katalogs (FR-4.4, T-7.4).
 *
 * Mitgelieferte Produkte kehren in den Auslieferungszustand zurueck, geloeschte
 * kommen wieder. Eigene Produkte werden nicht angefasst - sie sind die Arbeit
 * des Nutzers, und "zuruecksetzen" bezieht sich auf das, was die App
 * mitgebracht hat (ADR-031).
 *
 * Reine Funktion ohne Datenbankzugriff (ADR-008).
 */
export function planCatalogReset<T extends ResettableProduct>(
  seed: T[],
  existing: ResettableProduct[],
): CatalogResetPlan<T> {
  // Wer haelt welchen Namen? Nur fremde Halter sind ein Hindernis; traegt das
  // mitgelieferte Produkt seinen Namen selbst, ist alles in Ordnung.
  const holderByName = new Map(existing.map((product) => [product.name.toLowerCase(), product.id]));

  const restore: T[] = [];
  const blocked: T[] = [];

  for (const product of seed) {
    const holder = holderByName.get(product.name.toLowerCase());

    if (holder === undefined || holder === product.id) {
      restore.push(product);
    } else {
      blocked.push(product);
    }
  }

  return { restore, blocked };
}
