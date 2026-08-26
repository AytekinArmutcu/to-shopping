import { Redirect, useLocalSearchParams } from 'expo-router';

import { ListScreen } from '@/features/lists/components/ListScreen';

/**
 * Route "/liste": eine einzelne Liste.
 *
 * Ohne Listen-ID gibt es nichts anzuzeigen - dann geht es zur Uebersicht statt
 * auf einen leeren Bildschirm. Vorkommen kann das etwa, wenn eine gespeicherte
 * Route aus einer aelteren Fassung der App stammt.
 */
export default function Liste() {
  const { listId } = useLocalSearchParams<{ listId?: string }>();

  if (!listId) {
    return <Redirect href="/listen" />;
  }

  return <ListScreen listId={listId} />;
}
