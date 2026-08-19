import {
  buildHistoryDrafts,
  canFinishShopping,
  formatQuantity,
  idsToRemoveOnFinish,
  partitionItems,
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
