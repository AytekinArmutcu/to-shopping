import { gte, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { purchaseHistory } from '@/db/schema';

import { SESSION_START } from './clock';
import { historyWindowStart } from './logic';

/**
 * Zugriff auf die Kaufhistorie fuer das Vorschlagsranking (FR-5.1, T-10.2).
 *
 * Gezaehlt wird in der Datenbank, nicht in der App. Der Index
 * purchase_history_product_time liegt auf (product_id, purchased_at) und
 * traegt genau diese Abfrage: gruppieren nach Produkt, filtern nach Zeitraum.
 * Alle Kaeufe zu laden und in JavaScript zu zaehlen waere bei einem Jahr
 * woechentlicher Einkaeufe schon spuerbar - und es waere die falsche
 * Gewohnheit.
 */
export function productStatsQuery(since: number) {
  return db
    .select({
      productId: purchaseHistory.productId,
      purchaseCount: sql<number>`count(*)`,
      lastPurchasedAt: sql<number>`max(${purchaseHistory.purchasedAt})`,
    })
    .from(purchaseHistory)
    .where(gte(purchaseHistory.purchasedAt, since))
    .groupBy(purchaseHistory.productId);
}

/**
 * Das Zeitfenster dieser Sitzung.
 *
 * Einmal bestimmt, damit die Live-Abfrage stabil bleibt: Eine Abfrage, deren
 * Bedingung sich bei jedem Rendern aendert, wuerde staendig neu laufen - fuer
 * ein Ergebnis, das sich nicht unterscheidet.
 */
export function currentStatsQuery() {
  return productStatsQuery(historyWindowStart(SESSION_START));
}
