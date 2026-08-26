import { useLocalSearchParams } from 'expo-router';

import { StoreLayoutScreen } from '@/features/lists/components/StoreLayoutScreen';

/**
 * Route "/ladenlayout". Wie jede Route nur ein Zusammenbau (CLAUDE.md).
 *
 * Die Reihenfolge gehoert zur Liste und nicht zur App (ADR-017), deshalb
 * kommt die Listen-ID als Parameter herein.
 */
export default function Ladenlayout() {
  const { listId } = useLocalSearchParams<{ listId?: string }>();

  if (!listId) {
    return null;
  }

  return <StoreLayoutScreen listId={listId} />;
}
