import type { Unit } from '@/db/units';

export type ListItemLike = {
  id: string;
  listId: string;
  productId: string | null;
  name: string;
  quantity: number;
  unit: string;
  isChecked: boolean;
  position: number;
};

export type Partitioned<T> = {
  /** Was auf dem Bildschirm erscheint, in Anzeigereihenfolge. */
  visible: T[];
  openCount: number;
  checkedCount: number;
};

/**
 * Teilt die Artikel einer Liste in das auf, was angezeigt wird, und zaehlt
 * offen und erledigt (FR-3.5, FR-3.6, FR-3.7).
 *
 * Erledigte Artikel verschwinden aus der Liste, kehren aber ueber den Schalter
 * zurueck - dann ans Ende, damit die offenen Artikel oben bleiben. Wer im Laden
 * steht, will die offenen sehen, nicht das Erledigte.
 *
 * Reine Funktion ohne Datenbankzugriff (ADR-008).
 */
export function partitionItems<T extends { isChecked: boolean; position: number }>(
  items: T[],
  showChecked: boolean,
): Partitioned<T> {
  const byPosition = [...items].sort((a, b) => a.position - b.position);
  const open = byPosition.filter((item) => !item.isChecked);
  const checked = byPosition.filter((item) => item.isChecked);

  return {
    visible: showChecked ? [...open, ...checked] : open,
    openCount: open.length,
    checkedCount: checked.length,
  };
}

export type HistoryDraft = {
  productId: string | null;
  name: string;
  quantity: number;
  unit: string;
  listId: string;
  purchasedAt: number;
};

/**
 * Erzeugt die Historieneintraege fuer einen abgeschlossenen Einkauf (FR-3.8).
 *
 * Nur abgehakte Artikel wandern in die Historie - was liegen geblieben ist,
 * wurde nicht gekauft und darf die spaeteren Vorschlaege nicht beeinflussen.
 *
 * Name und Menge werden als Kopie uebernommen (ADR-007): Ein spaeter
 * geloeschtes oder umbenanntes Produkt darf die Historie nicht verfaelschen.
 */
export function buildHistoryDrafts(items: ListItemLike[], purchasedAt: number): HistoryDraft[] {
  return items
    .filter((item) => item.isChecked)
    .map((item) => ({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      listId: item.listId,
      purchasedAt,
    }));
}

/** IDs der Artikel, die beim Abschliessen von der Liste verschwinden. */
export function idsToRemoveOnFinish(items: ListItemLike[]): string[] {
  return items.filter((item) => item.isChecked).map((item) => item.id);
}

/**
 * Darf "Einkauf abschliessen" gedrueckt werden?
 *
 * Ohne einen einzigen abgehakten Artikel gibt es nichts abzuschliessen - der
 * Knopf waere dann eine Falle, die nur die Liste unveraendert laesst.
 */
export function canFinishShopping(items: { isChecked: boolean }[]): boolean {
  return items.some((item) => item.isChecked);
}

export type QuantityLike = { quantity: number; unit: Unit | string };

/**
 * Formatiert eine Menge fuer die Listenzeile (FR-2.6).
 *
 * Die Menge 1 wird unterdrueckt: Eine Liste voller "1×" ist unruhig und
 * traegt keine Information. Die Einheitentexte kommen aus der
 * Uebersetzungsdatei, deshalb nimmt die Funktion sie als Parameter entgegen
 * statt sie selbst nachzuschlagen - so bleibt sie rein und testbar.
 */
export function formatQuantity(item: QuantityLike, unitShort: string): string | null {
  if (item.unit === 'stueck') {
    return item.quantity === 1 ? null : `${formatNumber(item.quantity)}×`;
  }

  return `${formatNumber(item.quantity)} ${unitShort}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
}

/**
 * Schrittweite der Plus-/Minus-Knoepfe je Einheit.
 *
 * Ein Gramm-Schritt waere unbrauchbar: Von 500 g auf 501 g zu kommen hilft
 * niemandem. Was zaehlbar ist, geht in Einerschritten, Gewicht und Volumen in
 * den Spruengen, in denen man tatsaechlich einkauft.
 */
export const QUANTITY_STEP: Record<string, number> = {
  stueck: 1,
  packung: 1,
  bund: 1,
  dose: 1,
  g: 50,
  ml: 50,
  kg: 0.5,
  l: 0.5,
};

/** Obergrenze, damit ein Vertipper wie "50000" nicht die Zeile sprengt. */
export const MAX_QUANTITY = 9999;

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Naechster Mengenwert beim Druck auf Plus oder Minus (FR-2.4).
 *
 * Verringern faellt nie unter die Schrittweite und wird dabei nie groesser:
 * Wer 30 g eingetippt hat und auf Minus drueckt, bekommt weder 0 noch
 * ploetzlich 50 g, sondern behaelt seine 30 g. Der Knopf tut dann nichts -
 * das ist verstaendlicher als ein Sprung in die falsche Richtung.
 */
export function stepQuantity(quantity: number, unit: Unit | string, direction: 1 | -1): number {
  const step = QUANTITY_STEP[unit] ?? 1;
  const next = round3(quantity + direction * step);

  if (direction < 0 && next < step) {
    return Math.min(quantity, step);
  }

  return Math.min(next, MAX_QUANTITY);
}

/**
 * Liest eine getippte Menge (FR-2.4).
 *
 * Deutsches Komma ist Pflicht: Auf der Zahlentastatur eines deutschen
 * Telefons liegt das Komma, nicht der Punkt. Beides wird akzeptiert, damit
 * eine importierte oder kopierte Zahl nicht abgelehnt wird.
 *
 * Rueckgabe null heisst "nicht uebernehmen" - der bisherige Wert bleibt
 * stehen. Eine 0 waere keine Menge, sondern ein geloeschter Artikel, und
 * loeschen tut man an anderer Stelle.
 */
export function parseQuantity(input: string): number | null {
  const normalized = input.replace(',', '.').trim();

  if (normalized.length === 0 || !/^\d*\.?\d+$/.test(normalized)) {
    return null;
  }

  const value = round3(Number(normalized));

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.min(value, MAX_QUANTITY);
}

/** Laenge einer Notiz. Alles darueber ist keine Notiz mehr, sondern ein Text. */
export const MAX_NOTE_LENGTH = 200;

/**
 * Bereinigt eine Notiz vor dem Speichern (FR-2.5).
 *
 * Leer heisst null und nicht "": Sonst haette die Zeile eine unsichtbare
 * zweite Zeile, und jede Abfrage auf "hat eine Notiz" muesste zwei Faelle
 * unterscheiden.
 */
export function cleanNote(value: string): string | null {
  const trimmed = value.replace(/[ \t]+/g, ' ').trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, MAX_NOTE_LENGTH);
}
