/**
 * Kontrastberechnung nach WCAG 2.1 (FR-7.4).
 *
 * Reine Funktionen - damit sich der Kontrast der ganzen Farbwelt pruefen
 * laesst, ohne die App zu starten. Ein Durchgang mit dem Auge findet den
 * einen Fall, den man ansieht; eine Rechnung findet alle.
 */

export type Rgb = { r: number; g: number; b: number };

/**
 * Liest die Schreibweisen, die in der Farbdatei vorkommen: "rgb(1, 2, 3)",
 * "rgba(1, 2, 3, 0.5)" und "#aabbcc".
 *
 * Die Deckkraft von rgba wird bewusst **nicht** verrechnet: Der Kontrast
 * haengt dann vom Untergrund ab, und diese Werte sind ohnehin fuer gesperrte
 * Bedienelemente gedacht, fuer die WCAG keinen Mindestkontrast verlangt.
 */
export function parseColor(value: string): Rgb | null {
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }

  const hex = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (hex?.[1]) {
    const number = parseInt(hex[1], 16);
    return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
  }

  return null;
}

/** Relative Leuchtdichte nach WCAG 2.1. */
export function luminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Kontrastverhaeltnis zwischen zwei Farben: 1 (gleich) bis 21 (schwarz/weiss).
 *
 * WCAG AA verlangt 4,5 fuer normalen Text und 3,0 fuer grosse Schrift und
 * Bedienelemente.
 */
export function contrastRatio(foreground: string, background: string): number | null {
  const front = parseColor(foreground);
  const back = parseColor(background);

  if (front === null || back === null) {
    return null;
  }

  const a = luminance(front);
  const b = luminance(back);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);

  return (lighter + 0.05) / (darker + 0.05);
}

export const WCAG_AA_TEXT = 4.5;
export const WCAG_AA_LARGE = 3;
