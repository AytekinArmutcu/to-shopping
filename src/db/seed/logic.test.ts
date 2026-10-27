import { UNITS } from '../units';
import categoriesJson from './categories.json';
import {
  buildProductRows,
  buildRecipeRows,
  findDuplicateIds,
  findDuplicateNames,
  findDuplicateRecipeNames,
  findRecipesWithUnknownProducts,
  type ProductRow,
  type SeedProduct,
  type SeedRecipe,
} from './logic';
import productsJson from './products.json';
import recipesJson from './recipes.json';

const categories = categoriesJson;
const products = productsJson as SeedProduct[];
const recipes = recipesJson as SeedRecipe[];

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

describe('Grundstock-Gerichte (ausgelieferte Daten, T-14.2)', () => {
  const productRows = buildProductRows(products, categories);
  const brands = [
    'nutella',
    'maggi',
    'knorr',
    'milka',
    'coca',
    'haribo',
    'kinder',
    'oetker',
    'barilla',
    'rama',
  ];

  it('verweist nur auf Produkte aus dem Katalog (T-14.2)', () => {
    expect(findRecipesWithUnknownProducts(recipes, productRows)).toEqual([]);
  });

  it('laesst sich ohne Fehler in Zeilen umwandeln (T-14.2)', () => {
    expect(() => buildRecipeRows(recipes, productRows)).not.toThrow();
  });

  it('hat keine doppelten Namen und keine doppelten IDs (T-14.2)', () => {
    expect(findDuplicateRecipeNames(recipes)).toEqual([]);
    const { recipes: rows, items } = buildRecipeRows(recipes, productRows);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
  });

  it('enthaelt 30 bis 45 Gerichte (T-14.2)', () => {
    expect(recipes.length).toBeGreaterThanOrEqual(30);
    expect(recipes.length).toBeLessThanOrEqual(45);
  });

  it('haelt Namen bei hoechstens 60 Zeichen (T-14.2)', () => {
    const tooLong = recipes.filter((recipe) => recipe.name.length > 60);
    expect(tooLong.map((recipe) => recipe.name)).toEqual([]);
  });

  it('benutzt ausschliesslich zulaessige Einheiten (T-14.2)', () => {
    const invalid = recipes.filter((recipe) =>
      recipe.items.some(
        (item) => item.unit !== undefined && !(UNITS as readonly string[]).includes(item.unit),
      ),
    );
    expect(invalid.map((recipe) => recipe.name)).toEqual([]);
  });

  it('fuehrt jede Zutat hoechstens einmal pro Gericht (T-14.2)', () => {
    const repeated = recipes.filter(
      (recipe) => new Set(recipe.items.map((item) => item.product)).size !== recipe.items.length,
    );
    expect(repeated.map((recipe) => recipe.name)).toEqual([]);
  });

  it('hat 3 bis 8 Zutaten pro Gericht (T-14.2)', () => {
    const outOfRange = recipes.filter(
      (recipe) => recipe.items.length < 3 || recipe.items.length > 8,
    );
    expect(outOfRange.map((recipe) => recipe.name)).toEqual([]);
  });

  it('enthaelt keine Markennamen (T-14.2)', () => {
    const withBrand = recipes.filter((recipe) => {
      const text = [recipe.name, recipe.note ?? '', ...recipe.items.map((item) => item.product)]
        .join(' ')
        .toLowerCase();
      return brands.some((brand) => text.includes(brand));
    });
    expect(withBrand.map((recipe) => recipe.name)).toEqual([]);
  });
});

describe('buildRecipeRows (T-14.2)', () => {
  const testProducts: ProductRow[] = [
    {
      id: 'p-nudeln',
      name: 'Nudeln',
      categoryId: 'sonstiges',
      defaultUnit: 'packung',
      isBuiltin: true,
    },
    {
      id: 'p-kaese',
      name: 'Käse',
      categoryId: 'sonstiges',
      defaultUnit: 'packung',
      isBuiltin: true,
    },
    { id: 'p-milch', name: 'Milch', categoryId: 'sonstiges', defaultUnit: 'l', isBuiltin: true },
  ];

  it('erzeugt IDs nach dem Schema r-<slug> und <rezept>-i<index> (T-14.2)', () => {
    const result = buildRecipeRows(
      [{ name: 'Käsespätzle', items: [{ product: 'Nudeln' }, { product: 'Käse' }] }],
      testProducts,
    );
    expect(result.recipes[0]?.id).toBe('r-kaesespaetzle');
    expect(result.items.map((item) => item.id)).toEqual([
      'r-kaesespaetzle-i0',
      'r-kaesespaetzle-i1',
    ]);
    expect(result.items[0]?.recipeId).toBe('r-kaesespaetzle');
  });

  it('uebernimmt ohne Angabe die Standardeinheit des Produkts (T-14.2)', () => {
    const result = buildRecipeRows([{ name: 'Test', items: [{ product: 'Milch' }] }], testProducts);
    expect(result.items[0]?.unit).toBe('l');
  });

  it('behaelt eine angegebene Einheit und Menge bei (T-14.2)', () => {
    const result = buildRecipeRows(
      [{ name: 'Test', items: [{ product: 'Milch', quantity: 200, unit: 'ml' }] }],
      testProducts,
    );
    expect(result.items[0]?.unit).toBe('ml');
    expect(result.items[0]?.quantity).toBe(200);
  });

  it('setzt ohne Angabe die Menge 1 (T-14.2)', () => {
    const result = buildRecipeRows([{ name: 'Test', items: [{ product: 'Milch' }] }], testProducts);
    expect(result.items[0]?.quantity).toBe(1);
  });

  it('loest die Produkt-ID auf und kopiert den Produktnamen (T-14.2)', () => {
    const result = buildRecipeRows([{ name: 'Test', items: [{ product: 'Käse' }] }], testProducts);
    expect(result.items[0]?.productId).toBe('p-kaese');
    expect(result.items[0]?.name).toBe('Käse');
  });

  it('nummeriert die Positionen ab 0 durch (T-14.2)', () => {
    const result = buildRecipeRows(
      [{ name: 'Test', items: [{ product: 'Nudeln' }, { product: 'Käse' }, { product: 'Milch' }] }],
      testProducts,
    );
    expect(result.items.map((item) => item.position)).toEqual([0, 1, 2]);
  });

  it('setzt eine fehlende Notiz auf null und markiert als mitgeliefert (T-14.2)', () => {
    const result = buildRecipeRows([{ name: 'Test', items: [{ product: 'Milch' }] }], testProducts);
    expect(result.recipes[0]?.note).toBeNull();
    expect(result.recipes[0]?.isBuiltin).toBe(true);
  });

  it('wirft bei unbekanntem Produkt mit Rezept- und Zutatenname (T-14.2)', () => {
    expect(() =>
      buildRecipeRows([{ name: 'Testgericht', items: [{ product: 'Einhorn' }] }], testProducts),
    ).toThrow(/Testgericht.*Einhorn/);
  });

  it('wirft bei ungueltiger Einheit mit Rezept- und Zutatenname (T-14.2)', () => {
    expect(() =>
      buildRecipeRows(
        [{ name: 'Testgericht', items: [{ product: 'Milch', unit: 'eimer' }] }],
        testProducts,
      ),
    ).toThrow(/Testgericht.*eimer.*Milch/);
  });

  it('findet Gerichte mit unbekannten Produkten (T-14.2)', () => {
    expect(
      findRecipesWithUnknownProducts(
        [
          { name: 'Gut', items: [{ product: 'Milch' }] },
          { name: 'Schlecht', items: [{ product: 'Einhorn' }] },
        ],
        testProducts,
      ),
    ).toEqual(['Schlecht']);
  });

  it('findet doppelte Gerichtnamen unabhaengig von der Schreibweise (T-14.2)', () => {
    expect(
      findDuplicateRecipeNames([
        { name: 'Milchreis', items: [] },
        { name: 'milchreis', items: [] },
      ]),
    ).toEqual(['milchreis']);
  });
});
