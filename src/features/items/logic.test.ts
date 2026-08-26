import { UNITS } from '@/db/units';

import {
  buildHistoryDrafts,
  canFinishShopping,
  cleanNote,
  formatQuantity,
  idsToRemoveOnFinish,
  MAX_NOTE_LENGTH,
  MAX_QUANTITY,
  parseQuantity,
  partitionItems,
  stepQuantity,
  type ListItemLike,
} from './logic';

const item = (overrides: Partial<ListItemLike> & { id: string }): ListItemLike => ({
  listId: 'l-1',
  productId: `p-${overrides.id}`,
  name: overrides.id,
  quantity: 1,
  unit: 'stueck',
  isChecked: false,
  position: 0,
  ...overrides,
});

describe('partitionItems', () => {
  const items = [
    item({ id: 'Milch', position: 0 }),
    item({ id: 'Brot', position: 1, isChecked: true }),
    item({ id: 'Äpfel', position: 2 }),
  ];

  it('zeigt erledigte Artikel standardmaessig nicht', () => {
    const result = partitionItems(items, false);
    expect(result.visible.map((entry) => entry.name)).toEqual(['Milch', 'Äpfel']);
  });

  it('zaehlt offen und erledigt getrennt', () => {
    const result = partitionItems(items, false);
    expect(result.openCount).toBe(2);
    expect(result.checkedCount).toBe(1);
  });

  it('haengt erledigte Artikel beim Einblenden hinten an', () => {
    const result = partitionItems(items, true);
    expect(result.visible.map((entry) => entry.name)).toEqual(['Milch', 'Äpfel', 'Brot']);
  });

  it('behaelt die Reihenfolge nach position bei', () => {
    const shuffled = [
      item({ id: 'C', position: 2 }),
      item({ id: 'A', position: 0 }),
      item({ id: 'B', position: 1 }),
    ];
    expect(partitionItems(shuffled, false).visible.map((entry) => entry.name)).toEqual([
      'A',
      'B',
      'C',
    ]);
  });

  it('kommt mit einer leeren Liste zurecht', () => {
    expect(partitionItems([], true)).toEqual({ visible: [], openCount: 0, checkedCount: 0 });
  });

  it('zeigt nichts an, wenn alles erledigt und ausgeblendet ist', () => {
    const allDone = [item({ id: 'A', isChecked: true })];
    const result = partitionItems(allDone, false);
    expect(result.visible).toEqual([]);
    expect(result.openCount).toBe(0);
    expect(result.checkedCount).toBe(1);
  });

  it('veraendert die Eingabeliste nicht', () => {
    const original = [item({ id: 'B', position: 1 }), item({ id: 'A', position: 0 })];
    partitionItems(original, true);
    expect(original.map((entry) => entry.name)).toEqual(['B', 'A']);
  });
});

describe('buildHistoryDrafts', () => {
  const items = [
    item({ id: 'Milch', isChecked: true, quantity: 2, unit: 'l' }),
    item({ id: 'Brot', isChecked: false }),
  ];

  it('nimmt nur abgehakte Artikel auf', () => {
    const drafts = buildHistoryDrafts(items, 1000);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.name).toBe('Milch');
  });

  it('uebernimmt Menge und Einheit als Kopie', () => {
    const drafts = buildHistoryDrafts(items, 1000);
    expect(drafts[0]?.quantity).toBe(2);
    expect(drafts[0]?.unit).toBe('l');
  });

  it('setzt bei allen Eintraegen denselben Zeitpunkt', () => {
    const zwei = [
      item({ id: 'A', isChecked: true }),
      item({ id: 'B', isChecked: true, position: 1 }),
    ];
    const drafts = buildHistoryDrafts(zwei, 4242);
    expect(drafts.map((draft) => draft.purchasedAt)).toEqual([4242, 4242]);
  });

  it('behaelt einen fehlenden Produktbezug bei', () => {
    const freitext = [item({ id: 'Sonderwunsch', isChecked: true, productId: null })];
    expect(buildHistoryDrafts(freitext, 1)[0]?.productId).toBeNull();
  });

  it('liefert nichts, wenn nichts abgehakt ist', () => {
    expect(buildHistoryDrafts([item({ id: 'A' })], 1)).toEqual([]);
  });
});

describe('idsToRemoveOnFinish', () => {
  it('nennt genau die abgehakten Artikel', () => {
    const items = [item({ id: 'A', isChecked: true }), item({ id: 'B' })];
    expect(idsToRemoveOnFinish(items)).toEqual(['A']);
  });
});

describe('canFinishShopping', () => {
  it('ist wahr, sobald ein Artikel abgehakt ist', () => {
    expect(canFinishShopping([{ isChecked: false }, { isChecked: true }])).toBe(true);
  });

  it('ist falsch, wenn nichts abgehakt ist', () => {
    expect(canFinishShopping([{ isChecked: false }])).toBe(false);
    expect(canFinishShopping([])).toBe(false);
  });
});

describe('formatQuantity', () => {
  it('blendet die Menge 1 bei Stueck aus', () => {
    expect(formatQuantity({ quantity: 1, unit: 'stueck' }, '×')).toBeNull();
  });

  it('zeigt Stueckzahlen ab zwei', () => {
    expect(formatQuantity({ quantity: 3, unit: 'stueck' }, '×')).toBe('3×');
  });

  it('zeigt andere Einheiten auch bei der Menge 1', () => {
    expect(formatQuantity({ quantity: 1, unit: 'l' }, 'l')).toBe('1 l');
  });

  it('haengt die Einheit an', () => {
    expect(formatQuantity({ quantity: 500, unit: 'g' }, 'g')).toBe('500 g');
    expect(formatQuantity({ quantity: 2, unit: 'packung' }, 'Pck.')).toBe('2 Pck.');
  });

  it('schreibt Kommazahlen mit Komma', () => {
    expect(formatQuantity({ quantity: 1.5, unit: 'kg' }, 'kg')).toBe('1,5 kg');
  });
});

/**
 * Alle acht Einheiten, jeweils mit Menge 1 und Menge 2 (T-4.2).
 *
 * Die Tabelle wird gegen UNITS geprueft: Kommt eine neue Einheit dazu, faellt
 * dieser Test um, bis sie hier eingetragen ist. Ohne das waere eine neue
 * Einheit ungetestet im Laden gelandet.
 */
describe('formatQuantity ueber alle Einheiten', () => {
  const cases: { unit: string; short: string; one: string | null; two: string }[] = [
    { unit: 'stueck', short: '×', one: null, two: '2×' },
    { unit: 'g', short: 'g', one: '1 g', two: '2 g' },
    { unit: 'kg', short: 'kg', one: '1 kg', two: '2 kg' },
    { unit: 'ml', short: 'ml', one: '1 ml', two: '2 ml' },
    { unit: 'l', short: 'l', one: '1 l', two: '2 l' },
    { unit: 'packung', short: 'Pck.', one: '1 Pck.', two: '2 Pck.' },
    { unit: 'bund', short: 'Bund', one: '1 Bund', two: '2 Bund' },
    { unit: 'dose', short: 'Dose', one: '1 Dose', two: '2 Dose' },
  ];

  it('deckt jede Einheit aus UNITS ab', () => {
    expect(cases.map((entry) => entry.unit).sort()).toEqual([...UNITS].sort());
  });

  it.each(cases)('formatiert $unit', ({ unit, short, one, two }) => {
    expect(formatQuantity({ quantity: 1, unit }, short)).toBe(one);
    expect(formatQuantity({ quantity: 2, unit }, short)).toBe(two);
  });

  it('zeigt auch grosse und gebrochene Mengen lesbar', () => {
    expect(formatQuantity({ quantity: 1500, unit: 'g' }, 'g')).toBe('1500 g');
    expect(formatQuantity({ quantity: 0.5, unit: 'kg' }, 'kg')).toBe('0,5 kg');
    expect(formatQuantity({ quantity: 2.25, unit: 'l' }, 'l')).toBe('2,25 l');
  });
});

describe('stepQuantity', () => {
  it('zaehlt Stueck in Einerschritten', () => {
    expect(stepQuantity(1, 'stueck', 1)).toBe(2);
    expect(stepQuantity(3, 'stueck', -1)).toBe(2);
  });

  it('geht bei Gewicht und Volumen in brauchbaren Spruengen', () => {
    expect(stepQuantity(500, 'g', 1)).toBe(550);
    expect(stepQuantity(500, 'ml', -1)).toBe(450);
    expect(stepQuantity(1, 'kg', 1)).toBe(1.5);
    expect(stepQuantity(1.5, 'l', -1)).toBe(1);
  });

  it('faellt nie unter die Schrittweite', () => {
    expect(stepQuantity(1, 'stueck', -1)).toBe(1);
    expect(stepQuantity(50, 'g', -1)).toBe(50);
    expect(stepQuantity(0.5, 'kg', -1)).toBe(0.5);
  });

  it('macht aus einem kleinen Wert beim Verringern keinen groesseren', () => {
    expect(stepQuantity(30, 'g', -1)).toBe(30);
  });

  it('bleibt unter der Obergrenze', () => {
    expect(stepQuantity(MAX_QUANTITY, 'stueck', 1)).toBe(MAX_QUANTITY);
  });

  it('behandelt eine unbekannte Einheit wie zaehlbar', () => {
    expect(stepQuantity(2, 'kiste', 1)).toBe(3);
  });

  it('rechnet ohne Kommafehler', () => {
    expect(stepQuantity(0.5, 'kg', 1)).toBe(1);
    expect(stepQuantity(2.5, 'l', 1)).toBe(3);
  });
});

describe('parseQuantity', () => {
  it('liest ganze Zahlen', () => {
    expect(parseQuantity('3')).toBe(3);
    expect(parseQuantity(' 500 ')).toBe(500);
  });

  it('liest das deutsche Komma und den Punkt', () => {
    expect(parseQuantity('1,5')).toBe(1.5);
    expect(parseQuantity('1.5')).toBe(1.5);
    expect(parseQuantity(',5')).toBe(0.5);
  });

  it('lehnt ab, was keine Menge ist', () => {
    expect(parseQuantity('')).toBeNull();
    expect(parseQuantity('   ')).toBeNull();
    expect(parseQuantity('abc')).toBeNull();
    expect(parseQuantity('2 Stueck')).toBeNull();
    expect(parseQuantity('-2')).toBeNull();
    expect(parseQuantity('0')).toBeNull();
    expect(parseQuantity('0,0')).toBeNull();
  });

  it('deckelt Vertipper', () => {
    expect(parseQuantity('50000')).toBe(MAX_QUANTITY);
  });

  it('rundet auf drei Nachkommastellen', () => {
    expect(parseQuantity('1,23456')).toBe(1.235);
  });
});

describe('cleanNote', () => {
  it('macht aus leerem Text null', () => {
    expect(cleanNote('')).toBeNull();
    expect(cleanNote('   ')).toBeNull();
  });

  it('raeumt Leerzeichen auf', () => {
    expect(cleanNote('  laktosefrei  ')).toBe('laktosefrei');
    expect(cleanNote('ohne    Zucker')).toBe('ohne Zucker');
  });

  it('behaelt Zeilenumbrueche', () => {
    expect(cleanNote('rot\ngross')).toBe('rot\ngross');
  });

  it('kuerzt zu lange Notizen', () => {
    expect(cleanNote('a'.repeat(300))).toHaveLength(MAX_NOTE_LENGTH);
  });
});
