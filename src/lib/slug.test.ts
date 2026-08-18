import { slugify } from './slug';

describe('slugify', () => {
  it('macht aus einem einfachen Namen Kleinbuchstaben', () => {
    expect(slugify('Milch')).toBe('milch');
  });

  it('schreibt deutsche Umlaute aus', () => {
    expect(slugify('Müsli')).toBe('muesli');
    expect(slugify('Brötchen')).toBe('broetchen');
    expect(slugify('Äpfel')).toBe('aepfel');
    expect(slugify('Weiße Bohnen')).toBe('weisse-bohnen');
  });

  it('unterscheidet Umlaut und Grundvokal', () => {
    expect(slugify('Müsli')).not.toBe(slugify('Musli'));
  });

  it('behandelt franzoesische Akzente', () => {
    expect(slugify('Crème fraîche')).toBe('creme-fraiche');
  });

  it('ersetzt Sonderzeichen durch einen einzelnen Bindestrich', () => {
    expect(slugify('Nuss-Nougat-Creme')).toBe('nuss-nougat-creme');
    expect(slugify('Obst & Gemüse')).toBe('obst-gemuese');
    expect(slugify('WC-Reiniger')).toBe('wc-reiniger');
  });

  it('entfernt Bindestriche am Anfang und Ende', () => {
    expect(slugify('  Milch  ')).toBe('milch');
    expect(slugify('!Milch!')).toBe('milch');
  });

  it('liefert fuer denselben Namen immer dasselbe Ergebnis', () => {
    expect(slugify('Tiefkühlpizza')).toBe(slugify('Tiefkühlpizza'));
  });

  it('kommt mit einer leeren Eingabe zurecht', () => {
    expect(slugify('')).toBe('');
    expect(slugify('!!!')).toBe('');
  });
});
