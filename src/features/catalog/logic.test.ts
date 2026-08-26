import {
  buildCatalogSections,
  cleanProductName,
  findSuggestions,
  hasNameConflict,
  idsToAdd,
  planCatalogReset,
  type CatalogCategory,
  type CatalogProduct,
} from './logic';

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
