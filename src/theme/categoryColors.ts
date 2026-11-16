/**
 * Kategoriefarben als Erweiterung neben den Material-3-Rollen (ADR-049).
 *
 * Material 3 kennt nur eine Handvoll Rollen (primary, secondary, tertiary,
 * error, surface ...). Zwoelf Kategorien lassen sich darauf nicht abbilden,
 * ohne die Rollen fuer etwas anderes zu missbrauchen. Deshalb gibt es hier
 * eine eigene, kleine Farbtabelle: je Kategorie ein Paar aus Fuellfarbe
 * ("container") und Schrift darauf ("onContainer"), fuer hell und dunkel.
 * Die Paare folgen derselben Logik wie die Material-Rollen und werden im Test
 * gegen WCAG AA fuer normalen Text geprueft.
 *
 * Bildschirme schreiben nie eigene Farbwerte. Sie holen die Farbe ueber
 * useAppTheme().categories und categoryColorFor - so bleibt die Farbwelt an
 * einer Stelle und der Kontrasttest deckt alles ab.
 */

export type CategoryColor = { container: string; onContainer: string };

/** Kategorie fuer alles, was keiner anderen zugeordnet ist. */
export const CATEGORY_FALLBACK_ID = 'sonstiges';

export const categoryColorsLight: Record<string, CategoryColor> = {
  'obst-gemuese': { container: '#c8f0c4', onContainer: '#0b3d14' },
  'brot-backwaren': { container: '#ffe1b8', onContainer: '#4a2e00' },
  kuehlregal: { container: '#cfe8ff', onContainer: '#0b2e4d' },
  'fleisch-wurst': { container: '#ffd9dc', onContainer: '#4f1118' },
  tiefkuehl: { container: '#d6f3f7', onContainer: '#063c45' },
  trockenwaren: { container: '#f2e7c6', onContainer: '#3e3000' },
  konserven: { container: '#dce3ea', onContainer: '#1f2a36' },
  'suesses-snacks': { container: '#ffd8ec', onContainer: '#4d0f32' },
  getraenke: { container: '#cdeff2', onContainer: '#063a40' },
  drogerie: { container: '#e6ddff', onContainer: '#2a1a5c' },
  haushalt: { container: '#d5eae4', onContainer: '#0e3a30' },
  sonstiges: { container: '#e6e8e0', onContainer: '#30342d' },
};

export const categoryColorsDark: Record<string, CategoryColor> = {
  'obst-gemuese': { container: '#2e5a34', onContainer: '#cdefc8' },
  'brot-backwaren': { container: '#5c4318', onContainer: '#ffe1b8' },
  kuehlregal: { container: '#244b6b', onContainer: '#cfe8ff' },
  'fleisch-wurst': { container: '#6b2e36', onContainer: '#ffd9dc' },
  tiefkuehl: { container: '#1f4f58', onContainer: '#d6f3f7' },
  trockenwaren: { container: '#5a4e24', onContainer: '#f2e7c6' },
  konserven: { container: '#3e4a58', onContainer: '#dce3ea' },
  'suesses-snacks': { container: '#6b2f52', onContainer: '#ffd8ec' },
  getraenke: { container: '#1e5055', onContainer: '#cdeff2' },
  drogerie: { container: '#4a3b78', onContainer: '#e6ddff' },
  haushalt: { container: '#2f5a50', onContainer: '#d5eae4' },
  sonstiges: { container: '#454a42', onContainer: '#e6e8e0' },
};

/** Farbe einer Kategorie; unbekannte oder fehlende IDs bekommen "sonstiges". */
export function categoryColorFor(
  colors: Record<string, CategoryColor>,
  categoryId: string | null | undefined,
): CategoryColor {
  const color = categoryId ? colors[categoryId] : undefined;
  if (color) {
    return color;
  }
  const fallback = colors[CATEGORY_FALLBACK_ID];
  if (!fallback) {
    throw new Error(`Kategoriefarbe "${CATEGORY_FALLBACK_ID}" fehlt`);
  }
  return fallback;
}
