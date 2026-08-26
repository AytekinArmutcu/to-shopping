import { keyboardHeightInDp, MAX_KEYBOARD_SHARE } from './keyboard';

// Werte eines Galaxy-artigen Geraets: 914 dp hoch, Pixeldichte 2,625.
const HOEHE = 914;
const DICHTE = 2.625;

describe('keyboardHeightInDp', () => {
  it('laesst eine glaubwuerdige dp-Angabe unveraendert', () => {
    expect(keyboardHeightInDp(336, HOEHE, DICHTE)).toBe(336);
  });

  it('erkennt eine Pixelangabe und rechnet sie um', () => {
    // 883 px bei Dichte 2,625 sind 336 dp - der Fall vom Geraet.
    expect(keyboardHeightInDp(883, HOEHE, DICHTE)).toBeCloseTo(336.4, 1);
  });

  it('begrenzt auch das, was nach der Umrechnung noch zu gross ist', () => {
    expect(keyboardHeightInDp(99999, HOEHE, DICHTE)).toBeCloseTo(HOEHE * MAX_KEYBOARD_SHARE, 5);
  });

  it('meldet null fuer eine geschlossene Tastatur', () => {
    expect(keyboardHeightInDp(0, HOEHE, DICHTE)).toBe(0);
  });

  it('meldet null fuer unsinnige Angaben', () => {
    expect(keyboardHeightInDp(-10, HOEHE, DICHTE)).toBe(0);
    expect(keyboardHeightInDp(Number.NaN, HOEHE, DICHTE)).toBe(0);
    expect(keyboardHeightInDp(300, 0, DICHTE)).toBe(0);
  });

  it('rechnet bei Pixeldichte 1 nicht um - dort sind Pixel und dp dasselbe', () => {
    expect(keyboardHeightInDp(700, HOEHE, 1)).toBeCloseTo(HOEHE * MAX_KEYBOARD_SHARE, 5);
  });

  it('bleibt an der Grenze auf der sicheren Seite', () => {
    const grenze = HOEHE * MAX_KEYBOARD_SHARE;
    expect(keyboardHeightInDp(grenze, HOEHE, DICHTE)).toBe(grenze);
    expect(keyboardHeightInDp(grenze + 1, HOEHE, DICHTE)).toBeLessThan(grenze);
  });
});
