export const APP_NAME = 'To-Shopping';

/** Aktueller Stand laut docs/roadmap.md. Wird pro Meilenstein hochgesetzt. */
export const MILESTONE = 'M0';

/**
 * Beispiel fuer eine reine Funktion nach ADR-008: Eingabe rein, Ergebnis raus,
 * keine Datenbank, keine Seiteneffekte - und damit ohne laufende App testbar.
 */
export function currentMilestone(milestone: string = MILESTONE): string {
  return `Meilenstein ${milestone}`;
}
