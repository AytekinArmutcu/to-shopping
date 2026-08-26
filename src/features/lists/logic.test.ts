import {
  buildListSections,
  CHECKED_SECTION_ID,
  dropIndex,
  moveCategory,
  orderCategories,
  type CategoryLike,
  type SectionItem,
} from './logic';

const category = (id: string, name: string, defaultPosition: number): CategoryLike => ({
  id,
  name,
  defaultPosition,
});

const kategorien: CategoryLike[] = [
  category('obst', 'Obst', 1),
  category('backwaren', 'Backwaren', 2),
  category('kuehlregal', 'Kühlregal', 3),
  category('sonstiges', 'Sonstiges', 12),
];

const item = (overrides: Partial<SectionItem> & { id: string }): SectionItem => ({
  categoryId: 'obst',
  isChecked: false,
  position: 0,
  createdAt: 1000,
  ...overrides,
});

const options = {
  showChecked: false,
  fallbackCategoryId: 'sonstiges',
  fallbackTitle: 'Sonstiges',
  checkedTitle: 'Erledigt',
};

const titlesOf = (result: { sections: { title: string }[] }) =>
  result.sections.map((section) => section.title);

describe('orderCategories', () => {
  it('nimmt die Standardreihenfolge, wenn die Liste keine eigene hat', () => {
    expect(orderCategories(kategorien, []).map((entry) => entry.id)).toEqual([
      'obst',
      'backwaren',
      'kuehlregal',
      'sonstiges',
    ]);
  });

  it('folgt der eigenen Reihenfolge der Liste', () => {
    const eigene = [
      { categoryId: 'kuehlregal', position: 0 },
      { categoryId: 'backwaren', position: 1 },
      { categoryId: 'obst', position: 2 },
      { categoryId: 'sonstiges', position: 3 },
    ];
    expect(orderCategories(kategorien, eigene).map((entry) => entry.id)).toEqual([
      'kuehlregal',
      'backwaren',
      'obst',
      'sonstiges',
    ]);
  });

  it('haengt Kategorien ohne eigene Position hinten an, dort nach Standard', () => {
    const halbe = [{ categoryId: 'sonstiges', position: 0 }];
    expect(orderCategories(kategorien, halbe).map((entry) => entry.id)).toEqual([
      'sonstiges',
      'obst',
      'backwaren',
      'kuehlregal',
    ]);
  });

  it('ignoriert Positionen fuer Kategorien, die es nicht gibt', () => {
    const veraltet = [
      { categoryId: 'weinregal', position: 0 },
      { categoryId: 'kuehlregal', position: 1 },
    ];
    expect(orderCategories(kategorien, veraltet)[0]?.id).toBe('kuehlregal');
  });

  it('sortiert bei Gleichstand stabil nach Namen', () => {
    const gleichauf = [category('b', 'Bier', 5), category('a', 'Apfelsaft', 5)];
    expect(orderCategories(gleichauf, []).map((entry) => entry.name)).toEqual([
      'Apfelsaft',
      'Bier',
    ]);
  });

  it('veraendert die uebergebene Liste nicht', () => {
    const original = [...kategorien];
    orderCategories(kategorien, [{ categoryId: 'sonstiges', position: 0 }]);
    expect(kategorien).toEqual(original);
  });
});

describe('buildListSections', () => {
  const artikel: SectionItem[] = [
    item({ id: 'a', categoryId: 'kuehlregal', position: 0 }),
    item({ id: 'b', categoryId: 'obst', position: 1 }),
    item({ id: 'c', categoryId: 'kuehlregal', position: 2 }),
  ];

  it('gruppiert nach Kategorie in Standardreihenfolge', () => {
    const result = buildListSections(artikel, kategorien, [], options);
    expect(titlesOf(result)).toEqual(['Obst', 'Kühlregal']);
    expect(result.sections[1]?.data.map((entry) => entry.id)).toEqual(['a', 'c']);
  });

  it('folgt der Reihenfolge der Liste', () => {
    const eigene = [
      { categoryId: 'kuehlregal', position: 0 },
      { categoryId: 'obst', position: 1 },
    ];
    expect(titlesOf(buildListSections(artikel, kategorien, eigene, options))).toEqual([
      'Kühlregal',
      'Obst',
    ]);
  });

  it('laesst leere Abschnitte weg', () => {
    const nurObst = [item({ id: 'b', categoryId: 'obst' })];
    expect(titlesOf(buildListSections(nurObst, kategorien, [], options))).toEqual(['Obst']);
  });

  it('steckt Artikel ohne Kategorie nach Sonstiges', () => {
    const ohne = [item({ id: 'x', categoryId: null })];
    expect(titlesOf(buildListSections(ohne, kategorien, [], options))).toEqual(['Sonstiges']);
  });

  it('steckt Artikel mit unbekannter Kategorie ebenfalls nach Sonstiges', () => {
    const fremd = [item({ id: 'x', categoryId: 'weinregal' })];
    expect(titlesOf(buildListSections(fremd, kategorien, [], options))).toEqual(['Sonstiges']);
  });

  it('blendet Abgehaktes standardmaessig aus', () => {
    const gemischt = [
      item({ id: 'a', categoryId: 'obst' }),
      item({ id: 'b', categoryId: 'obst', isChecked: true }),
    ];
    const result = buildListSections(gemischt, kategorien, [], options);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.data.map((entry) => entry.id)).toEqual(['a']);
    expect(result.openCount).toBe(1);
    expect(result.checkedCount).toBe(1);
  });

  it('sammelt Abgehaktes in einem eigenen Abschnitt am Ende', () => {
    const gemischt = [
      item({ id: 'a', categoryId: 'obst' }),
      item({ id: 'b', categoryId: 'kuehlregal', isChecked: true }),
      item({ id: 'c', categoryId: 'obst', isChecked: true }),
    ];
    const result = buildListSections(gemischt, kategorien, [], {
      ...options,
      showChecked: true,
    });

    expect(titlesOf(result)).toEqual(['Obst', 'Erledigt']);
    const last = result.sections[result.sections.length - 1];
    expect(last?.id).toBe(CHECKED_SECTION_ID);
    expect(last?.data.map((entry) => entry.id)).toEqual(['b', 'c']);
  });

  it('sortiert innerhalb eines Abschnitts nach position', () => {
    const durcheinander = [item({ id: 'spaet', position: 5 }), item({ id: 'frueh', position: 1 })];
    const result = buildListSections(durcheinander, kategorien, [], options);
    expect(result.sections[0]?.data.map((entry) => entry.id)).toEqual(['frueh', 'spaet']);
  });

  it('entscheidet Gleichstand ueber createdAt und dann ueber die id', () => {
    const gleichauf = [
      item({ id: 'z', position: 0, createdAt: 100 }),
      item({ id: 'a', position: 0, createdAt: 100 }),
      item({ id: 'm', position: 0, createdAt: 50 }),
    ];
    const result = buildListSections(gleichauf, kategorien, [], options);
    expect(result.sections[0]?.data.map((entry) => entry.id)).toEqual(['m', 'a', 'z']);
  });

  it('liefert bei leerer Liste keine Abschnitte', () => {
    const result = buildListSections([], kategorien, [], options);
    expect(result.sections).toEqual([]);
    expect(result.openCount).toBe(0);
    expect(result.checkedCount).toBe(0);
  });

  it('zeigt Artikel auch ohne jede Kategorie im Datenbestand', () => {
    const result = buildListSections([item({ id: 'a', categoryId: 'obst' })], [], [], options);
    expect(titlesOf(result)).toEqual(['Sonstiges']);
  });
});

describe('moveCategory', () => {
  const order = ['a', 'b', 'c', 'd'];

  it('schiebt nach unten', () => {
    expect(moveCategory(order, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('schiebt nach oben', () => {
    expect(moveCategory(order, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('laesst die Reihenfolge bei gleichem Ziel unveraendert', () => {
    expect(moveCategory(order, 2, 2)).toEqual(order);
  });

  it('ignoriert Angaben ausserhalb der Liste', () => {
    expect(moveCategory(order, -1, 2)).toEqual(order);
    expect(moveCategory(order, 0, 9)).toEqual(order);
    expect(moveCategory(order, 9, 0)).toEqual(order);
  });

  it('veraendert die uebergebene Liste nicht', () => {
    const original = [...order];
    moveCategory(order, 0, 3);
    expect(order).toEqual(original);
  });

  it('kommt mit einer leeren Reihenfolge zurecht', () => {
    expect(moveCategory([], 0, 0)).toEqual([]);
  });
});

describe('dropIndex', () => {
  it('bleibt auf dem Platz, solange nicht eine halbe Zeile zurueckgelegt ist', () => {
    expect(dropIndex(2, 20, 64, 5)).toBe(2);
  });

  it('rueckt eine Zeile weiter, sobald die Haelfte ueberschritten ist', () => {
    expect(dropIndex(2, 40, 64, 5)).toBe(3);
    expect(dropIndex(2, -40, 64, 5)).toBe(1);
  });

  it('zaehlt mehrere Zeilen', () => {
    expect(dropIndex(0, 200, 64, 5)).toBe(3);
  });

  it('laeuft nicht ueber die Enden hinaus', () => {
    expect(dropIndex(0, -500, 64, 5)).toBe(0);
    expect(dropIndex(4, 500, 64, 5)).toBe(4);
  });

  it('kommt mit einer leeren Liste zurecht', () => {
    expect(dropIndex(0, 100, 64, 0)).toBe(0);
  });
});
