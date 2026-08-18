import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MILESTONE } from '@/lib/appInfo';

type Props = {
  productCount: number;
  categoryCount: number;
};

/**
 * Platzhalter-Inhalt fuer M1. Zeigt, dass Datenbank, Theme und Texte
 * zusammenspielen: Die Zahlen kommen aus SQLite, die Farben aus dem
 * Material-3-Theme, die Woerter aus de.json.
 *
 * Bewusst ohne eigenen Datenbankzugriff - die Zahlen kommen als Eigenschaften
 * herein. Dadurch bleibt die Komponente ohne Datenbank testbar (ADR-008).
 * Wird in M2 durch den echten Listen-Screen ersetzt.
 */
export default function HomePlaceholder({ productCount, categoryCount }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]} testID="home-screen">
      <Text variant="headlineMedium" testID="home-title">
        {t('app.name')}
      </Text>
      <Text variant="bodyLarge" style={styles.subtitle}>
        {t('milestone.current', { id: MILESTONE })}
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle} testID="home-db-summary">
        {t('milestone.database', { products: productCount, categories: categoryCount })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  subtitle: {
    opacity: 0.7,
  },
});
