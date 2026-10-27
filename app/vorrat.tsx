import { useLocalSearchParams } from 'expo-router';

import { PantryScreen } from '@/features/pantry/components/PantryScreen';

/**
 * Route "/vorrat". Duenn wie jede Route: Sie liest den Parameter und setzt
 * den Screen zusammen (CLAUDE.md).
 *
 * Die Listen-ID ist hier optional - anders als beim Katalog. Aus der
 * Uebersicht geoeffnet gibt es keine Liste; dann geht "Auf die Liste setzen"
 * an die zuletzt geoeffnete und Zurueck an die Uebersicht.
 */
export default function Vorrat() {
  const { listId } = useLocalSearchParams<{ listId?: string }>();

  return <PantryScreen listId={listId || undefined} />;
}
