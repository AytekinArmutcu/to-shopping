import {
  buildTemplateItems,
  buildTemplateOverview,
  cleanTemplateName,
  MAX_TEMPLATE_NAME_LENGTH,
  planTemplateApply,
  type TargetItem,
  type TemplateSourceItem,
} from './logic';

const quelle = (overrides: Partial<TemplateSourceItem> & { name: string }): TemplateSourceItem => ({
  productId: `p-${overrides.name.toLowerCase()}`,
  categoryId: 'sonstiges',
  quantity: 1,
  unit: 'stueck',
  note: null,
  position: 0,
  ...overrides,
});

const eintrag = (name: string, productId: string | null, isChecked = false): TargetItem => ({
  productId,
  name,
  isChecked,
});

const vorlage = (name: string, productId: string | null = `p-${name.toLowerCase()}`) => ({
  productId,
  name,
});

describe('cleanTemplateName', () => {
  it('raeumt Leerzeichen auf', () => {
    expect(cleanTemplateName('  Wochen   einkauf ')).toBe('Wochen einkauf');
  });

  it('macht aus leerer Eingabe null', () => {
    expect(cleanTemplateName('')).toBeNull();
    expect(cleanTemplateName('    ')).toBeNull();
  });

  it('kuerzt zu lange Namen', () => {
    expect(cleanTemplateName('x'.repeat(200))).toHaveLength(MAX_TEMPLATE_NAME_LENGTH);
  });
});

describe('buildTemplateItems', () => {
  it('nimmt Menge, Einheit und Notiz mit (T-11.1)', () => {
    const items = buildTemplateItems([
      quelle({ name: 'Milch', quantity: 2, unit: 'l', note: 'laktosefrei' }),
    ]);

    expect(items[0]).toMatchObject({
      name: 'Milch',
      quantity: 2,
      unit: 'l',
      note: 'laktosefrei',
      productId: 'p-milch',
    });
  });

  it('behaelt die Reihenfolge der Liste und zaehlt sie neu durch', () => {
    const items = buildTemplateItems([
      quelle({ name: 'C', position: 7 }),
      quelle({ name: 'A', position: 2 }),
      quelle({ name: 'B', position: 5 }),
    ]);

    expect(items.map((entry) => entry.name)).toEqual(['A', 'B', 'C']);
    expect(items.map((entry) => entry.position)).toEqual([0, 1, 2]);
  });

  it('uebernimmt auch Artikel ohne Produktverknuepfung', () => {
    const items = buildTemplateItems([quelle({ name: 'Eigenes', productId: null })]);
    expect(items[0]?.productId).toBeNull();
  });

  it('kommt mit einer leeren Liste zurecht', () => {
    expect(buildTemplateItems([])).toEqual([]);
  });

  it('veraendert die uebergebene Liste nicht', () => {
    const original = [quelle({ name: 'B', position: 5 }), quelle({ name: 'A', position: 1 })];
    const kopie = [...original];
    buildTemplateItems(original);
    expect(original).toEqual(kopie);
  });
});

describe('planTemplateApply', () => {
  it('setzt alles auf eine leere Liste', () => {
    const plan = planTemplateApply([vorlage('Milch'), vorlage('Brot')], []);
    expect(plan.add.map((entry) => entry.name)).toEqual(['Milch', 'Brot']);
    expect(plan.skipped).toEqual([]);
  });

  it('ueberspringt, was ueber dieselbe Produkt-ID schon offen draufsteht', () => {
    const plan = planTemplateApply(
      [vorlage('Milch'), vorlage('Brot')],
      [eintrag('Milch', 'p-milch')],
    );
    expect(plan.add.map((entry) => entry.name)).toEqual(['Brot']);
    expect(plan.skipped.map((entry) => entry.name)).toEqual(['Milch']);
  });

  it('ueberspringt auch bei gleichem Namen ohne Produktverknuepfung', () => {
    // Ein Produkt kann aus dem Katalog geloescht worden sein - der Eintrag
    // bleibt dann als Text stehen (ADR-007).
    const plan = planTemplateApply([vorlage('Milch')], [eintrag('Milch', null)]);
    expect(plan.add).toEqual([]);
    expect(plan.skipped.map((entry) => entry.name)).toEqual(['Milch']);
  });

  it('vergleicht Namen ohne Ruecksicht auf Gross- und Kleinschreibung', () => {
    const plan = planTemplateApply([vorlage('Milch')], [eintrag('MILCH', null)]);
    expect(plan.add).toEqual([]);
  });

  it('erkennt auch eine andere Produkt-ID bei gleichem Namen', () => {
    const plan = planTemplateApply([vorlage('Milch', 'p-milch')], [eintrag('Milch', 'p-anders')]);
    expect(plan.add).toEqual([]);
  });

  it('setzt einen abgehakten Artikel wieder auf die Liste', () => {
    // Abgehakt heisst: liegt schon im Wagen oder ist erledigt. Die Vorlage
    // beschreibt den naechsten Einkauf.
    const plan = planTemplateApply([vorlage('Milch')], [eintrag('Milch', 'p-milch', true)]);
    expect(plan.add.map((entry) => entry.name)).toEqual(['Milch']);
    expect(plan.skipped).toEqual([]);
  });

  it('fuegt denselben Artikel auch aus der Vorlage nicht doppelt ein', () => {
    const plan = planTemplateApply([vorlage('Milch'), vorlage('Milch')], []);
    expect(plan.add).toHaveLength(1);
    expect(plan.skipped).toHaveLength(1);
  });

  it('behandelt zwei Vorlagenartikel ohne Produkt getrennt, wenn die Namen sich unterscheiden', () => {
    const plan = planTemplateApply([vorlage('A', null), vorlage('B', null)], []);
    expect(plan.add).toHaveLength(2);
  });

  it('kommt mit einer leeren Vorlage zurecht', () => {
    expect(planTemplateApply([], [eintrag('Milch', 'p-milch')])).toEqual({ add: [], skipped: [] });
  });

  it('laesst die Reihenfolge der Vorlage unangetastet', () => {
    const plan = planTemplateApply([vorlage('C'), vorlage('A'), vorlage('B')], []);
    expect(plan.add.map((entry) => entry.name)).toEqual(['C', 'A', 'B']);
  });
});

describe('buildTemplateOverview', () => {
  const vorlagen = [
    { id: 't-2', name: 'Wocheneinkauf', createdAt: 100 },
    { id: 't-1', name: 'Drogerie', createdAt: 200 },
  ];

  it('sortiert nach Namen, nicht nach Alter', () => {
    expect(buildTemplateOverview(vorlagen, []).map((row) => row.name)).toEqual([
      'Drogerie',
      'Wocheneinkauf',
    ]);
  });

  it('haengt die Anzahl der Artikel an', () => {
    const rows = buildTemplateOverview(vorlagen, [{ templateId: 't-2', itemCount: 7 }]);
    expect(rows.find((row) => row.id === 't-2')?.itemCount).toBe(7);
  });

  it('zeigt eine leere Vorlage mit null statt gar nicht', () => {
    expect(buildTemplateOverview(vorlagen, [])[0]?.itemCount).toBe(0);
  });

  it('sortiert bei gleichem Namen stabil nach id', () => {
    const gleich = [
      { id: 't-b', name: 'Gleich', createdAt: 1 },
      { id: 't-a', name: 'Gleich', createdAt: 2 },
    ];
    expect(buildTemplateOverview(gleich, []).map((row) => row.id)).toEqual(['t-a', 't-b']);
  });

  it('kommt ohne Vorlagen zurecht', () => {
    expect(buildTemplateOverview([], [])).toEqual([]);
  });
});
