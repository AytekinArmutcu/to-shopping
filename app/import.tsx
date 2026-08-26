import { useLocalSearchParams } from 'expo-router';

import { ImportScreen } from '@/features/transfer/components/ImportScreen';

/**
 * Route "/import": Ziel des Teilen-Intents und der Dateiauswahl (FR-6.2).
 *
 * Ohne Adresse zeigt der Screen die Dateiauswahl - das ist kein Fehlerfall,
 * sondern der zweite, verlaesslichere Weg herein.
 */
export default function Import() {
  const { uri } = useLocalSearchParams<{ uri?: string }>();

  return <ImportScreen uri={uri} />;
}
