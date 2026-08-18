import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';

type Props = {
  error: Error | null;
};

/**
 * Zwischenbildschirm, solange Migrationen und Startkatalog laufen - und
 * Auffangbildschirm, wenn dabei etwas schiefgeht.
 *
 * Ohne diesen Bildschirm wuerde die App bei einem Fehler in der Datenbank
 * einfach weiss bleiben. Der Nutzer soll stattdessen einen verstaendlichen
 * Satz sehen und der Entwickler die technische Ursache (FR-8.1).
 */
export function StartupScreen({ error }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (error) {
    return (
      <ScrollView
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.container}
        testID="startup-error"
      >
        <Text variant="headlineSmall" style={styles.centered}>
          {t('start.error.title')}
        </Text>
        <Text variant="bodyMedium" style={styles.hint}>
          {t('start.error.hint')}
        </Text>
        <Text variant="labelLarge" style={styles.hint}>
          {t('start.error.details')}
        </Text>
        <Text variant="bodySmall" style={styles.details}>
          {error.message}
        </Text>
      </ScrollView>
    );
  }

  return (
    <View
      style={[styles.container, styles.centeredBox, { backgroundColor: theme.colors.background }]}
      testID="startup-loading"
    >
      <ActivityIndicator accessibilityLabel={t('start.loading')} size="large" />
      <Text variant="bodyMedium" style={styles.hint}>
        {t('start.loading')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    gap: 12,
  },
  centeredBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  centered: {
    textAlign: 'center',
  },
  hint: {
    textAlign: 'center',
  },
  details: {
    opacity: 0.7,
  },
});
