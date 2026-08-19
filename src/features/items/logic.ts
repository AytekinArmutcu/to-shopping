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
