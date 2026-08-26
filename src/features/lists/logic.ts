import { partitionItems } from '@/features/items/logic';

/**
 * Fachlogik der Listenanzeige: die Sortierung aus architecture.md 4.1 und das
 * Umsortieren des Ladenlayouts.
 *
 * Reine Funktionen ohne Datenbankzugriff (ADR-008). Genau das macht die
 * Reihenfolge pruefbar, ohne die App zu starten - und die Reihenfolge ist der
 * Kern von M5: Wenn sie falsch ist, laeuft der Nutzer im Laden zweimal
 * dieselbe Strecke.
 */

export type SectionItem = {
  id: string;
  categoryId: string | null;
  isChecked: boolean;
  position: number;
  createdAt: number;
};

export type CategoryLike = {
  id: string;
  name: string;
  defaultPosition: number;
};

/** Ein Eintrag aus list_category_order: die Reihenfolge dieser einen Liste. */
export type CategoryOrderEntry = {
  categoryId: string;
  position: number;
};

export type ListSection<T> = {
  /** Kategorie-ID, oder CHECKED_SECTION_ID fuer die Erledigten. */
  id: string;
  title: string;
  data: T[];
};

/**
 * Eigene ID fuer den Abschnitt der abgehakten Artikel. Bewusst kein Wert, der
 * als Kategorie-ID vorkommen kann - sonst kollidiert er eines Tages mit einer
 * echten Kategorie.
 */
export const CHECKED_SECTION_ID = '__erledigt__';

/**
 * Bringt die Kategorien in die Reihenfolge dieser Liste (FR-1.3, T-5.4).
 *
 * Eine Liste ohne eigenes Ladenlayout bekommt die Standardreihenfolge - das
 * ist derselbe Rechenweg und keine zweite Verzweigung: Was in der eigenen
 * Reihenfolge nicht vorkommt, landet hinten und sortiert sich dort nach der
 * Standardreihenfolge. Ist die eigene Reihenfolge leer, gilt das fuer alle,
 * und heraus kommt genau die Standardreihenfolge.
 *
 * Der Name als letztes Unterscheidungsmerkmal sorgt dafuer, dass zwei
 * Kategorien mit derselben Position nicht bei jedem Aufruf die Plaetze
 * tauschen - eine Liste, die von selbst springt, wirkt kaputt.
 */
export function orderCategories(
  categories: CategoryLike[],
  customOrder: CategoryOrderEntry[],
): CategoryLike[] {
  const custom = new Map(customOrder.map((entry) => [entry.categoryId, entry.position]));

  return [...categories].sort((a, b) => {
    const positionA = custom.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const positionB = custom.get(b.id) ?? Number.MAX_SAFE_INTEGER;

    if (positionA !== positionB) {
      return positionA - positionB;
    }
    if (a.defaultPosition !== b.defaultPosition) {
      return a.defaultPosition - b.defaultPosition;
    }
    return a.name.localeCompare(b.name, 'de');
  });
}

export type BuildSectionsOptions = {
  showChecked: boolean;
  /** Kategorie, in die Artikel ohne eigene Kategorie einsortiert werden. */
  fallbackCategoryId: string;
  /** Ueberschrift, falls es diese Kategorie nicht gibt. */
  fallbackTitle: string;
  checkedTitle: string;
};

export type BuiltSections<T> = {
  sections: ListSection<T>[];
  openCount: number;
  checkedCount: number;
};

/**
 * Die Listensortierung aus architecture.md 4.1.
 *
 * Abgehakte Artikel kommen nicht zurueck in ihre Kategorie, sondern in einen
 * eigenen Abschnitt am Ende. Grund: Wer "erledigte anzeigen" einschaltet, will
 * nachsehen, was schon im Wagen liegt - verteilt auf zwoelf Abschnitte muesste
 * er dafuer durch die ganze Liste scrollen. Ausserdem bleiben die offenen
 * Abschnitte so frei von Durchgestrichenem, und darauf kommt es im Laden an.
 *
 * Leere Abschnitte entfallen (Schritt 5): Eine Liste mit vier Artikeln soll
 * nicht wie eine Liste mit zwoelf Ueberschriften aussehen.
 */
export function buildListSections<T extends SectionItem>(
  items: T[],
  categories: CategoryLike[],
  customOrder: CategoryOrderEntry[],
  options: BuildSectionsOptions,
): BuiltSections<T> {
  const { visible, openCount, checkedCount } = partitionItems(items, options.showChecked);
  const ordered = orderCategories(categories, customOrder);

  const known = new Set(ordered.map((category) => category.id));
  const byCategory = new Map<string, T[]>();
  const checked: T[] = [];

  for (const item of visible) {
    if (item.isChecked) {
      checked.push(item);
      continue;
    }

    const wanted = item.categoryId ?? options.fallbackCategoryId;
    const key = known.has(wanted) ? wanted : options.fallbackCategoryId;
    const bucket = byCategory.get(key);

    if (bucket) {
      bucket.push(item);
    } else {
      byCategory.set(key, [item]);
    }
  }

  const sections: ListSection<T>[] = [];

  for (const category of ordered) {
    const data = byCategory.get(category.id);
    if (data && data.length > 0) {
      sections.push({ id: category.id, title: category.name, data: sortWithinSection(data) });
      byCategory.delete(category.id);
    }
  }

  // Gibt es die Ersatzkategorie gar nicht, waeren diese Artikel unsichtbar.
  // Ein unsichtbarer Artikel ist schlimmer als eine zusaetzliche Ueberschrift.
  const orphans = byCategory.get(options.fallbackCategoryId);
  if (orphans && orphans.length > 0) {
    sections.push({
      id: options.fallbackCategoryId,
      title: options.fallbackTitle,
      data: sortWithinSection(orphans),
    });
  }

  if (checked.length > 0) {
    sections.push({
      id: CHECKED_SECTION_ID,
      title: options.checkedTitle,
      data: sortWithinSection(checked),
    });
  }

  return { sections, openCount, checkedCount };
}

/**
 * Innerhalb eines Abschnitts: nach position, bei Gleichstand nach createdAt,
 * bei erneutem Gleichstand nach id.
 *
 * Die id als letzte Stufe ist kein Schoenheitsfehler: createdAt hat
 * Millisekundenaufloesung, und beim Uebernehmen mehrerer Artikel aus dem
 * Katalog entstehen sie in derselben Millisekunde. Ohne diese Stufe waere die
 * Reihenfolge zufaellig und der Test nicht wiederholbar.
 */
function sortWithinSection<T extends SectionItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.position !== b.position) {
      return a.position - b.position;
    }
    if (a.createdAt !== b.createdAt) {
      return a.createdAt - b.createdAt;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * Verschiebt eine Kategorie im Ladenlayout von einer Position auf eine andere
 * (T-5.3).
 *
 * Reine Listenarithmetik, absichtlich getrennt von der Wischgeste: Die Geste
 * laesst sich nur auf dem Geraet pruefen, diese Rechnung im Test. Faellt die
 * Reihenfolge falsch aus, liegt es dann nachweislich nicht hieran.
 *
 * Unsinnige Angaben lassen die Reihenfolge unveraendert, statt zu werfen. Eine
 * Geste, die knapp daneben endet, darf keine Fehlermeldung ausloesen.
 */
export function moveCategory(order: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) {
    return [...order];
  }

  const next = [...order];
  const [moved] = next.splice(from, 1);

  if (moved === undefined) {
    return [...order];
  }

  next.splice(to, 0, moved);
  return next;
}

/**
 * Rechnet waehrend des Ziehens aus, auf welchem Platz die Kategorie landen
 * wuerde.
 *
 * Steht hier und nicht in der Geste, weil es die einzige Stelle ist, an der
 * beim Ziehen etwas schiefgehen kann - und die einzige, die sich ohne Finger
 * testen laesst.
 */
export function dropIndex(from: number, offset: number, rowHeight: number, count: number): number {
  // Laeuft waehrend des Ziehens im Reanimated-Thread und deshalb als Worklet.
  // Fuer Jest und jeden anderen Aufrufer bleibt es eine gewoehnliche Funktion.
  'worklet';
  const moved = Math.round(offset / rowHeight);
  return Math.min(Math.max(from + moved, 0), Math.max(count - 1, 0));
}
