import { sql } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import HomePlaceholder from '@/components/HomePlaceholder';
import { db } from '@/db/client';
import { categories, products } from '@/db/schema';

/**
 * Route "/". Bewusst duenn: Routen unter app/ holen die Daten und setzen
 * zusammen, sie halten weder Aussehen noch Fachlogik (CLAUDE.md).
 *
 * useLiveQuery aktualisiert sich nach jedem Schreibvorgang von selbst -
 * deshalb muss kein Zustand gespiegelt werden (ADR-020).
 */
export default function Index() {
  const productCount = useLiveQuery(db.select({ value: sql<number>`count(*)` }).from(products));
  const categoryCount = useLiveQuery(db.select({ value: sql<number>`count(*)` }).from(categories));

  return (
    <HomePlaceholder
      productCount={productCount.data?.[0]?.value ?? 0}
      categoryCount={categoryCount.data?.[0]?.value ?? 0}
    />
  );
}
