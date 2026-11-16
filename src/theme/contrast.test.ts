import { darkTheme, lightTheme } from './index';

import { contrastRatio, luminance, parseColor, WCAG_AA_LARGE, WCAG_AA_TEXT } from './contrast';

describe('parseColor', () => {
  it('liest rgb und rgba', () => {
    expect(parseColor('rgb(30, 108, 51)')).toEqual({ r: 30, g: 108, b: 51 });
    expect(parseColor('rgba(26, 28, 25, 0.38)')).toEqual({ r: 26, g: 28, b: 25 });
  });

  it('liest Hex', () => {
    expect(parseColor('#1e6c33')).toEqual({ r: 30, g: 108, b: 51 });
  });

  it('gibt null bei allem anderen', () => {
    expect(parseColor('transparent')).toBeNull();
    expect(parseColor('gruen')).toBeNull();
  });
});

describe('contrastRatio', () => {
  it('liefert 21 fuer Schwarz auf Weiss', () => {
    expect(contrastRatio('rgb(0, 0, 0)', 'rgb(255, 255, 255)')).toBeCloseTo(21, 5);
  });

  it('liefert 1 fuer zwei gleiche Farben', () => {
    expect(contrastRatio('rgb(30, 108, 51)', 'rgb(30, 108, 51)')).toBeCloseTo(1, 5);
  });

  it('ist unabhaengig von der Reihenfolge', () => {
    const a = contrastRatio('rgb(0, 0, 0)', 'rgb(120, 120, 120)');
    const b = contrastRatio('rgb(120, 120, 120)', 'rgb(0, 0, 0)');
    expect(a).toBeCloseTo(b ?? 0, 5);
  });

  it('kennt Weiss und Schwarz an den Enden der Leuchtdichte', () => {
    expect(luminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
    expect(luminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
  });
});

/**
 * Der eigentliche Waechter (FR-7.4).
 *
 * Geprueft werden die Paare, die Material 3 als zusammengehoerig definiert:
 * "onPrimary" liegt auf "primary", "onSurface" auf "surface" und so fort. Wer
 * eine Farbe anfasst, ohne ihr Gegenstueck mitzudenken, faellt hier auf - und
 * nicht erst bei einem Tester, der den Text nicht lesen kann.
 */
const paare: [string, string][] = [
  ['onPrimary', 'primary'],
  ['onSecondary', 'secondary'],
  ['onTertiary', 'tertiary'],
  ['onError', 'error'],
  ['onPrimaryContainer', 'primaryContainer'],
  ['onSecondaryContainer', 'secondaryContainer'],
  ['onTertiaryContainer', 'tertiaryContainer'],
  ['onErrorContainer', 'errorContainer'],
  ['onBackground', 'background'],
  ['onSurface', 'surface'],
  ['onSurfaceVariant', 'surfaceVariant'],
  ['inverseOnSurface', 'inverseSurface'],
];

/** Text auf dem normalen Untergrund - hier gilt die strengere Schwelle. */
const textPaare: [string, string][] = [
  ['onBackground', 'background'],
  ['onSurface', 'surface'],
  ['onSurfaceVariant', 'surface'],
  ['primary', 'background'],
  ['primary', 'surface'],
  ['error', 'surface'],
  // Orange als Akzent (ADR-049) traegt auch normalen Text, z. B. auf Chips.
  ['onTertiary', 'tertiary'],
  ['onTertiaryContainer', 'tertiaryContainer'],
];

describe.each([
  ['hell', lightTheme],
  ['dunkel', darkTheme],
])('Farbwelt %s', (_name, theme) => {
  const colors = theme.colors as unknown as Record<string, string>;

  it.each(paare)('%s auf %s erreicht mindestens AA fuer grosse Schrift', (front, back) => {
    const ratio = contrastRatio(colors[front] ?? '', colors[back] ?? '');
    expect(ratio).not.toBeNull();
    expect(ratio ?? 0).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });

  it.each(textPaare)('%s auf %s erreicht AA fuer normalen Text', (front, back) => {
    const ratio = contrastRatio(colors[front] ?? '', colors[back] ?? '');
    expect(ratio).not.toBeNull();
    expect(ratio ?? 0).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it('setzt Umrandungen sichtbar genug ab', () => {
    // Fuer Umrandungen verlangt WCAG 3,0 gegen den Nachbarn.
    const ratio = contrastRatio(colors.outline ?? '', colors.surface ?? '');
    expect(ratio ?? 0).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });
});
