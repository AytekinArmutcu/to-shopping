import type { CatalogProduct } from '@/features/catalog/logic';

import {
  historyWindowStart,
  rankSuggestions,
  recencyScore,
  RECENCY_HALF_LIFE_DAYS,
  SUGGESTION_WEIGHTS,
  toProductStats,
  type ProductStats,
} from './logic';

const TAG = 24 * 60 * 60 * 1000;
const JETZT = new Date('2026-08-26T12:00:00Z').getTime();

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
  product('p-brot', 'Brot'),
  product('p-muesli', 'Müsli'),
];

const stat = (
  productId: string,
  purchaseCount: number,
  tageHer: number | null = 0,
): ProductStats => ({
  productId,
  purchaseCount,
  lastPurchasedAt: tageHer === null ? null : JETZT - tageHer * TAG,
});

const namen = (result: ReturnType<typeof rankSuggestions>) =>
  result.suggestions.map((entry) => entry.product.name);

describe('recencyScore', () => {
  it('gibt heute den vollen Wert', () => {
    expect(recencyScore(JETZT, JETZT)).toBe(1);
  });

  it('halbiert sich nach der Halbwertszeit', () => {
    expect(recencyScore(JETZT - RECENCY_HALF_LIFE_DAYS * TAG, JETZT)).toBeCloseTo(0.5, 5);
    expect(recencyScore(JETZT - 2 * RECENCY_HALF_LIFE_DAYS * TAG, JETZT)).toBeCloseTo(0.25, 5);
  });

  it('zerfaellt weich, nicht in Stufen', () => {
    const a = recencyScore(JETZT - 29 * TAG, JETZT);
    const b = recencyScore(JETZT - 31 * TAG, JETZT);
    expect(a).toBeGreaterThan(b);
    expect(a - b).toBeLessThan(0.05);
  });

  it('gibt null ohne jeden Kauf', () => {
    expect(recencyScore(null, JETZT)).toBe(0);
  });

  it('behandelt einen Kauf in der Zukunft wie heute', () => {
    expect(recencyScore(JETZT + 5 * TAG, JETZT)).toBe(1);
  });
});

describe('historyWindowStart', () => {
  it('liegt die vorgesehene Zeit zurueck', () => {
    const start = historyWindowStart(JETZT, 180);
    expect(JETZT - start).toBeGreaterThanOrEqual(180 * TAG);
    expect(JETZT - start).toBeLessThan(181 * TAG);
  });

  it('aendert sich innerhalb eines Tages nicht', () => {
    expect(historyWindowStart(JETZT)).toBe(historyWindowStart(JETZT + 6 * 60 * 60 * 1000));
  });
});

describe('rankSuggestions – Haeufigkeit', () => {
  it('stellt das haeufiger gekaufte Produkt nach vorn', () => {
    const stats = [stat('p-hafermilch', 10), stat('p-milch', 2)];
    expect(namen(rankSuggestions('milch', katalog, stats, [], JETZT))[0]).toBe('Hafermilch');
  });

  it('normiert auf den Hoechstwert - absolute Zahlen zaehlen nicht', () => {
    const wenig = rankSuggestions(
      'milch',
      katalog,
      [stat('p-milch', 2), stat('p-hafermilch', 1)],
      [],
      JETZT,
    );
    const viel = rankSuggestions(
      'milch',
      katalog,
      [stat('p-milch', 200), stat('p-hafermilch', 100)],
      [],
      JETZT,
    );
    expect(namen(wenig)).toEqual(namen(viel));
  });

  it('laesst ein nie gekauftes Produkt hinter einem gekauften', () => {
    const stats = [stat('p-buttermilch', 3)];
    const reihenfolge = namen(rankSuggestions('milch', katalog, stats, [], JETZT));
    expect(reihenfolge[0]).toBe('Buttermilch');
  });
});

describe('rankSuggestions – Aktualitaet', () => {
  it('stellt bei gleicher Haeufigkeit das juengere nach vorn', () => {
    const stats = [stat('p-milch', 5, 90), stat('p-hafermilch', 5, 1)];
    expect(namen(rankSuggestions('milch', katalog, stats, [], JETZT))[0]).toBe('Hafermilch');
  });

  it('laesst Haeufigkeit schwerer wiegen als Aktualitaet', () => {
    // Milch: oft, aber lange her. Hafermilch: heute, aber nur einmal.
    const stats = [stat('p-milch', 10, 120), stat('p-hafermilch', 1, 0)];
    const milch = SUGGESTION_WEIGHTS.frequency * 1 + SUGGESTION_WEIGHTS.recency * 0.5 ** 4;
    const hafer = SUGGESTION_WEIGHTS.frequency * 0.1 + SUGGESTION_WEIGHTS.recency * 1;
    expect(milch).toBeGreaterThan(hafer);
    expect(namen(rankSuggestions('milch', katalog, stats, [], JETZT))[0]).toBe('Milch');
  });
});

describe('rankSuggestions – Trefferqualitaet', () => {
  it('stellt ohne Historie den Treffer am Wortanfang nach vorn', () => {
    expect(namen(rankSuggestions('milch', katalog, [], [], JETZT))[0]).toBe('Milch');
  });

  it('laesst die Trefferqualitaet die Historie nicht ueberstimmen', () => {
    const stats = [stat('p-hafermilch', 5, 0)];
    expect(namen(rankSuggestions('milch', katalog, stats, [], JETZT))[0]).toBe('Hafermilch');
  });

  it('sortiert bei voelligem Gleichstand alphabetisch', () => {
    const reihenfolge = namen(rankSuggestions('milch', katalog, [], [], JETZT));
    expect(reihenfolge).toEqual(['Milch', 'Buttermilch', 'Hafermilch']);
  });

  it('liefert bei gleichen Eingaben immer dieselbe Reihenfolge', () => {
    const stats = [stat('p-milch', 3, 5), stat('p-hafermilch', 3, 5)];
    const a = namen(rankSuggestions('milch', katalog, stats, [], JETZT));
    const b = namen(rankSuggestions('milch', [...katalog].reverse(), stats, [], JETZT));
    expect(a).toEqual(b);
  });
});

describe('rankSuggestions – Filtern und Ausschliessen', () => {
  it('findet nur Passendes', () => {
    expect(namen(rankSuggestions('brot', katalog, [], [], JETZT))).toEqual(['Brot']);
  });

  it('findet Umlaute in beiden Schreibweisen', () => {
    expect(namen(rankSuggestions('muesli', katalog, [], [], JETZT))).toEqual(['Müsli']);
    expect(namen(rankSuggestions('müsli', katalog, [], [], JETZT))).toEqual(['Müsli']);
    expect(namen(rankSuggestions('musli', katalog, [], [], JETZT))).toEqual(['Müsli']);
  });

  it('blendet aus, was offen auf der Liste steht', () => {
    const stats = [stat('p-milch', 9)];
    expect(namen(rankSuggestions('milch', katalog, stats, ['p-milch'], JETZT))).not.toContain(
      'Milch',
    );
  });

  it('begrenzt die Anzahl', () => {
    expect(
      rankSuggestions(
        '',
        katalog,
        katalog.map((p) => stat(p.id, 1)),
        [],
        JETZT,
        2,
      ).suggestions,
    ).toHaveLength(2);
  });

  it('meldet canCreate nur ohne exakten Namenstreffer', () => {
    expect(rankSuggestions('Hafermilch', katalog, [], [], JETZT).canCreate).toBe(false);
    expect(rankSuggestions('hafermilch', katalog, [], [], JETZT).canCreate).toBe(false);
    expect(rankSuggestions('Ziegenmilch', katalog, [], [], JETZT).canCreate).toBe(true);
    expect(rankSuggestions('   ', katalog, [], [], JETZT).canCreate).toBe(false);
  });

  it('meldet canCreate auch, wenn das Produkt schon auf der Liste steht', () => {
    // Sonst boete die App an, ein Produkt anzulegen, das es laengst gibt.
    expect(rankSuggestions('Milch', katalog, [], ['p-milch'], JETZT).canCreate).toBe(false);
  });
});

describe('rankSuggestions – leere Eingabe (T-10.4)', () => {
  it('zeigt ohne Historie nichts', () => {
    expect(rankSuggestions('', katalog, [], [], JETZT).suggestions).toEqual([]);
  });

  it('zeigt die ueblichen Verdaechtigen, sobald es welche gibt', () => {
    const stats = [stat('p-brot', 12, 2), stat('p-milch', 20, 1)];
    expect(namen(rankSuggestions('', katalog, stats, [], JETZT))).toEqual(['Milch', 'Brot']);
  });

  it('zaehlt ein Produkt mit null Kaeufen nicht zu den Verdaechtigen', () => {
    const stats = [stat('p-brot', 0, 200), stat('p-milch', 4, 1)];
    expect(namen(rankSuggestions('', katalog, stats, [], JETZT))).toEqual(['Milch']);
  });

  it('laesst auch hier weg, was schon auf der Liste steht', () => {
    const stats = [stat('p-brot', 12), stat('p-milch', 20)];
    expect(namen(rankSuggestions('', katalog, stats, ['p-milch'], JETZT))).toEqual(['Brot']);
  });

  it('ignoriert Historie zu Produkten, die es nicht mehr gibt', () => {
    const stats = [stat('p-geloescht', 99, 0), stat('p-milch', 1, 0)];
    expect(namen(rankSuggestions('', katalog, stats, [], JETZT))).toEqual(['Milch']);
  });
});

describe('rankSuggestions – Randfaelle', () => {
  it('kommt mit leerem Katalog zurecht', () => {
    expect(rankSuggestions('milch', [], [], [], JETZT)).toEqual({
      suggestions: [],
      canCreate: true,
    });
  });

  it('kommt mit leerer Historie zurecht', () => {
    expect(namen(rankSuggestions('brot', katalog, [], [], JETZT))).toEqual(['Brot']);
  });

  it('kommt mit einem Produkt ohne Kaufzeitpunkt zurecht', () => {
    const stats = [{ productId: 'p-milch', purchaseCount: 3, lastPurchasedAt: null }];
    expect(namen(rankSuggestions('milch', katalog, stats, [], JETZT))[0]).toBe('Milch');
  });
});

describe('toProductStats', () => {
  it('uebernimmt Zeilen mit Produkt', () => {
    expect(
      toProductStats([{ productId: 'p-milch', purchaseCount: 3, lastPurchasedAt: 42 }]),
    ).toEqual([{ productId: 'p-milch', purchaseCount: 3, lastPurchasedAt: 42 }]);
  });

  it('laesst Historie ohne Produkt weg', () => {
    expect(toProductStats([{ productId: null, purchaseCount: 9, lastPurchasedAt: 1 }])).toEqual([]);
  });

  it('kommt mit einer leeren Historie zurecht', () => {
    expect(toProductStats([])).toEqual([]);
  });
});
