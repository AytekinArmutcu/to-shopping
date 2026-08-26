import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Card, Divider, Snackbar, Text, useTheme } from 'react-native-paper';

import { shareReport } from '@/features/transfer/share';

import { buildReport } from '../logic';
import { clearErrorLog, readErrorLog } from '../store';

/**
 * Diagnose (FR-8.2, architecture.md 9).
 *
 * Zeigt, was der Fehlerspeicher enthaelt, und bietet an, es zu verschicken -
 * **auf Knopfdruck des Nutzers**. Kein Drittanbieter, keine automatische
 * Uebertragung. Wer nie hierher kommt, hat nie etwas gesendet.
 *
 * Der Fehlerspeicher wird beim Aufbauen des Screens einmal gelesen und nicht
 * beobachtet: Neue Eintraege entstehen nur bei einem Absturz, und dann ist
 * dieser Screen nicht offen.
 */
export function DiagnosticsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  const [entries, setEntries] = useState(() => readErrorLog());
  const [message, setMessage] = useState<string | null>(null);

  const send = useCallback(() => {
    const report = buildReport(entries, {
      header: t('diagnostics.reportHeader'),
      empty: t('diagnostics.reportEmpty'),
      privacy: t('diagnostics.reportPrivacy'),
    });

    void shareReport(report, t('diagnostics.sendTitle'));
  }, [entries, t]);

  const clear = useCallback(() => {
    clearErrorLog();
    setEntries([]);
    setMessage(t('diagnostics.cleared'));
  }, [t]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        <Appbar.BackAction
          onPress={() => router.back()}
          accessibilityLabel={t('diagnostics.back')}
        />
        <Appbar.Content title={t('diagnostics.title')} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content} testID="diagnostics-screen">
        {/* Der Datenschutzhinweis steht oben und nicht im Kleingedruckten:
            Er ist der Grund, warum man diesen Knopf ohne Sorge druecken kann. */}
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {t('diagnostics.privacy')}
        </Text>

        {entries.length === 0 ? (
          <View style={styles.empty} testID="diagnostics-empty">
            <Text variant="titleMedium">{t('diagnostics.empty')}</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('diagnostics.emptyHint')}
            </Text>
          </View>
        ) : (
          <>
            <Text variant="labelLarge">{t('diagnostics.count', { count: entries.length })}</Text>
            {entries.map((entry, index) => (
              <Card key={`${entry.at}-${index}`} mode="outlined" style={styles.card}>
                <Card.Content>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {new Date(entry.at).toLocaleString('de-DE')} · {entry.appVersion}
                  </Text>
                  <Text variant="bodyMedium" style={styles.message}>
                    {entry.message}
                  </Text>
                </Card.Content>
              </Card>
            ))}
          </>
        )}

        <Divider style={styles.divider} />

        <Button mode="contained" icon="share-variant" onPress={send} testID="diagnostics-send">
          {t('diagnostics.send')}
        </Button>
        <Button
          mode="outlined"
          icon="delete-outline"
          onPress={clear}
          disabled={entries.length === 0}
          testID="diagnostics-clear"
        >
          {t('diagnostics.clear')}
        </Button>
      </ScrollView>

      <Snackbar
        visible={message !== null}
        onDismiss={() => setMessage(null)}
        duration={3000}
        testID="diagnostics-message"
      >
        {message ?? ''}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  empty: {
    paddingVertical: 32,
    gap: 8,
  },
  card: {
    marginBottom: 4,
  },
  message: {
    paddingTop: 4,
  },
  divider: {
    marginVertical: 12,
  },
});
