import { Redirect, useLocalSearchParams } from 'expo-router';

import { RecipeScreen } from '@/features/recipes/components/RecipeScreen';

/**
 * Route "/rezept": ein Gericht ansehen, bearbeiten oder anlegen
 * (recipeId "neu").
 *
 * Ohne ID gibt es nichts anzuzeigen - dann geht es zur Rezeptuebersicht statt
 * auf einen leeren Bildschirm, wie bei "/liste".
 */
export default function Rezept() {
  const { recipeId } = useLocalSearchParams<{ recipeId?: string }>();

  if (!recipeId) {
    return <Redirect href="/rezepte" />;
  }

  return <RecipeScreen recipeId={recipeId} />;
}
