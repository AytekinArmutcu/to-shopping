import categoriesJson from '@/db/seed/categories.json';

import {
  CATEGORY_FALLBACK_ID,
  categoryColorFor,
  categoryColorsDark,
  categoryColorsLight,
} from './categoryColors';
import { contrastRatio, WCAG_AA_TEXT } from './contrast';

const seedIds = categoriesJson.map((category) => category.id).sort();

describe.each([
  ['hell', categoryColorsLight],
  ['dunkel', categoryColorsDark],
])('Kategoriefarben %s', (_name, colors) => {
  it('deckt genau die Kategorien aus dem Seed ab', () => {
    expect(Object.keys(colors).sort()).toEqual(seedIds);
  });

  it.each(seedIds)('%s erreicht AA fuer normalen Text', (id) => {
    const color = colors[id];
    expect(color).toBeDefined();
    const ratio = contrastRatio(color?.onContainer ?? '', color?.container ?? '');
    expect(ratio).not.toBeNull();
    expect(ratio ?? 0).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it('faellt fuer unbekannt, null und undefined auf "sonstiges" zurueck', () => {
    const fallback = colors[CATEGORY_FALLBACK_ID];
    expect(fallback).toBeDefined();
    expect(categoryColorFor(colors, 'gibt-es-nicht')).toBe(fallback);
    expect(categoryColorFor(colors, null)).toBe(fallback);
    expect(categoryColorFor(colors, undefined)).toBe(fallback);
    expect(categoryColorFor(colors, '')).toBe(fallback);
  });

  it('liefert fuer eine bekannte ID ihren eigenen Eintrag', () => {
    expect(categoryColorFor(colors, 'kuehlregal')).toBe(colors.kuehlregal);
  });
});
