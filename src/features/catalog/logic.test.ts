import { cleanProductName, findSuggestions, type CatalogProduct } from './logic';

const product = (id: string, name: string): CatalogProduct => ({
  id,
  name,
  categoryId: 'sonstiges',
  defaultUnit: 'stueck',
});

const katalog: CatalogProduct[] = [
  product('p-milch', 'Milch'),
  product('p-hafermilch', 'Hafermilch'),
  product('p-buttermilch', 'Buttermilch'),
  product('p-mineralwasser', 'Mineralwasser'),
  product('p-aepfel', 'Äpfel'),
  product('p-muesli', 'Müsli'),
  product('p-brot', 'Brot'),
];

const namesOf = (result: ReturnType<typeof findSuggestions>) =>
  result.suggestions.map((suggestion) => suggestion.product.name);

describe('findSuggestions', () => {
  it('findet Produkte, die mit der Eingabe beginnen', () => {
    expect(namesOf(findSuggestions('mil', katalog))).toContain('Milch');
  });

  it('stellt Treffer am Wortanfang vor Treffer in der Wortmitte', () => {
    const namen = namesOf(findSuggestions('milch', katalog));
    expect(namen[0]).toBe('Milch');
    expect(namen).toEqual(['Milch', 'Buttermilch', 'Hafermilch']);
  });

  it('sortiert bei gleicher Trefferqualitaet alphabetisch', () => {
    expect(namesOf(findSuggestions('m', katalog))).toEqual([
      'Milch',
      'Mineralwasser',
      'Müsli',
      'Buttermilch',
      'Hafermilch',
    ]);
  });

  it('ignoriert Gross- und Kleinschreibung', () => {
    expect(namesOf(findSuggestions('MILCH', katalog))[0]).toBe('Milch');
  });

  it('findet Umlaute auch ohne Umlaut getippt', () => {
    expect(namesOf(findSuggestions('apfel', katalog))).toContain('Äpfel');
    expect(namesOf(findSuggestions('muesli', katalog))).toContain('Müsli');
  });

  it('blendet Produkte aus, die schon auf der Liste stehen', () => {
    const namen = namesOf(findSuggestions('milch', katalog, ['p-milch']));
    expect(namen).not.toContain('Milch');
    expect(namen).toContain('Hafermilch');
  });

  it('zeigt bei leerer Eingabe den ganzen Katalog alphabetisch', () => {
    const namen = namesOf(findSuggestions('', katalog));
    expect(namen[0]).toBe('Äpfel');
    expect(namen).toHaveLength(katalog.length);
  });

  it('begrenzt die Anzahl der Vorschlaege', () => {
    expect(findSuggestions('', katalog, [], 3).suggestions).toHaveLength(3);
  });

  it('bietet das Anlegen an, wenn nichts exakt passt', () => {
    expect(findSuggestions('Dinkelbrot', katalog).canCreate).toBe(true);
  });

  it('bietet das Anlegen nicht an, wenn der Name exakt existiert', () => {
    expect(findSuggestions('Milch', katalog).canCreate).toBe(false);
    expect(findSuggestions('milch', katalog).canCreate).toBe(false);
  });

  it('bietet das Anlegen auch dann nicht an, wenn das Produkt schon auf der Liste steht', () => {
    // Sonst wuerde ein zweites, gleichnamiges Produkt entstehen und am
    // eindeutigen Index scheitern.
    expect(findSuggestions('Milch', katalog, ['p-milch']).canCreate).toBe(false);
  });

  it('bietet bei leerer Eingabe kein Anlegen an', () => {
    expect(findSuggestions('', katalog).canCreate).toBe(false);
    expect(findSuggestions('   ', katalog).canCreate).toBe(false);
  });

  it('liefert bei leerem Katalog keine Vorschlaege, aber das Anlegen', () => {
    const result = findSuggestions('Milch', []);
    expect(result.suggestions).toEqual([]);
    expect(result.canCreate).toBe(true);
  });
});

describe('cleanProductName', () => {
  it('entfernt Leerzeichen am Rand', () => {
    expect(cleanProductName('  Milch  ')).toBe('Milch');
  });

  it('fasst mehrfache Leerzeichen zusammen', () => {
    expect(cleanProductName('Wiener   Würstchen')).toBe('Wiener Würstchen');
  });

  it('laesst einen sauberen Namen unveraendert', () => {
    expect(cleanProductName('Milch')).toBe('Milch');
  });
});
