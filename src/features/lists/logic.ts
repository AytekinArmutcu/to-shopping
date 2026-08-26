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
  /**
   * Kategorie-ID, oder CHECKED_SECTION_ID fuer die Erledigten.
   *
   * Das Feld heisst "key" und nicht "id", weil SectionList genau diesen Namen
   * liest. Fehlt er, nimmt die Liste die Position als Schluessel - und wenn
   * dann zwei Abschnitte die Plaetze tauschen, behalten beide ihren
   * Schluessel. React haelt sie fuer dieselben Abschnitte, haengt die Views
   * um, und die App stuerzt ab ("The specified child already has a parent").
   * Genau das ist auf dem Geraet passiert, als das Ladenlayout zurueckgesetzt
   * wurde.
   */
  key: string;
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
      sections.push({ key: category.id, title: category.name, data: sortWithinSection(data) });
      byCategory.delete(category.id);
    }
  }

  // Gibt es die Ersatzkategorie gar nicht, waeren diese Artikel unsichtbar.
  // Ein unsichtbarer Artikel ist schlimmer als eine zusaetzliche Ueberschrift.
  const orphans = byCategory.get(options.fallbackCategoryId);
  if (orphans && orphans.length > 0) {
    sections.push({
      key: options.fallbackCategoryId,
      title: options.fallbackTitle,
      data: sortWithinSection(orphans),
    });
  }

  if (checked.length > 0) {
    sections.push({
      key: CHECKED_SECTION_ID,
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

/* ------------------------------------------------------------------ *
 * M6: mehrere Listen nebeneinander
 * ------------------------------------------------------------------ */

export type ListLike = {
  id: string;
  name: string;
  position: number;
};

export type OpenCount = {
  listId: string;
  openCount: number;
};

export type ListOverviewRow = {
  id: string;
  name: string;
  openCount: number;
};

/**
 * Die Listenuebersicht mit der Anzahl offener Artikel (FR-1.4).
 *
 * Sortiert nach der Reihenfolge des Anlegens, nicht nach der letzten Nutzung.
 * Eine Uebersicht, die sich bei jedem Oeffnen umsortiert, zwingt den Nutzer,
 * seine Liste jedes Mal neu zu suchen - und die Zielgruppe soll nichts suchen
 * muessen. Bei zwei bis fuenf Listen kostet die feste Reihenfolge nichts.
 *
 * Listen ohne Eintrag in der Zaehlung stehen auf null, statt zu fehlen: Eine
 * leere Liste ist eine Liste.
 */
export function buildListOverview(lists: ListLike[], counts: OpenCount[]): ListOverviewRow[] {
  const byList = new Map(counts.map((entry) => [entry.listId, entry.openCount]));

  return [...lists]
    .sort((a, b) => {
      if (a.position !== b.position) {
        return a.position - b.position;
      }
      if (a.name !== b.name) {
        return a.name.localeCompare(b.name, 'de');
      }
      return a.id.localeCompare(b.id);
    })
    .map((list) => ({
      id: list.id,
      name: list.name,
      openCount: byList.get(list.id) ?? 0,
    }));
}

/** Laenge eines Listennamens. Was laenger ist, passt in keine Zeile. */
export const MAX_LIST_NAME_LENGTH = 60;

/**
 * Bereinigt einen eingegebenen Listennamen.
 *
 * Leer heisst null: Der Aufrufer entscheidet dann, ob er ablehnt oder einen
 * Standardnamen setzt. Eine Liste, die "   " heisst, waere in der Uebersicht
 * unsichtbar.
 */
export function cleanListName(value: string): string | null {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, MAX_LIST_NAME_LENGTH);
}

/**
 * Findet einen freien Namen fuer eine Kopie (T-6.3).
 *
 * "Wocheneinkauf" wird zu "Wocheneinkauf (Kopie)", beim naechsten Mal zu
 * "Wocheneinkauf (Kopie 2)". Zwei Listen mit demselben Namen waeren in der
 * Uebersicht nicht auseinanderzuhalten - und genau dort trifft der Nutzer
 * seine Wahl.
 *
 * Die Namen werden ohne Ruecksicht auf Gross-/Kleinschreibung verglichen, weil
 * "Kopie" und "kopie" fuer das Auge dasselbe sind.
 */
export function copyName(original: string, existingNames: string[], suffix: string): string {
  const taken = new Set(existingNames.map((name) => name.toLowerCase()));

  const first = `${original} (${suffix})`;
  if (!taken.has(first.toLowerCase())) {
    return first.slice(0, MAX_LIST_NAME_LENGTH);
  }

  for (let counter = 2; counter < 1000; counter += 1) {
    const candidate = `${original} (${suffix} ${counter})`;
    if (!taken.has(candidate.toLowerCase())) {
      return candidate.slice(0, MAX_LIST_NAME_LENGTH);
    }
  }

  return first.slice(0, MAX_LIST_NAME_LENGTH);
}

/* ------------------------------------------------------------------ *
 * Startroute (FR-1.5)
 * ------------------------------------------------------------------ */

export const ROUTE_OVERVIEW = '/listen';

/** Route einer einzelnen Liste. Eine Stelle, damit sie nirgends abweicht. */
export function listRoute(listId: string): string {
  return `/liste?listId=${encodeURIComponent(listId)}`;
}

/** Liest die Listen-ID aus einer Route, oder null, wenn es keine Listenroute ist. */
export function parseListRoute(route: string): string | null {
  const match = /^\/liste\?listId=([^&]+)$/.exec(route);
  const raw = match?.[1];

  if (raw === undefined || raw.length === 0) {
    return null;
  }

  try {
    return decodeURIComponent(raw);
  } catch {
    // Kaputt gespeicherte Route: lieber zur Uebersicht als abstuerzen.
    return null;
  }
}

/**
 * Entscheidet, womit die App startet (FR-1.5).
 *
 * Alles, was nicht als bekannte Route erkannt wird, endet in der Uebersicht.
 * Die gespeicherte Route stammt zwar aus der eigenen Datenbank, aber sie
 * ueberlebt App-Aktualisierungen: Eine Route, die es in der neuen Fassung
 * nicht mehr gibt, wuerde den Start sonst auf einen leeren Bildschirm fuehren.
 *
 * Ob die Liste hinter der Route noch existiert, prueft diese Funktion nicht -
 * das braucht die Datenbank und gehoert deshalb nicht hierher.
 */
export function resolveStartRoute(stored: string | null): string {
  if (stored === null || stored === ROUTE_OVERVIEW) {
    return ROUTE_OVERVIEW;
  }
  return parseListRoute(stored) === null ? ROUTE_OVERVIEW : stored;
}
