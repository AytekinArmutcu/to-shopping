import {
  buildCatalogSections,
  cleanProductName,
  hasNameConflict,
  idsToAdd,
  matchPosition,
  planCatalogReset,
  type CatalogCategory,
  type CatalogProduct,
} from './logic';

describe('matchPosition', () => {
  it('meldet die Stelle des Treffers', () => {
    expect(matchPosition('Milch', 'milch')).toBe(0);
    expect(matchPosition('Hafermilch', 'milch')).toBe(5);
  });

  it('meldet -1, wenn nichts passt', () => {
    expect(matchPosition('Brot', 'milch')).toBe(-1);
  });

  it('findet Umlaute in beiden Schreibweisen', () => {
    expect(matchPosition('Müsli', 'musli')).toBe(0);
    expect(matchPosition('Müsli', 'muesli')).toBe(0);
  });

  it('haelt eine leere Suche fuer einen Treffer am Anfang', () => {
    expect(matchPosition('Brot', '')).toBe(0);
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

const inCategory = (id: string, name: string, categoryId: string | null): CatalogProduct => ({
  id,
  name,
  categoryId,
  defaultUnit: 'stueck',
});

const kategorien: CatalogCategory[] = [
  { id: 'obst', name: 'Obst und Gemüse', defaultPosition: 0 },
  { id: 'milch', name: 'Milchprodukte', defaultPosition: 1 },
  { id: 'sonstiges', name: 'Sonstiges', defaultPosition: 9 },
];

const sortiment: CatalogProduct[] = [
  inCategory('p-milch', 'Milch', 'milch'),
  inCategory('p-butter', 'Butter', 'milch'),
  inCategory('p-aepfel', 'Äpfel', 'obst'),
  inCategory('p-birnen', 'Birnen', 'obst'),
  inCategory('p-kerze', 'Kerze', null),
  inCategory('p-duebel', 'Dübel', 'baumarkt'),
];

const titlesOf = (sections: ReturnType<typeof buildCatalogSections>) =>
  sections.map((section) => section.title);

describe('buildCatalogSections', () => {
  it('gruppiert nach Kategorien in Standardreihenfolge', () => {
    const sections = buildCatalogSections(sortiment, kategorien, '', 'Ohne Kategorie');
    expect(titlesOf(sections)).toEqual(['Obst und Gemüse', 'Milchprodukte', 'Ohne Kategorie']);
  });

  it('sortiert innerhalb einer Kategorie alphabetisch', () => {
    const sections = buildCatalogSections(sortiment, kategorien, '', 'Ohne Kategorie');
    expect(sections[0]?.data.map((entry) => entry.name)).toEqual(['Äpfel', 'Birnen']);
  });

  it('sammelt Produkte ohne und mit unbekannter Kategorie am Ende', () => {
    const sections = buildCatalogSections(sortiment, kategorien, '', 'Ohne Kategorie');
    const last = sections[sections.length - 1];
    expect(last?.key).toBe('');
    expect(last?.data.map((entry) => entry.name)).toEqual(['Dübel', 'Kerze']);
  });

  it('filtert ueber alle Kategorien hinweg', () => {
    const sections = buildCatalogSections(sortiment, kategorien, 'ir', 'Ohne Kategorie');
    expect(titlesOf(sections)).toEqual(['Obst und Gemüse']);
    expect(sections[0]?.data.map((entry) => entry.name)).toEqual(['Birnen']);
  });

  it('findet Umlaute in beiden Schreibweisen', () => {
    expect(buildCatalogSections(sortiment, kategorien, 'äpf', 'Rest')[0]?.data).toHaveLength(1);
    expect(buildCatalogSections(sortiment, kategorien, 'aepf', 'Rest')[0]?.data).toHaveLength(1);
    expect(buildCatalogSections(sortiment, kategorien, 'apf', 'Rest')[0]?.data).toHaveLength(1);
  });

  it('laesst leere Abschnitte weg', () => {
    const sections = buildCatalogSections(sortiment, kategorien, 'milch', 'Ohne Kategorie');
    expect(titlesOf(sections)).toEqual(['Milchprodukte']);
  });

  it('liefert nichts, wenn nichts passt', () => {
    expect(buildCatalogSections(sortiment, kategorien, 'xyz', 'Ohne Kategorie')).toEqual([]);
  });

  it('kommt mit leerem Katalog zurecht', () => {
    expect(buildCatalogSections([], kategorien, '', 'Ohne Kategorie')).toEqual([]);
  });

  it('zeigt bei gleicher Position eine stabile Reihenfolge', () => {
    const gleichauf: CatalogCategory[] = [
      { id: 'b', name: 'Backwaren', defaultPosition: 0 },
      { id: 'a', name: 'Aufstrich', defaultPosition: 0 },
    ];
    const sections = buildCatalogSections(
      [inCategory('p-1', 'Brot', 'b'), inCategory('p-2', 'Honig', 'a')],
      gleichauf,
      '',
      'Rest',
    );
    expect(titlesOf(sections)).toEqual(['Aufstrich', 'Backwaren']);
  });
});

describe('idsToAdd', () => {
  it('uebernimmt die Auswahl in der Reihenfolge der Antipper', () => {
    expect(idsToAdd(['p-b', 'p-a'], [])).toEqual(['p-b', 'p-a']);
  });

  it('laesst weg, was schon offen auf der Liste steht', () => {
    expect(idsToAdd(['p-a', 'p-b'], ['p-a'])).toEqual(['p-b']);
  });

  it('fuegt nichts doppelt ein', () => {
    expect(idsToAdd(['p-a', 'p-a'], [])).toEqual(['p-a']);
  });

  it('liefert nichts bei leerer Auswahl', () => {
    expect(idsToAdd([], ['p-a'])).toEqual([]);
  });
});

describe('hasNameConflict', () => {
  const vorhanden = [
    { id: 'p-milch', name: 'Milch' },
    { id: 'p-brot', name: 'Brot' },
  ];

  it('erkennt einen vergebenen Namen', () => {
    expect(hasNameConflict('Milch', vorhanden)).toBe(true);
  });

  it('achtet nicht auf Gross- und Kleinschreibung', () => {
    expect(hasNameConflict('milch', vorhanden)).toBe(true);
    expect(hasNameConflict('MILCH', vorhanden)).toBe(true);
  });

  it('uebersieht Leerzeichen am Rand', () => {
    expect(hasNameConflict('  Milch  ', vorhanden)).toBe(true);
  });

  it('laesst ein Produkt seinen eigenen Namen behalten', () => {
    expect(hasNameConflict('Milch', vorhanden, 'p-milch')).toBe(false);
  });

  it('meldet freie Namen als frei', () => {
    expect(hasNameConflict('Hafermilch', vorhanden)).toBe(false);
  });

  it('haelt einen leeren Namen nicht fuer einen Konflikt', () => {
    expect(hasNameConflict('', vorhanden)).toBe(false);
    expect(hasNameConflict('   ', vorhanden)).toBe(false);
  });
});

describe('planCatalogReset', () => {
  const seed = [
    { id: 'p-milch', name: 'Milch' },
    { id: 'p-brot', name: 'Brot' },
  ];

  it('stellt alles wieder her, wenn der Katalog leer ist', () => {
    const plan = planCatalogReset(seed, []);
    expect(plan.restore).toHaveLength(2);
    expect(plan.blocked).toEqual([]);
  });

  it('stellt ein Produkt wieder her, das seinen eigenen Namen noch traegt', () => {
    const plan = planCatalogReset(seed, [{ id: 'p-milch', name: 'Milch' }]);
    expect(plan.restore.map((entry) => entry.id)).toEqual(['p-milch', 'p-brot']);
  });

  it('stellt ein umbenanntes mitgeliefertes Produkt zurueck', () => {
    const plan = planCatalogReset(seed, [{ id: 'p-milch', name: 'Vollmilch' }]);
    expect(plan.restore.map((entry) => entry.id)).toContain('p-milch');
    expect(plan.blocked).toEqual([]);
  });

  it('laesst ein Produkt aus, dessen Name einem anderen gehoert', () => {
    const plan = planCatalogReset(seed, [{ id: 'p-eigen', name: 'Milch' }]);
    expect(plan.blocked.map((entry) => entry.id)).toEqual(['p-milch']);
    expect(plan.restore.map((entry) => entry.id)).toEqual(['p-brot']);
  });

  it('vergleicht Namen ohne Gross- und Kleinschreibung', () => {
    const plan = planCatalogReset(seed, [{ id: 'p-eigen', name: 'milch' }]);
    expect(plan.blocked.map((entry) => entry.id)).toEqual(['p-milch']);
  });

  it('kommt mit leerem Startkatalog zurecht', () => {
    expect(planCatalogReset([], [{ id: 'p-eigen', name: 'Kerze' }])).toEqual({
      restore: [],
      blocked: [],
    });
  });
});
