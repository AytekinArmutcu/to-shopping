import {
  buildListOverview,
  buildListPreviews,
  buildListSections,
  CHECKED_SECTION_ID,
  cleanListName,
  copyName,
  dropIndex,
  limitSegments,
  listRoute,
  MAX_LIST_NAME_LENGTH,
  MAX_PREVIEW_NAMES,
  MAX_PREVIEW_SEGMENTS,
  moveCategory,
  orderCategories,
  parseListRoute,
  resolveStartRoute,
  ROUTE_OVERVIEW,
  type CategoryLike,
  type PreviewItem,
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
    expect(last?.key).toBe(CHECKED_SECTION_ID);
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

describe('buildListOverview', () => {
  const listen = [
    { id: 'l-2', name: 'Drogerie', position: 1 },
    { id: 'l-1', name: 'Wocheneinkauf', position: 0 },
  ];

  it('sortiert nach der Reihenfolge des Anlegens', () => {
    const rows = buildListOverview(listen, []);
    expect(rows.map((row) => row.name)).toEqual(['Wocheneinkauf', 'Drogerie']);
  });

  it('haengt die Anzahl offener Artikel an', () => {
    const rows = buildListOverview(listen, [{ listId: 'l-1', openCount: 7 }]);
    expect(rows[0]).toEqual({ id: 'l-1', name: 'Wocheneinkauf', openCount: 7 });
  });

  it('zeigt Listen ohne Artikel mit null statt gar nicht', () => {
    const rows = buildListOverview(listen, [{ listId: 'l-1', openCount: 3 }]);
    expect(rows[1]?.openCount).toBe(0);
  });

  it('ignoriert Zaehlungen zu geloeschten Listen', () => {
    const rows = buildListOverview(listen, [{ listId: 'l-weg', openCount: 9 }]);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.openCount === 0)).toBe(true);
  });

  it('sortiert bei gleicher Position nach Name und dann id', () => {
    const gleichauf = [
      { id: 'l-b', name: 'Aldi', position: 0 },
      { id: 'l-a', name: 'Aldi', position: 0 },
      { id: 'l-c', name: 'Edeka', position: 0 },
    ];
    expect(buildListOverview(gleichauf, []).map((row) => row.id)).toEqual(['l-a', 'l-b', 'l-c']);
  });

  it('kommt ohne Listen zurecht', () => {
    expect(buildListOverview([], [])).toEqual([]);
  });
});

describe('cleanListName', () => {
  it('raeumt Leerzeichen auf', () => {
    expect(cleanListName('  Wochen   einkauf ')).toBe('Wochen einkauf');
  });

  it('macht aus leerer Eingabe null', () => {
    expect(cleanListName('')).toBeNull();
    expect(cleanListName('   ')).toBeNull();
  });

  it('kuerzt zu lange Namen', () => {
    expect(cleanListName('x'.repeat(200))).toHaveLength(MAX_LIST_NAME_LENGTH);
  });
});

describe('copyName', () => {
  it('haengt den Zusatz an', () => {
    expect(copyName('Wocheneinkauf', ['Wocheneinkauf'], 'Kopie')).toBe('Wocheneinkauf (Kopie)');
  });

  it('zaehlt hoch, wenn der Name schon vergeben ist', () => {
    const vorhanden = ['Wocheneinkauf', 'Wocheneinkauf (Kopie)'];
    expect(copyName('Wocheneinkauf', vorhanden, 'Kopie')).toBe('Wocheneinkauf (Kopie 2)');
  });

  it('zaehlt weiter, solange belegt ist', () => {
    const vorhanden = ['A (Kopie)', 'A (Kopie 2)', 'A (Kopie 3)'];
    expect(copyName('A', vorhanden, 'Kopie')).toBe('A (Kopie 4)');
  });

  it('vergleicht ohne Ruecksicht auf Gross- und Kleinschreibung', () => {
    expect(copyName('A', ['a (kopie)'], 'Kopie')).toBe('A (Kopie 2)');
  });

  it('bleibt innerhalb der Namenslaenge', () => {
    expect(copyName('x'.repeat(80), [], 'Kopie').length).toBeLessThanOrEqual(MAX_LIST_NAME_LENGTH);
  });
});

describe('listRoute und parseListRoute', () => {
  it('bauen und lesen dieselbe Route', () => {
    expect(parseListRoute(listRoute('l-abc'))).toBe('l-abc');
  });

  it('erkennen andere Routen nicht als Listenroute', () => {
    expect(parseListRoute(ROUTE_OVERVIEW)).toBeNull();
    expect(parseListRoute('/katalog?listId=l-abc')).toBeNull();
    expect(parseListRoute('')).toBeNull();
    expect(parseListRoute('/liste')).toBeNull();
    expect(parseListRoute('/liste?listId=')).toBeNull();
  });
});

describe('resolveStartRoute', () => {
  it('startet ohne gespeicherte Route in der Uebersicht', () => {
    expect(resolveStartRoute(null)).toBe(ROUTE_OVERVIEW);
  });

  it('nimmt die Uebersicht, wenn sie gespeichert ist', () => {
    expect(resolveStartRoute(ROUTE_OVERVIEW)).toBe(ROUTE_OVERVIEW);
  });

  it('nimmt eine gespeicherte Listenroute', () => {
    expect(resolveStartRoute('/liste?listId=l-abc')).toBe('/liste?listId=l-abc');
  });

  it('faellt bei unbekannten Routen auf die Uebersicht zurueck', () => {
    expect(resolveStartRoute('/gibtsnicht')).toBe(ROUTE_OVERVIEW);
    expect(resolveStartRoute('kaputt')).toBe(ROUTE_OVERVIEW);
  });
});

describe('buildListPreviews', () => {
  const eintrag = (
    overrides: Partial<PreviewItem> & { id: string; name: string },
  ): PreviewItem => ({
    listId: 'l1',
    categoryId: 'obst',
    isChecked: false,
    position: 0,
    createdAt: 1000,
    ...overrides,
  });

  const kategorieFolge = (preview: { segments: { categoryId: string }[] } | undefined) =>
    preview?.segments.map((segment) => segment.categoryId);

  it('ordnet die Segmente nach der Standardreihenfolge der Kategorien', () => {
    const result = buildListPreviews(
      [
        eintrag({ id: 'a', name: 'Milch', categoryId: 'kuehlregal', position: 0 }),
        eintrag({ id: 'b', name: 'Brot', categoryId: 'backwaren', position: 1 }),
        eintrag({ id: 'c', name: 'Äpfel', categoryId: 'obst', position: 2 }),
        eintrag({ id: 'd', name: 'Joghurt', categoryId: 'kuehlregal', position: 3 }),
      ],
      kategorien,
      [],
      'sonstiges',
    );

    expect(kategorieFolge(result.l1)).toEqual(['obst', 'backwaren', 'kuehlregal', 'kuehlregal']);
    expect(result.l1?.previewNames).toEqual(['Äpfel', 'Brot', 'Milch', 'Joghurt']);
    expect(result.l1?.hiddenCount).toBe(0);
  });

  it('folgt dem eigenen Ladenlayout jeder Liste getrennt', () => {
    const result = buildListPreviews(
      [
        eintrag({ id: 'a', name: 'Milch', categoryId: 'kuehlregal' }),
        eintrag({ id: 'b', name: 'Äpfel', categoryId: 'obst' }),
        eintrag({ id: 'c', listId: 'l2', name: 'Milch', categoryId: 'kuehlregal' }),
        eintrag({ id: 'd', listId: 'l2', name: 'Äpfel', categoryId: 'obst' }),
      ],
      kategorien,
      [
        { listId: 'l1', categoryId: 'kuehlregal', position: 0 },
        { listId: 'l1', categoryId: 'obst', position: 1 },
      ],
      'sonstiges',
    );

    expect(kategorieFolge(result.l1)).toEqual(['kuehlregal', 'obst']);
    // Das Layout von l1 gilt nicht fuer l2.
    expect(kategorieFolge(result.l2)).toEqual(['obst', 'kuehlregal']);
  });

  it('haengt Erledigtes gedaempft ans Ende und laesst es aus der Vorschau', () => {
    const result = buildListPreviews(
      [
        eintrag({ id: 'a', name: 'Äpfel', categoryId: 'obst', isChecked: true }),
        eintrag({ id: 'b', name: 'Milch', categoryId: 'kuehlregal' }),
      ],
      kategorien,
      [],
      'sonstiges',
    );

    expect(result.l1?.segments).toEqual([
      { categoryId: 'kuehlregal', checked: false },
      { categoryId: 'obst', checked: true },
    ]);
    expect(result.l1?.previewNames).toEqual(['Milch']);
  });

  it('steckt Artikel ohne oder mit unbekannter Kategorie in die Ersatzkategorie', () => {
    const result = buildListPreviews(
      [
        eintrag({ id: 'a', name: 'Kerzen', categoryId: null }),
        eintrag({ id: 'b', name: 'Wein', categoryId: 'weinregal' }),
      ],
      kategorien,
      [],
      'sonstiges',
    );

    expect(kategorieFolge(result.l1)).toEqual(['sonstiges', 'sonstiges']);
  });

  it('zeigt hoechstens fuenf Namen und zaehlt den Rest', () => {
    const viele = Array.from({ length: 8 }, (_, index) =>
      eintrag({ id: `i${index}`, name: `Artikel ${index}`, position: index }),
    );
    const result = buildListPreviews(viele, kategorien, [], 'sonstiges');

    expect(result.l1?.previewNames).toHaveLength(MAX_PREVIEW_NAMES);
    expect(result.l1?.previewNames[0]).toBe('Artikel 0');
    expect(result.l1?.hiddenCount).toBe(8 - MAX_PREVIEW_NAMES);
  });

  it('begrenzt die Leiste bei langen Listen', () => {
    const viele = Array.from({ length: 40 }, (_, index) =>
      eintrag({ id: `i${index}`, name: `Artikel ${index}`, position: index }),
    );
    const result = buildListPreviews(viele, kategorien, [], 'sonstiges');

    expect(result.l1?.segments).toHaveLength(MAX_PREVIEW_SEGMENTS);
  });

  it('liefert fuer Listen ohne Artikel keinen Eintrag', () => {
    expect(buildListPreviews([], kategorien, [], 'sonstiges')).toEqual({});
  });
});

describe('limitSegments', () => {
  const offen = (count: number, prefix = 'o') =>
    Array.from({ length: count }, (_, index) => `${prefix}${index}`);

  it('laesst kurze Leisten unveraendert', () => {
    expect(limitSegments(['a', 'b'], ['c'], 24)).toEqual(['a', 'b', 'c']);
  });

  it('verteilt die Plaetze anteilig auf Offenes und Erledigtes', () => {
    const result = limitSegments(offen(30), offen(18, 'e'), 24);

    expect(result).toHaveLength(24);
    expect(result.filter((entry) => entry.startsWith('o'))).toHaveLength(15);
    expect(result.filter((entry) => entry.startsWith('e'))).toHaveLength(9);
  });

  it('behaelt die Reihenfolge: erst offen, dann erledigt', () => {
    const result = limitSegments(offen(30), offen(30, 'e'), 24);
    const firstChecked = result.findIndex((entry) => entry.startsWith('e'));

    expect(result.slice(0, firstChecked).every((entry) => entry.startsWith('o'))).toBe(true);
    expect(result.slice(firstChecked).every((entry) => entry.startsWith('e'))).toBe(true);
  });

  it('waehlt gleichmaessig aus, statt nur den Anfang zu nehmen', () => {
    const result = limitSegments(offen(48), [], 24);

    expect(result).toHaveLength(24);
    expect(result[0]).toBe('o1');
    expect(result[23]).toBe('o47');
  });

  it('laesst einem einzelnen offenen Artikel immer ein Segment', () => {
    const result = limitSegments(['o0'], offen(60, 'e'), 24);

    expect(result).toHaveLength(24);
    expect(result[0]).toBe('o0');
  });

  it('laesst einem einzelnen erledigten Artikel ebenfalls ein Segment', () => {
    const result = limitSegments(offen(60), ['e0'], 24);

    expect(result).toHaveLength(24);
    expect(result[23]).toBe('e0');
  });
});
