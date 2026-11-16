import type { ProductStats } from '@/features/suggestions/logic';

import {
  buildPantryChecklist,
  countInPantry,
  countMissing,
  missingProductIds,
  pantryAdditions,
  type PantrySection,
} from './logic';

const entwurf = (productId: string | null) => ({ productId });

const produkt = (
  name: string,
  categoryId: string | null = 'obst',
  id = `p-${name.toLowerCase()}`,
) => ({
  id,
  name,
  categoryId,
});

const kauf = (productId: string, purchaseCount = 1): ProductStats => ({
  productId,
  purchaseCount,
  lastPurchasedAt: purchaseCount > 0 ? 1_000 : null,
});

const kategorie = (id: string, name: string, defaultPosition: number) => ({
  id,
  name,
  defaultPosition,
});

const KATEGORIEN = [
  kategorie('obst', 'Obst & Gemüse', 1),
  kategorie('milch', 'Milchprodukte', 2),
  kategorie('sonstiges', 'Sonstiges', 99),
];

describe('pantryAdditions', () => {
  it('nimmt doppelte Produkte nur einmal (T-13.2)', () => {
    expect(pantryAdditions([entwurf('a'), entwurf('b'), entwurf('a')])).toEqual(['a', 'b']);
  });

  it('verwirft Artikel ohne Produktbezug (T-13.2)', () => {
    expect(pantryAdditions([entwurf(null), entwurf('a'), entwurf(null), entwurf('')])).toEqual([
      'a',
    ]);
  });

  it('macht aus leerer Eingabe ein leeres Array (T-13.2)', () => {
    expect(pantryAdditions([])).toEqual([]);
  });

  it('behaelt die Reihenfolge des ersten Auftretens (T-13.2)', () => {
    expect(pantryAdditions([entwurf('c'), entwurf('a'), entwurf('c'), entwurf('b')])).toEqual([
      'c',
      'a',
      'b',
    ]);
  });
});

describe('buildPantryChecklist', () => {
  it('zeigt ein gekauftes Produkt, das nicht im Vorrat ist, ohne Haken (T-13.2)', () => {
    const sections = buildPantryChecklist(
      [produkt('Milch', 'milch')],
      [kauf('p-milch')],
      [],
      KATEGORIEN,
    );

    expect(sections).toEqual([
      {
        key: 'milch',
        title: 'Milchprodukte',
        items: [{ productId: 'p-milch', name: 'Milch', inPantry: false }],
      },
    ]);
  });

  it('zeigt ein Produkt im Vorrat ohne Kaufhistorie mit Haken (T-13.2)', () => {
    const sections = buildPantryChecklist(
      [produkt('Butter', 'milch')],
      [],
      ['p-butter'],
      KATEGORIEN,
    );

    expect(sections[0]?.items).toEqual([{ productId: 'p-butter', name: 'Butter', inPantry: true }]);
  });

  it('laesst Produkte ohne Kaufhistorie und ohne Vorrat weg (T-13.2)', () => {
    const sections = buildPantryChecklist(
      [produkt('Kaviar', 'sonstiges'), produkt('Milch', 'milch')],
      [kauf('p-kaviar', 0), kauf('p-milch')],
      [],
      KATEGORIEN,
    );

    expect(sections.flatMap((section) => section.items.map((item) => item.name))).toEqual([
      'Milch',
    ]);
  });

  it('ordnet die Abschnitte nach defaultPosition, nicht nach Eingabe (T-13.2)', () => {
    const sections = buildPantryChecklist(
      [produkt('Seife', 'sonstiges'), produkt('Milch', 'milch'), produkt('Apfel', 'obst')],
      [kauf('p-seife'), kauf('p-milch'), kauf('p-apfel')],
      [],
      [KATEGORIEN[2]!, KATEGORIEN[1]!, KATEGORIEN[0]!],
    );

    expect(sections.map((section) => section.key)).toEqual(['obst', 'milch', 'sonstiges']);
  });

  it('legt Produkte ohne Kategorie unter Sonstiges ab (T-13.2)', () => {
    const sections = buildPantryChecklist(
      [produkt('Ding', null)],
      [kauf('p-ding')],
      [],
      KATEGORIEN,
    );

    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ key: 'sonstiges', title: 'Sonstiges' });
  });

  it('legt Produkte mit unbekannter Kategorie unter Sonstiges ab (T-13.2)', () => {
    const sections = buildPantryChecklist(
      [produkt('Ding', 'gibt-es-nicht')],
      [kauf('p-ding')],
      [],
      KATEGORIEN,
    );

    expect(sections.map((section) => section.key)).toEqual(['sonstiges']);
    expect(sections[0]?.items[0]?.name).toBe('Ding');
  });

  it('nimmt die ID als Titel, wenn es die Ersatzkategorie nicht gibt (T-13.2)', () => {
    const sections = buildPantryChecklist(
      [produkt('Ding', null)],
      [kauf('p-ding')],
      [],
      [KATEGORIEN[0]!],
    );

    expect(sections).toEqual([
      {
        key: 'sonstiges',
        title: 'sonstiges',
        items: [{ productId: 'p-ding', name: 'Ding', inPantry: false }],
      },
    ]);
  });

  it('laesst leere Abschnitte weg (T-13.2)', () => {
    const sections = buildPantryChecklist(
      [produkt('Apfel', 'obst')],
      [kauf('p-apfel')],
      [],
      KATEGORIEN,
    );

    expect(sections.map((section) => section.key)).toEqual(['obst']);
  });

  it('sortiert innerhalb eines Abschnitts deutsch alphabetisch (T-13.2)', () => {
    const sections = buildPantryChecklist(
      [produkt('Zitrone'), produkt('Äpfel'), produkt('Birne'), produkt('Ananas')],
      [kauf('p-zitrone'), kauf('p-äpfel'), kauf('p-birne'), kauf('p-ananas')],
      [],
      KATEGORIEN,
    );

    expect(sections[0]?.items.map((item) => item.name)).toEqual([
      'Ananas',
      'Äpfel',
      'Birne',
      'Zitrone',
    ]);
  });

  it('setzt key jedes Abschnitts auf die Kategorie-ID (T-13.2)', () => {
    const sections = buildPantryChecklist(
      [produkt('Apfel', 'obst'), produkt('Milch', 'milch')],
      [kauf('p-apfel')],
      ['p-milch'],
      KATEGORIEN,
    );

    for (const section of sections) {
      expect(Object.keys(section)).toEqual(['key', 'title', 'items']);
    }
    expect(sections.map((section) => section.key)).toEqual(['obst', 'milch']);
  });

  it('macht aus leeren Eingaben ein leeres Array (T-13.2)', () => {
    expect(buildPantryChecklist([], [], [], [])).toEqual([]);
    expect(buildPantryChecklist([], [], [], KATEGORIEN)).toEqual([]);
  });
});

describe('missingProductIds / countMissing', () => {
  const abschnitte: PantrySection[] = [
    {
      key: 'obst',
      title: 'Obst',
      items: [
        { productId: 'a', name: 'A', inPantry: false },
        { productId: 'b', name: 'B', inPantry: true },
      ],
    },
    {
      key: 'milch',
      title: 'Milch',
      items: [
        { productId: 'c', name: 'C', inPantry: true },
        { productId: 'd', name: 'D', inPantry: false },
      ],
    },
  ];

  it('liefert die Fehlenden einer gemischten Liste in Anzeigereihenfolge (T-13.2)', () => {
    expect(missingProductIds(abschnitte)).toEqual(['a', 'd']);
    expect(countMissing(abschnitte)).toBe(2);
    expect(countInPantry(abschnitte)).toBe(2);
  });

  it('zaehlt ohne Abschnitte nichts als da (ADR-049)', () => {
    expect(countInPantry([])).toBe(0);
  });

  it('liefert nichts, wenn alles da ist (T-13.2)', () => {
    const allesDa = abschnitte.map((section) => ({
      ...section,
      items: section.items.map((item) => ({ ...item, inPantry: true })),
    }));

    expect(missingProductIds(allesDa)).toEqual([]);
    expect(countMissing(allesDa)).toBe(0);
    expect(countInPantry(allesDa)).toBe(4);
  });
});
