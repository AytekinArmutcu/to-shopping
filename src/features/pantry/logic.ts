import type { ProductStats } from '@/features/suggestions/logic';

/**
 * Vorrat: was nach dem Einkauf hineinkommt und was die Checkliste der
 * ueblichen Artikel zeigt (ADR-043, T-13.2).
 *
 * Reine Funktionen ohne Datenbankzugriff (ADR-008). Der Vorrat selbst ist nur
 * eine Menge von Produkt-IDs - die eigentliche Arbeit steckt darin, welche
 * Produkte auf der Checkliste stehen und in welcher Reihenfolge.
 */

/**
 * Produkt-IDs, die nach einem abgeschlossenen Einkauf in den Vorrat gehoeren.
 *
 * Nur Artikel mit Produktbezug (ADR-043): Ein Listeneintrag ohne productId hat
 * kein Katalogprodukt, an dem ein Vorratshaken haengen koennte. Doppelte IDs
 * werden einmal genommen - wer Milch zweimal auf der Liste hatte, hat danach
 * trotzdem nur "Milch ist da".
 */
export function pantryAdditions(drafts: { productId: string | null }[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const draft of drafts) {
    const id = draft.productId;
    if (id === null || id.length === 0 || seen.has(id)) {
      continue;
    }
    seen.add(id);
    result.push(id);
  }

  return result;
}

export interface PantryChecklistItem {
  productId: string;
  name: string;
  inPantry: boolean;
}

export interface PantrySection {
  /**
   * Kategorie-ID. Das Feld heisst "key" und nicht "id", weil SectionList genau
   * diesen Namen liest - siehe ListSection in features/lists/logic.ts, dort
   * ist der Absturz beschrieben, den ein fehlender Schluessel ausloest.
   */
  key: string;
  title: string;
  items: PantryChecklistItem[];
}

/**
 * Die Checkliste der ueblichen Artikel (ADR-043).
 *
 * Ein Produkt steht darauf, wenn es Kaufhistorie hat oder gerade im Vorrat
 * liegt. Nur der Vorrat waere zu wenig: Was fehlt, soll man ja gerade sehen.
 * Der ganze Katalog waere zu viel: 200 Produkte, von denen der Nutzer die
 * meisten nie kauft.
 *
 * Gruppiert wie die Einkaufsliste nach Abteilungen in der Standardreihenfolge.
 * Produkte ohne oder mit unbekannter Kategorie landen in der Ersatzkategorie,
 * statt zu verschwinden - ein unsichtbarer Artikel ist schlimmer als eine
 * zusaetzliche Ueberschrift.
 */
export function buildPantryChecklist(
  products: { id: string; name: string; categoryId: string | null }[],
  stats: ProductStats[],
  pantryProductIds: string[],
  categories: { id: string; name: string; defaultPosition: number }[],
  fallbackCategoryId = 'sonstiges',
): PantrySection[] {
  const purchased = new Set(
    stats.filter((entry) => entry.purchaseCount > 0).map((entry) => entry.productId),
  );
  const inPantry = new Set(pantryProductIds);

  const ordered = [...categories].sort((a, b) => {
    if (a.defaultPosition !== b.defaultPosition) {
      return a.defaultPosition - b.defaultPosition;
    }
    return a.name.localeCompare(b.name, 'de');
  });
  const known = new Set(ordered.map((category) => category.id));

  const byCategory = new Map<string, PantryChecklistItem[]>();

  for (const product of products) {
    if (!purchased.has(product.id) && !inPantry.has(product.id)) {
      continue;
    }

    const wanted = product.categoryId ?? fallbackCategoryId;
    const key = known.has(wanted) ? wanted : fallbackCategoryId;
    const item: PantryChecklistItem = {
      productId: product.id,
      name: product.name,
      inPantry: inPantry.has(product.id),
    };

    const bucket = byCategory.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      byCategory.set(key, [item]);
    }
  }

  const sections: PantrySection[] = [];

  for (const category of ordered) {
    const items = byCategory.get(category.id);
    if (items && items.length > 0) {
      sections.push({ key: category.id, title: category.name, items: sortByName(items) });
      byCategory.delete(category.id);
    }
  }

  // Gibt es die Ersatzkategorie nicht, bekommt der Abschnitt ihre ID als
  // Titel. Unschoen, aber sichtbar - der Aufrufer liefert die Kategorien
  // normalerweise vollstaendig.
  const orphans = byCategory.get(fallbackCategoryId);
  if (orphans && orphans.length > 0) {
    sections.push({
      key: fallbackCategoryId,
      title: fallbackCategoryId,
      items: sortByName(orphans),
    });
  }

  return sections;
}

/**
 * Alphabetisch nach deutschem Alphabet: "Aepfel" mit Umlaut steht bei A, nicht
 * hinter Z. Die productId als letzte Stufe haelt gleichnamige Produkte in
 * fester Reihenfolge, damit die Checkliste nicht springt.
 */
function sortByName(items: PantryChecklistItem[]): PantryChecklistItem[] {
  return [...items].sort((a, b) => {
    const byName = a.name.localeCompare(b.name, 'de');
    return byName !== 0 ? byName : a.productId.localeCompare(b.productId);
  });
}

/** Alle Produkt-IDs ohne Haken, in Anzeigereihenfolge - fuer "Fehlende auf die Liste". */
export function missingProductIds(sections: PantrySection[]): string[] {
  return sections.flatMap((section) =>
    section.items.filter((item) => !item.inPantry).map((item) => item.productId),
  );
}

/** Anzahl der fehlenden Artikel, etwa fuer die Beschriftung des Knopfs. */
export function countMissing(sections: PantrySection[]): number {
  return missingProductIds(sections).length;
}

/** Anzahl der Artikel mit Haken - fuer den Kopf "23 da · 4 fehlen" (ADR-049). */
export function countInPantry(sections: PantrySection[]): number {
  return sections.reduce(
    (sum, section) => sum + section.items.filter((item) => item.inPantry).length,
    0,
  );
}
