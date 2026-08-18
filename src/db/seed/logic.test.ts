import { UNITS } from '../units';
import categoriesJson from './categories.json';
import { buildProductRows, findDuplicateIds, findDuplicateNames, type SeedProduct } from './logic';
import productsJson from './products.json';

const categories = categoriesJson;
const products = productsJson as SeedProduct[];

describe('Startkatalog (ausgelieferte Daten)', () => {
  it('enthaelt 150 bis 200 Produkte laut FR-4.1', () => {
    expect(products.length).toBeGreaterThanOrEqual(150);
    expect(products.length).toBeLessThanOrEqual(200);
  });

  it('enthaelt 10 bis 12 Kategorien laut FR-4.1', () => {
    expect(categories.length).toBeGreaterThanOrEqual(10);
    expect(categories.length).toBeLessThanOrEqual(12);
  });

  it('hat keine Namen, die sich nur in der Schreibweise unterscheiden', () => {
    expect(findDuplicateNames(products)).toEqual([]);
  });

  it('erzeugt eindeutige IDs', () => {
    expect(findDuplicateIds(buildProductRows(products, categories))).toEqual([]);
  });

  it('verweist ausschliesslich auf vorhandene Kategorien', () => {
    const known = new Set(categories.map((category) => category.id));
    const unknown = products.filter((product) => !known.has(product.category));
    expect(unknown.map((product) => product.name)).toEqual([]);
  });

  it('benutzt ausschliesslich zulaessige Einheiten', () => {
    const invalid = products.filter(
      (product) => !(UNITS as readonly string[]).includes(product.unit),
    );
    expect(invalid.map((product) => product.name)).toEqual([]);
  });

  it('hat eine sonstiges-Kategorie als Auffangbecken', () => {
    expect(categories.map((category) => category.id)).toContain('sonstiges');
  });

  it('vergibt jede Kategorie-Position genau einmal', () => {
    const positions = categories.map((category) => category.defaultPosition);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it('fuellt jede Kategorie mit mindestens fuenf Produkten', () => {
    const perCategory = new Map<string, number>();
    for (const product of products) {
      perCategory.set(product.category, (perCategory.get(product.category) ?? 0) + 1);
    }
    const thin = categories.filter((category) => (perCategory.get(category.id) ?? 0) < 5);
    expect(thin.map((category) => category.name)).toEqual([]);
  });
});

describe('buildProductRows', () => {
  const testCategories = [
    { id: 'kuehlregal', name: 'Kühlregal', defaultPosition: 1 },
    { id: 'sonstiges', name: 'Sonstiges', defaultPosition: 2 },
  ];

  it('erzeugt eine ID aus dem Namen', () => {
    const rows = buildProductRows(
      [{ name: 'Müsli', category: 'sonstiges', unit: 'packung' }],
      testCategories,
    );
    expect(rows[0]?.id).toBe('p-muesli');
  });

  it('markiert alle Zeilen als mitgeliefert', () => {
    const rows = buildProductRows(
      [{ name: 'Milch', category: 'kuehlregal', unit: 'l' }],
      testCategories,
    );
    expect(rows[0]?.isBuiltin).toBe(true);
  });

  it('faengt eine unbekannte Kategorie mit sonstiges ab', () => {
    const rows = buildProductRows(
      [{ name: 'Milch', category: 'gibt-es-nicht', unit: 'l' }],
      testCategories,
    );
    expect(rows[0]?.categoryId).toBe('sonstiges');
  });

  it('faellt bei unbekannter Einheit auf stueck zurueck', () => {
    const rows = buildProductRows(
      [{ name: 'Milch', category: 'kuehlregal', unit: 'eimer' }],
      testCategories,
    );
    expect(rows[0]?.defaultUnit).toBe('stueck');
  });

  it('behaelt eine gueltige Einheit bei', () => {
    const rows = buildProductRows(
      [{ name: 'Milch', category: 'kuehlregal', unit: 'l' }],
      testCategories,
    );
    expect(rows[0]?.defaultUnit).toBe('l');
  });

  it('liefert bei leerer Eingabe eine leere Liste', () => {
    expect(buildProductRows([], testCategories)).toEqual([]);
  });
});
