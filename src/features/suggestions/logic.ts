import {
  cleanProductName,
  matchPosition,
  SUGGESTION_LIMIT,
  type CatalogProduct,
} from '@/features/catalog/logic';
import { expandForSearch, normalizeForSearch } from '@/lib/text';

/**
 * Das Vorschlagsranking aus architecture.md 4.2 (FR-5.2).
 *
 * Das ist der Kern des Versprechens, mit dem diese App angetreten ist: Sie
 * soll sich merken, was **dieser** Nutzer kauft. Bis M9 war die Reihenfolge
 * alphabetisch - richtig, aber dumm. Ab hier zaehlt, was tatsaechlich im
 * Wagen gelandet ist.
 *
 * Reine Funktion ohne Datenbankzugriff (ADR-008). Die Historie kommt als
 * fertige Zahlen herein; gezaehlt wird in der Datenbank, weil sie das besser
 * kann.
 */

/**
 * Die Gewichte. Bewusst benannt und beieinander, damit sie sich nachjustieren
 * lassen, ohne den Algorithmus zu lesen (architecture.md 4.2).
 *
 * Haeufigkeit wiegt am schwersten: Was jemand oft kauft, will er meistens
 * wieder. Aktualitaet ist der Gegenpol - sie holt das nach vorn, was gerade
 * zur Jahreszeit oder zur Lebenslage passt. Die Trefferqualitaet gibt nur den
 * Ausschlag bei sonst gleichem Stand.
 */
export const SUGGESTION_WEIGHTS = {
  frequency: 0.6,
  recency: 0.3,
  matchQuality: 0.1,
} as const;

/** Wie weit zurueck gezaehlt wird. Aelteres sagt ueber heute wenig. */
export const HISTORY_WINDOW_DAYS = 180;

/** Nach dieser Zeit ist die Aktualitaet eines Kaufs halbiert. */
export const RECENCY_HALF_LIFE_DAYS = 30;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type ProductStats = {
  productId: string;
  /** Kaeufe innerhalb des Zeitfensters. */
  purchaseCount: number;
  lastPurchasedAt: number | null;
};

export type RankedSuggestion = {
  product: CatalogProduct;
  score: number;
};

export type RankedResult = {
  suggestions: RankedSuggestion[];
  /** true, wenn die Eingabe kein Produkt exakt trifft (PRD Flow 1.6). */
  canCreate: boolean;
};

/**
 * Beginn des Zeitfensters, auf den Tagesanfang abgerundet.
 *
 * Abgerundet, damit sich der Wert nur einmal am Tag aendert. Sonst waere die
 * Datenbankabfrage bei jeder Sekunde eine andere, und die Live-Abfrage muesste
 * staendig neu laufen - fuer ein Ergebnis, das sich nicht unterscheidet.
 */
export function historyWindowStart(now: number, days: number = HISTORY_WINDOW_DAYS): number {
  const start = now - days * DAY_IN_MS;
  return Math.floor(start / DAY_IN_MS) * DAY_IN_MS;
}

/**
 * Aktualitaet eines Kaufs: 1,0 heute, 0,5 nach 30 Tagen, 0,25 nach 60.
 *
 * Ein weicher Zerfall statt einer Grenze ("in den letzten 30 Tagen gekauft"):
 * Eine Grenze wuerde einen Artikel am 31. Tag schlagartig fallen lassen,
 * obwohl sich nichts geaendert hat.
 */
export function recencyScore(
  lastPurchasedAt: number | null,
  now: number,
  halfLifeDays: number = RECENCY_HALF_LIFE_DAYS,
): number {
  if (lastPurchasedAt === null) {
    return 0;
  }

  const days = Math.max(0, (now - lastPurchasedAt) / DAY_IN_MS);
  return 0.5 ** (days / halfLifeDays);
}

/**
 * Sortiert die Vorschlaege nach Haeufigkeit, Aktualitaet und Trefferqualitaet
 * (architecture.md 4.2, FR-5.2).
 *
 * Die Haeufigkeit wird auf den Hoechstwert im Katalog normiert. Absolute
 * Zahlen waeren wertlos: Wer woechentlich einkauft, hat nach einem halben Jahr
 * ganz andere Zahlen als jemand, der die App zweimal benutzt hat - die
 * **Rangfolge** ist in beiden Faellen dieselbe Frage.
 *
 * Bei leerer Eingabe erscheinen nur Produkte **mit** Kaufhistorie (T-10.4).
 * Ohne diese Regel bekaeme ein neuer Nutzer beim Antippen des Feldes acht
 * zufaellige Produkte in alphabetischer Reihenfolge vorgesetzt - Laerm, der
 * die Liste verdeckt. Wer noch nichts gekauft hat, hat keine "ueblichen
 * Verdaechtigen", und dann ist nichts die ehrlichste Antwort.
 */
export function rankSuggestions(
  query: string,
  products: CatalogProduct[],
  stats: ProductStats[],
  productIdsOnList: string[] = [],
  now: number = Date.now(),
  limit: number = SUGGESTION_LIMIT,
): RankedResult {
  const needle = normalizeForSearch(query);
  const excluded = new Set(productIdsOnList);
  const byProduct = new Map(stats.map((entry) => [entry.productId, entry]));

  const maxCount = stats.reduce((max, entry) => Math.max(max, entry.purchaseCount), 0);

  const matches: RankedSuggestion[] = [];
  let exactMatch = false;

  for (const product of products) {
    // Zwei Schreibweisen desselben Namens: "musli" und "muesli" fuer "Müsli".
    if (
      needle.length > 0 &&
      (normalizeForSearch(product.name) === needle || expandForSearch(product.name) === needle)
    ) {
      exactMatch = true;
    }

    if (excluded.has(product.id)) {
      continue;
    }

    const position = matchPosition(product.name, needle);
    if (position < 0) {
      continue;
    }

    const entry = byProduct.get(product.id);

    if (needle.length === 0 && (entry === undefined || entry.purchaseCount === 0)) {
      continue;
    }

    const frequency = maxCount === 0 ? 0 : (entry?.purchaseCount ?? 0) / maxCount;
    const recency = recencyScore(entry?.lastPurchasedAt ?? null, now);
    const quality = position === 0 ? 1 : 0.5;

    matches.push({
      product,
      score:
        SUGGESTION_WEIGHTS.frequency * frequency +
        SUGGESTION_WEIGHTS.recency * recency +
        SUGGESTION_WEIGHTS.matchQuality * quality,
    });
  }

  matches.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    // Stabile Reihenfolge bei Gleichstand, damit die Liste nicht springt und
    // der Test ein festes Ergebnis pruefen kann (architecture.md 4.2, Punkt 4).
    return a.product.name.localeCompare(b.product.name, 'de');
  });

  return {
    suggestions: matches.slice(0, limit),
    canCreate: cleanProductName(query).length > 0 && !exactMatch,
  };
}

export type StatsRow = {
  productId: string | null;
  purchaseCount: number;
  lastPurchasedAt: number | null;
};

/**
 * Macht aus den Zeilen der Datenbank die Form, mit der das Ranking rechnet.
 *
 * Eintraege ohne Produkt fallen weg: Sie entstehen, wenn ein Produkt aus dem
 * Katalog geloescht wurde (ADR-007 loest die Verknuepfung, statt die Historie
 * mitzureissen). Fuer einen Vorschlag taugen sie nicht - es gibt nichts mehr
 * vorzuschlagen -, fuer die Statistik der Vergangenheit schon.
 */
export function toProductStats(rows: StatsRow[]): ProductStats[] {
  return rows
    .filter((row): row is StatsRow & { productId: string } => row.productId !== null)
    .map((row) => ({
      productId: row.productId,
      purchaseCount: row.purchaseCount,
      lastPurchasedAt: row.lastPurchasedAt,
    }));
}
