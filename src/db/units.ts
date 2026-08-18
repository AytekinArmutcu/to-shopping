/**
 * Feste Einheiten als TypeScript-Union statt als Datenbanktabelle (ADR-018).
 *
 * Grund: Freitext erzeugt binnen Wochen "Pck", "Pkg", "Packung" und "packung"
 * nebeneinander und macht jede Auswertung unbrauchbar. Die Liste aendert sich
 * nicht zur Laufzeit, also gehoert sie in den Code und nicht in die Datenbank.
 *
 * Die Anzeigetexte stehen in src/i18n/locales/de.json, nicht hier.
 */
export const UNITS = ['stueck', 'g', 'kg', 'ml', 'l', 'packung', 'bund', 'dose'] as const;

export type Unit = (typeof UNITS)[number];

export const DEFAULT_UNIT: Unit = 'stueck';

export function isUnit(value: string): value is Unit {
  return (UNITS as readonly string[]).includes(value);
}
