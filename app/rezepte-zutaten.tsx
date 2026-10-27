import { useLocalSearchParams } from 'expo-router';

import { IngredientPickerScreen } from '@/features/recipes/components/IngredientPickerScreen';
import { parseWithParam } from '@/features/recipes/logic';

/**
 * Route "/rezepte-zutaten": Zutaten aus dem Vorrat waehlen, zu denen Gerichte
 * gesucht werden (FR-10.12, ADR-048). "with" traegt die bisherige Auswahl
 * herein; das Ergebnis geht als "with" zurueck an "/rezepte".
 */
export default function RezepteZutaten() {
  const params = useLocalSearchParams<{ with?: string | string[] }>();

  return <IngredientPickerScreen preselected={parseWithParam(params.with)} />;
}
