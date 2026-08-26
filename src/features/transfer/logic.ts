import { DEFAULT_UNIT, isUnit } from '@/db/units';
import { formatQuantity } from '@/features/items/logic';
import { slugify } from '@/lib/slug';

/**
 * Das Format der geteilten Liste (architecture.md 5.1) und alles, was zum
 * Lesen und Schreiben gehoert.
 *
 * Reine Funktionen ohne Datenbankzugriff (ADR-008). Das ist hier besonders
 * wichtig: Eine kaputte oder fremde Datei darf die App nicht umbringen, und
 * genau diese Faelle lassen sich nur pruefen, wenn das Einlesen ohne
 * Datenbank auskommt.
 *
 * Kategorien reisen als **Name**, nicht als ID: Die IDs des Empfaengers sind
 * andere. Produkte ebenso - deshalb traegt jeder Eintrag seinen Namen als
 * Kopie (ADR-007), und der Import sucht sich das passende Produkt selbst.
 */

export const SHARED_LIST_FORMAT = 'to-shopping.list';

/**
 * Wird bei jeder nicht rueckwaertskompatiblen Aenderung erhoeht. Eine Datei
 * mit hoeherer Version wird abgelehnt statt halb verstanden - halb verstanden
 * hiesse: stillschweigend falsche Mengen auf der Liste.
 */
export const SHARED_LIST_VERSION = 1;

export type SharedItem = {
  name: string;
  category: string | null;
  quantity: number;
  unit: string;
  note: string | null;
};

export type SharedList = {
  name: string;
  categoryOrder: string[];
  items: SharedItem[];
};

export type SharedListFile = {
  format: typeof SHARED_LIST_FORMAT;
  version: number;
  exportedAt: string;
  list: SharedList;
};

export type ParseFailure =
  /** Kein JSON, oder die Grundstruktur fehlt. */
  | 'unlesbar'
  /** JSON, aber nicht von dieser App. */
  | 'fremdesFormat'
  /** Aus einer neueren Fassung der App. */
  | 'zuNeu';

export type ParseResult =
  { ok: true; file: SharedListFile; skipped: number } | { ok: false; reason: ParseFailure };

/** Baut die Datei aus dem, was die Liste hergibt. */
export function buildSharedList(
  name: string,
  items: SharedItem[],
  categoryOrder: string[],
  exportedAt: Date = new Date(),
): SharedListFile {
  return {
    format: SHARED_LIST_FORMAT,
    version: SHARED_LIST_VERSION,
    exportedAt: exportedAt.toISOString(),
    list: { name, categoryOrder, items },
  };
}

export function serializeSharedList(file: SharedListFile): string {
  // Eingerueckt, weil die Datei auch ohne die App lesbar sein soll - sie
  // landet in Messengern, in denen sie jemand einfach oeffnet.
  return JSON.stringify(file, null, 2);
}

/**
 * Liest eine empfangene Datei (FR-6.2).
 *
 * Grundsatz: misstrauisch gegenueber allem, was von aussen kommt. Die Datei
 * stammt aus einem Messenger und kann alles sein - abgeschnitten, veraendert,
 * oder schlicht eine andere Datei mit derselben Endung.
 *
 * Einzelne unbrauchbare Eintraege werden uebersprungen und gezaehlt, statt die
 * ganze Datei abzulehnen: Eine Liste mit neun von zehn Artikeln ist mehr wert
 * als gar keine - solange der Empfaenger die Zahl erfaehrt.
 */
export function parseSharedList(raw: string): ParseResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'unlesbar' };
  }

  if (!isRecord(parsed)) {
    return { ok: false, reason: 'unlesbar' };
  }

  if (parsed.format !== SHARED_LIST_FORMAT) {
    return { ok: false, reason: 'fremdesFormat' };
  }

  const version = parsed.version;
  if (typeof version !== 'number' || !Number.isFinite(version) || version < 1) {
    return { ok: false, reason: 'unlesbar' };
  }
  if (version > SHARED_LIST_VERSION) {
    return { ok: false, reason: 'zuNeu' };
  }

  const list = parsed.list;
  if (!isRecord(list) || typeof list.name !== 'string' || !Array.isArray(list.items)) {
    return { ok: false, reason: 'unlesbar' };
  }

  const items: SharedItem[] = [];
  let skipped = 0;

  for (const candidate of list.items) {
    const item = readItem(candidate);
    if (item === null) {
      skipped += 1;
    } else {
      items.push(item);
    }
  }

  const name = list.name.trim();

  return {
    ok: true,
    skipped,
    file: {
      format: SHARED_LIST_FORMAT,
      version,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
      list: {
        name,
        categoryOrder: readStringArray(list.categoryOrder),
        items,
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

/**
 * Ein einzelner Eintrag. Nur der Name ist Pflicht - alles andere hat einen
 * sinnvollen Ersatzwert, weil ein fehlendes Feld kein Grund ist, einen
 * Artikel wegzuwerfen.
 */
function readItem(value: unknown): SharedItem | null {
  if (!isRecord(value) || typeof value.name !== 'string') {
    return null;
  }

  const name = value.name.trim();
  if (name.length === 0) {
    return null;
  }

  const quantity =
    typeof value.quantity === 'number' && Number.isFinite(value.quantity) && value.quantity > 0
      ? value.quantity
      : 1;

  return {
    name,
    category:
      typeof value.category === 'string' && value.category.trim().length > 0
        ? value.category.trim()
        : null,
    quantity,
    unit: typeof value.unit === 'string' && isUnit(value.unit) ? value.unit : DEFAULT_UNIT,
    note: typeof value.note === 'string' && value.note.trim().length > 0 ? value.note.trim() : null,
  };
}

/* ------------------------------------------------------------------ *
 * Lesbare Fassung fuer den Nachrichtentext (T-8.2)
 * ------------------------------------------------------------------ */

export type ShareTextLabels = {
  /** Fertige Kopfzeile, z. B. 'Einkaufsliste „Rewe" (2 Artikel)'. */
  header: string;
  /** Kurzform einer Einheit, aus der Uebersetzungsdatei. */
  unitShort: (unit: string) => string;
};

/**
 * Die lesbare Fassung, die neben der Datei verschickt wird (PRD Flow 3.3).
 *
 * Sie ist der eigentliche Nutzen fuer den haeufigsten Fall: Der Empfaenger hat
 * die App nicht. Eine Datei allein waere fuer ihn wertlos, ein Text allein
 * fuer einen Empfaenger mit App unnoetig muehsam - deshalb beides.
 *
 * Die Texte kommen als Parameter herein, damit die Funktion rein bleibt und
 * kein sichtbarer Text im Code steht (CLAUDE.md).
 */
export function buildShareText(items: SharedItem[], labels: ShareTextLabels): string {
  const lines = items.map((item) => {
    const quantity = formatQuantity(item, labels.unitShort(item.unit));
    const note = item.note === null ? '' : ` (${item.note})`;
    return `• ${quantity === null ? '' : `${quantity} `}${item.name}${note}`;
  });

  return [labels.header, ...lines].join('\n');
}

/* ------------------------------------------------------------------ *
 * Import (T-8.5, architecture.md 4.5)
 * ------------------------------------------------------------------ */

export type KnownProduct = {
  id: string;
  name: string;
};

export type KnownCategory = {
  id: string;
  name: string;
};

export type PlannedProduct = {
  id: string;
  name: string;
  categoryId: string;
};

export type PlannedItem = {
  name: string;
  productId: string;
  categoryId: string;
  quantity: number;
  unit: string;
  note: string | null;
  position: number;
};

export type ImportPlan = {
  newProducts: PlannedProduct[];
  items: PlannedItem[];
  /** Lokale Kategorie-IDs in der Reihenfolge aus der Datei. */
  categoryOrder: string[];
};

/**
 * Plant den Import einer empfangenen Liste (FR-6.2, FR-6.3).
 *
 * Produkte werden ueber den **Namen** zugeordnet, ohne Ruecksicht auf Gross-
 * und Kleinschreibung - genauso, wie der eindeutige Index in der Datenbank es
 * haelt. Fehlt ein Produkt, wird es angelegt statt uebersprungen: Der
 * Empfaenger soll die Liste vollstaendig bekommen, und beim naechsten Mal
 * kennt seine App das Produkt schon (FR-6.3).
 *
 * Kategorien kommen als Name herein. Was der Empfaenger nicht kennt, landet in
 * der Ersatzkategorie - eine fremde Kategorie anzulegen waere aufdringlich:
 * Das Ladenlayout des Empfaengers gehoert ihm.
 *
 * Reine Funktion ohne Datenbankzugriff (ADR-008), damit sich genau diese
 * Faelle ohne fremdes Geraet pruefen lassen.
 */
export function planImport(
  file: SharedListFile,
  products: KnownProduct[],
  categories: KnownCategory[],
  fallbackCategoryId: string,
): ImportPlan {
  const productByName = new Map(
    products.map((product) => [product.name.toLowerCase(), product.id]),
  );
  const categoryByName = new Map(
    categories.map((category) => [category.name.toLowerCase(), category.id]),
  );
  const takenIds = new Set(products.map((product) => product.id));

  const newProducts: PlannedProduct[] = [];
  const items: PlannedItem[] = [];

  file.list.items.forEach((item, position) => {
    const categoryId =
      item.category === null
        ? fallbackCategoryId
        : (categoryByName.get(item.category.toLowerCase()) ?? fallbackCategoryId);

    const key = item.name.toLowerCase();
    let productId = productByName.get(key);

    if (productId === undefined) {
      productId = freeProductId(item.name, takenIds);
      takenIds.add(productId);
      productByName.set(key, productId);
      newProducts.push({ id: productId, name: item.name, categoryId });
    }

    items.push({
      name: item.name,
      productId,
      categoryId,
      quantity: item.quantity,
      unit: item.unit,
      note: item.note,
      position,
    });
  });

  return {
    newProducts,
    items,
    categoryOrder: file.list.categoryOrder
      .map((name) => categoryByName.get(name.toLowerCase()))
      .filter((id): id is string => id !== undefined),
  };
}

/**
 * Sucht eine freie Produkt-ID.
 *
 * Zwei verschiedene Namen koennen zur selben Kennung werden ("Öl" und "Oel"),
 * und der Empfaenger kann die Kennung schon fuer etwas anderes vergeben haben.
 * Ohne diese Schleife scheitert der Import am Primaerschluessel - und zwar
 * mitten in der Transaktion, also vollstaendig.
 */
function freeProductId(name: string, taken: Set<string>): string {
  const base = `p-${slugify(name)}`;

  if (!taken.has(base)) {
    return base;
  }

  for (let counter = 2; counter < 1000; counter += 1) {
    const candidate = `${base}-${counter}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  return `${base}-${Date.now().toString(36)}`;
}

/* ------------------------------------------------------------------ *
 * Dateiname (T-8.3)
 * ------------------------------------------------------------------ */

export const SHARED_LIST_EXTENSION = 'tsl';

/**
 * Macht aus einem Listennamen einen Dateinamen.
 *
 * Der Name landet in einem Messenger und wird dort angezeigt - deshalb bleiben
 * Umlaute und Leerzeichen erhalten, statt alles auf ASCII zu buegeln. Entfernt
 * werden nur Zeichen, an denen Dateisysteme oder das Teilen scheitern.
 *
 * Ein leerer Name ergaebe eine Datei, die nur aus der Endung besteht - dann
 * lieber ein neutraler Ersatzname als eine Datei namens ".tsl", die in der
 * Uebersicht des Empfaengers unsichtbar waere.
 */
export function shareFileName(listName: string, fallback: string): string {
  const cleaned = listName
    // Zeichen, die Windows, Android oder das Teilen nicht mitmachen.
    .replace(/[\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);

  const base = cleaned.length === 0 ? fallback : cleaned;
  return `${base}.${SHARED_LIST_EXTENSION}`;
}

/**
 * Merker fuer den einmaligen Hinweis, dass Teilen eine Kopie erzeugt
 * (FR-6.7). Liegt in app_state, damit er einen Neustart ueberlebt.
 */
export const SHARE_COPY_HINT_KEY = 'share_copy_hint_seen';
