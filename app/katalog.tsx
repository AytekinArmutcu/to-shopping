import { useLocalSearchParams } from 'expo-router';

import { CatalogScreen } from '@/features/catalog/components/CatalogScreen';

/**
 * Route "/katalog". Duenn wie jede Route: Sie liest den Parameter und setzt
 * den Screen zusammen (CLAUDE.md).
 *
 * Die Listen-ID kommt als Parameter statt aus einem erneuten Datenbankzugriff.
 * So gehoert der Katalogbesuch eindeutig zu der Liste, von der aus er
 * geoeffnet wurde - auch wenn ab M6 mehrere Listen nebeneinander existieren.
 */
export default function Katalog() {
  const { listId } = useLocalSearchParams<{ listId?: string }>();

  if (!listId) {
    return null;
  }

  return <CatalogScreen listId={listId} />;
}
