import { useLocalSearchParams } from 'expo-router';

import { RecipesScreen } from '@/features/recipes/components/RecipesScreen';

/**
 * Route "/rezepte": Wochenplan und alle Gerichte (FR-10.3, FR-10.6).
 *
 * Der Parameter "with" traegt den Zutatenfilter (ADR-048, FR-10.12) - als
 * Routenparameter, damit Zurueck und Neustart ihn verstehen. Durchgereicht
 * wird er roh; was davon gilt, entscheidet parseWithParam im Screen.
 */
export default function Rezepte() {
  const params = useLocalSearchParams<{ with?: string | string[] }>();

  return <RecipesScreen withParam={params.with} />;
}
