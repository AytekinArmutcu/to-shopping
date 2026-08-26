import {
  buildSharedList,
  buildShareText,
  parseSharedList,
  planImport,
  serializeSharedList,
  shareFileName,
  SHARED_LIST_FORMAT,
  SHARED_LIST_VERSION,
  type SharedItem,
  type SharedListFile,
} from './logic';

const item = (overrides: Partial<SharedItem> & { name: string }): SharedItem => ({
  category: null,
  quantity: 1,
  unit: 'stueck',
  note: null,
  ...overrides,
});

const milch = item({ name: 'Milch', category: 'Kühlregal', quantity: 2, unit: 'l' });
const bananen = item({
  name: 'Bananen',
  category: 'Obst & Gemüse',
  quantity: 1,
  unit: 'bund',
  note: 'reif',
});

describe('buildSharedList und serializeSharedList', () => {
  it('setzt Format, Version und Zeitpunkt', () => {
    const file = buildSharedList('Rewe', [milch], ['Kühlregal'], new Date('2026-08-18T18:22:00Z'));
    expect(file.format).toBe(SHARED_LIST_FORMAT);
    expect(file.version).toBe(SHARED_LIST_VERSION);
    expect(file.exportedAt).toBe('2026-08-18T18:22:00.000Z');
    expect(file.list.name).toBe('Rewe');
  });

  it('erzeugt eine Datei, die sich wieder einlesen laesst', () => {
    const file = buildSharedList('Rewe', [milch, bananen], ['Kühlregal', 'Obst & Gemüse']);
    const result = parseSharedList(serializeSharedList(file));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.list.items).toEqual([milch, bananen]);
      expect(result.file.list.categoryOrder).toEqual(['Kühlregal', 'Obst & Gemüse']);
      expect(result.skipped).toBe(0);
    }
  });
});

describe('parseSharedList lehnt ab', () => {
  it('was kein JSON ist', () => {
    expect(parseSharedList('das ist keine Datei')).toEqual({ ok: false, reason: 'unlesbar' });
  });

  it('eine abgeschnittene Datei', () => {
    expect(parseSharedList('{"format":"to-shopping.list",')).toEqual({
      ok: false,
      reason: 'unlesbar',
    });
  });

  it('JSON, das kein Objekt ist', () => {
    expect(parseSharedList('[1,2,3]')).toEqual({ ok: false, reason: 'unlesbar' });
    expect(parseSharedList('"text"')).toEqual({ ok: false, reason: 'unlesbar' });
    expect(parseSharedList('null')).toEqual({ ok: false, reason: 'unlesbar' });
  });

  it('ein fremdes Format', () => {
    const fremd = JSON.stringify({
      format: 'irgendwas',
      version: 1,
      list: { name: 'x', items: [] },
    });
    expect(parseSharedList(fremd)).toEqual({ ok: false, reason: 'fremdesFormat' });
  });

  it('eine Datei aus einer neueren Fassung der App', () => {
    const neuer = JSON.stringify({
      format: SHARED_LIST_FORMAT,
      version: SHARED_LIST_VERSION + 1,
      list: { name: 'Rewe', items: [] },
    });
    expect(parseSharedList(neuer)).toEqual({ ok: false, reason: 'zuNeu' });
  });

  it('eine unsinnige Version', () => {
    for (const version of [0, -1, 'eins', null]) {
      const raw = JSON.stringify({
        format: SHARED_LIST_FORMAT,
        version,
        list: { name: 'x', items: [] },
      });
      expect(parseSharedList(raw)).toEqual({ ok: false, reason: 'unlesbar' });
    }
  });

  it('eine Datei ohne brauchbare Liste', () => {
    const ohneListe = JSON.stringify({ format: SHARED_LIST_FORMAT, version: 1 });
    expect(parseSharedList(ohneListe)).toEqual({ ok: false, reason: 'unlesbar' });

    const ohneArtikel = JSON.stringify({
      format: SHARED_LIST_FORMAT,
      version: 1,
      list: { name: 'Rewe' },
    });
    expect(parseSharedList(ohneArtikel)).toEqual({ ok: false, reason: 'unlesbar' });
  });
});

describe('parseSharedList raeumt auf', () => {
  const withItems = (items: unknown[]) =>
    parseSharedList(
      JSON.stringify({
        format: SHARED_LIST_FORMAT,
        version: 1,
        exportedAt: '2026-08-18T18:22:00.000Z',
        list: { name: '  Rewe  ', categoryOrder: ['Kühlregal', 7, null], items },
      }),
    );

  it('kuerzt den Listennamen und wirft kaputte Kategorien weg', () => {
    const result = withItems([]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.list.name).toBe('Rewe');
      expect(result.file.list.categoryOrder).toEqual(['Kühlregal']);
    }
  });

  it('ueberspringt Eintraege ohne Namen und zaehlt sie', () => {
    const result = withItems([{ quantity: 2 }, { name: '   ' }, 'text', null, { name: 'Milch' }]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.list.items.map((entry) => entry.name)).toEqual(['Milch']);
      expect(result.skipped).toBe(4);
    }
  });

  it('ersetzt unsinnige Mengen durch 1', () => {
    const result = withItems([
      { name: 'A', quantity: 0 },
      { name: 'B', quantity: -5 },
      { name: 'C', quantity: 'zwei' },
      { name: 'D' },
    ]);
    if (result.ok) {
      expect(result.file.list.items.map((entry) => entry.quantity)).toEqual([1, 1, 1, 1]);
    }
  });

  it('ersetzt unbekannte Einheiten durch Stueck', () => {
    const result = withItems([
      { name: 'A', unit: 'kiste' },
      { name: 'B', unit: 'kg' },
    ]);
    if (result.ok) {
      expect(result.file.list.items.map((entry) => entry.unit)).toEqual(['stueck', 'kg']);
    }
  });

  it('macht aus leeren Notizen und Kategorien null', () => {
    const result = withItems([{ name: 'A', note: '   ', category: '' }]);
    if (result.ok) {
      expect(result.file.list.items[0]?.note).toBeNull();
      expect(result.file.list.items[0]?.category).toBeNull();
    }
  });
});

describe('buildShareText', () => {
  const labels = {
    header: 'Einkaufsliste „Rewe" (2 Artikel)',
    unitShort: (unit: string) => ({ l: 'l', bund: 'Bund', stueck: '×', kg: 'kg' })[unit] ?? unit,
  };

  it('schreibt Kopfzeile und Artikel untereinander', () => {
    expect(buildShareText([milch, bananen], labels)).toBe(
      ['Einkaufsliste „Rewe" (2 Artikel)', '• 2 l Milch', '• 1 Bund Bananen (reif)'].join('\n'),
    );
  });

  it('laesst die Menge 1 bei Stueck weg', () => {
    expect(buildShareText([item({ name: 'Brot' })], labels)).toContain('• Brot');
  });

  it('schreibt Stueckzahlen ab zwei', () => {
    expect(buildShareText([item({ name: 'Brot', quantity: 3 })], labels)).toContain('• 3× Brot');
  });

  it('haengt die Notiz in Klammern an', () => {
    expect(buildShareText([item({ name: 'Brot', note: 'dunkel' })], labels)).toContain(
      '• Brot (dunkel)',
    );
  });

  it('liefert bei leerer Liste nur die Kopfzeile', () => {
    expect(buildShareText([], labels)).toBe('Einkaufsliste „Rewe" (2 Artikel)');
  });
});

describe('planImport', () => {
  const katalog = [
    { id: 'p-milch', name: 'Milch' },
    { id: 'p-brot', name: 'Brot' },
  ];
  const kategorien = [
    { id: 'kuehlregal', name: 'Kühlregal' },
    { id: 'obst-gemuese', name: 'Obst & Gemüse' },
    { id: 'sonstiges', name: 'Sonstiges' },
  ];

  const fileWith = (items: SharedItem[], categoryOrder: string[] = []): SharedListFile =>
    buildSharedList('Rewe', items, categoryOrder);

  it('verknuepft bekannte Produkte, ohne sie anzulegen', () => {
    const plan = planImport(fileWith([milch]), katalog, kategorien, 'sonstiges');
    expect(plan.newProducts).toEqual([]);
    expect(plan.items[0]?.productId).toBe('p-milch');
  });

  it('achtet dabei nicht auf Gross- und Kleinschreibung', () => {
    const plan = planImport(fileWith([item({ name: 'MILCH' })]), katalog, kategorien, 'sonstiges');
    expect(plan.newProducts).toEqual([]);
    expect(plan.items[0]?.productId).toBe('p-milch');
  });

  it('legt unbekannte Produkte an (FR-6.3)', () => {
    const plan = planImport(fileWith([bananen]), katalog, kategorien, 'sonstiges');
    expect(plan.newProducts).toEqual([
      { id: 'p-bananen', name: 'Bananen', categoryId: 'obst-gemuese' },
    ]);
    expect(plan.items[0]?.productId).toBe('p-bananen');
  });

  it('legt ein unbekanntes Produkt nur einmal an, auch wenn es zweimal vorkommt', () => {
    const plan = planImport(
      fileWith([item({ name: 'Bananen' }), item({ name: 'bananen' })]),
      katalog,
      kategorien,
      'sonstiges',
    );
    expect(plan.newProducts).toHaveLength(1);
    expect(plan.items).toHaveLength(2);
    expect(plan.items[0]?.productId).toBe(plan.items[1]?.productId);
  });

  it('weicht auf eine freie Kennung aus, wenn die naheliegende vergeben ist', () => {
    const plan = planImport(
      fileWith([item({ name: 'Öl' })]),
      [{ id: 'p-oel', name: 'Speiseöl' }],
      kategorien,
      'sonstiges',
    );
    expect(plan.newProducts[0]?.id).toBe('p-oel-2');
  });

  it('steckt unbekannte Kategorien in die Ersatzkategorie', () => {
    const plan = planImport(
      fileWith([item({ name: 'Schrauben', category: 'Baumarkt' })]),
      katalog,
      kategorien,
      'sonstiges',
    );
    expect(plan.items[0]?.categoryId).toBe('sonstiges');
    expect(plan.newProducts[0]?.categoryId).toBe('sonstiges');
  });

  it('steckt Artikel ohne Kategorie ebenfalls in die Ersatzkategorie', () => {
    const plan = planImport(fileWith([item({ name: 'Kerze' })]), katalog, kategorien, 'sonstiges');
    expect(plan.items[0]?.categoryId).toBe('sonstiges');
  });

  it('uebernimmt Menge, Einheit und Notiz', () => {
    const plan = planImport(fileWith([bananen]), katalog, kategorien, 'sonstiges');
    expect(plan.items[0]).toMatchObject({
      quantity: 1,
      unit: 'bund',
      note: 'reif',
      position: 0,
    });
  });

  it('behaelt die Reihenfolge der Artikel', () => {
    const plan = planImport(
      fileWith([item({ name: 'A' }), item({ name: 'B' }), item({ name: 'C' })]),
      katalog,
      kategorien,
      'sonstiges',
    );
    expect(plan.items.map((entry) => entry.position)).toEqual([0, 1, 2]);
    expect(plan.items.map((entry) => entry.name)).toEqual(['A', 'B', 'C']);
  });

  it('uebersetzt das Ladenlayout in eigene Kategorien und laesst Fremdes weg', () => {
    const plan = planImport(
      fileWith([], ['Kühlregal', 'Baumarkt', 'Obst & Gemüse']),
      katalog,
      kategorien,
      'sonstiges',
    );
    expect(plan.categoryOrder).toEqual(['kuehlregal', 'obst-gemuese']);
  });

  it('kommt mit einer leeren Liste zurecht', () => {
    const plan = planImport(fileWith([]), katalog, kategorien, 'sonstiges');
    expect(plan).toEqual({ newProducts: [], items: [], categoryOrder: [] });
  });

  it('kommt mit leerem Katalog zurecht', () => {
    const plan = planImport(fileWith([milch]), [], kategorien, 'sonstiges');
    expect(plan.newProducts).toHaveLength(1);
    expect(plan.items[0]?.productId).toBe(plan.newProducts[0]?.id);
  });
});

describe('shareFileName', () => {
  it('haengt die Endung an', () => {
    expect(shareFileName('Rewe', 'Einkaufsliste')).toBe('Rewe.tsl');
  });

  it('behaelt Umlaute und Leerzeichen', () => {
    expect(shareFileName('Groß­einkauf für Ömer', 'Einkaufsliste')).toContain('.tsl');
    expect(shareFileName('Wocheneinkauf Rewe', 'Einkaufsliste')).toBe('Wocheneinkauf Rewe.tsl');
  });

  it('entfernt Zeichen, an denen Dateisysteme scheitern', () => {
    expect(shareFileName('Rewe/Aldi: 2*', 'Einkaufsliste')).toBe('Rewe Aldi 2.tsl');
  });

  it('nimmt den Ersatznamen, wenn nichts uebrig bleibt', () => {
    expect(shareFileName('///', 'Einkaufsliste')).toBe('Einkaufsliste.tsl');
    expect(shareFileName('   ', 'Einkaufsliste')).toBe('Einkaufsliste.tsl');
  });

  it('kuerzt sehr lange Namen', () => {
    expect(shareFileName('x'.repeat(200), 'Einkaufsliste')).toBe(`${'x'.repeat(60)}.tsl`);
  });
});
