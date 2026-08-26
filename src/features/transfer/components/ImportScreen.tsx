import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Button,
  Divider,
  List,
  Text,
  useTheme,
} from 'react-native-paper';

import { formatQuantity } from '@/features/items/logic';
import { listRoute } from '@/features/lists/logic';
import { setLastRoute } from '@/features/lists/repository';
import { FALLBACK_CATEGORY_ID } from '@/features/catalog/repository';

import { parseSharedList, type ParseFailure, type SharedListFile } from '../logic';
import { importSharedList } from '../repository';
import { pickSharedFile, readSharedFile } from '../share';

type Props = {
  /** content://-Adresse aus dem Teilen-Menue, falls die App darueber kam. */
  uri?: string;
};

type State =
  | { kind: 'laedt' }
  | { kind: 'wartetAufDatei' }
  | { kind: 'bereit'; file: SharedListFile; skipped: number }
  | { kind: 'fehler'; reason: ParseFailure | 'keinZugriff' };

/**
 * Empfangen einer geteilten Liste (FR-6.2, PRD Flow 4).
 *
 * Zwei Wege herein: Der Nutzer tippt die Datei in einer Nachricht an - dann
 * kommt die Adresse als Parameter -, oder er waehlt sie hier selbst aus. Der
 * zweite Weg ist der verlaesslichere: Ob eine fremde App unsere Datei
 * ueberhaupt an uns weiterreicht, haengt an ihrem Umgang mit Dateitypen, und
 * darauf haben wir keinen Einfluss.
 *
 * Erst Vorschau, dann schreiben (architecture.md 4.5). Ein Import, der ohne
 * Rueckfrage eine Liste anlegt, waere fuer den Empfaenger eine Ueberraschung -
 * und er weiss vorher nicht, was in der Datei steht.
 */
export function ImportScreen({ uri }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  const [state, setState] = useState<State>(uri ? { kind: 'laedt' } : { kind: 'wartetAufDatei' });
  const [busy, setBusy] = useState(false);

  const read = useCallback((raw: string | null) => {
    if (raw === null) {
      setState({ kind: 'fehler', reason: 'keinZugriff' });
      return;
    }

    const result = parseSharedList(raw);
    setState(
      result.ok
        ? { kind: 'bereit', file: result.file, skipped: result.skipped }
        : { kind: 'fehler', reason: result.reason },
    );
  }, []);

  useEffect(() => {
    if (uri === undefined) {
      return;
    }

    let cancelled = false;
    void readSharedFile(uri).then((raw) => {
      if (!cancelled) {
        read(raw);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [uri, read]);

  const pick = useCallback(() => {
    setState({ kind: 'laedt' });
    void pickSharedFile().then((raw) => {
      if (raw === null) {
        // Abgebrochen oder nicht lesbar - zurueck zum Ausgangszustand, statt
        // eine Fehlermeldung fuer einen bewussten Abbruch zu zeigen.
        setState({ kind: 'wartetAufDatei' });
      } else {
        read(raw);
      }
    });
  }, [read]);

  const confirm = useCallback(() => {
    if (state.kind !== 'bereit' || busy) {
      return;
    }

    setBusy(true);
    const listName = t('import.listName', {
      name: state.file.list.name,
      date: new Date().toLocaleDateString('de-DE'),
    });

    void importSharedList(state.file, listName, FALLBACK_CATEGORY_ID).then((result) => {
      void setLastRoute(listRoute(result.listId));
      router.replace({ pathname: '/liste', params: { listId: result.listId } });
    });
  }, [state, busy, t]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        <Appbar.BackAction
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/listen');
            }
          }}
          accessibilityLabel={t('import.back')}
        />
        <Appbar.Content title={t('import.title')} />
      </Appbar.Header>

      {state.kind === 'laedt' ? (
        <View style={styles.centered} testID="import-loading">
          <ActivityIndicator />
          <Text variant="bodyMedium">{t('import.loading')}</Text>
        </View>
      ) : null}

      {state.kind === 'wartetAufDatei' ? (
        <View style={styles.centered} testID="import-picker">
          <Text variant="bodyMedium" style={styles.centeredText}>
            {t('import.pickHint')}
          </Text>
          <Button mode="contained" icon="file-outline" onPress={pick} testID="import-pick">
            {t('import.pick')}
          </Button>
        </View>
      ) : null}

      {state.kind === 'fehler' ? (
        <View style={styles.centered} testID="import-error">
          <Text variant="titleMedium" style={styles.centeredText}>
            {t('import.errorTitle')}
          </Text>
          <Text variant="bodyMedium" style={[styles.centeredText, styles.hint]}>
            {t(errorTextKey(state.reason))}
          </Text>
          <Button mode="contained" icon="file-outline" onPress={pick} testID="import-pick">
            {t('import.pick')}
          </Button>
        </View>
      ) : null}

      {state.kind === 'bereit' ? (
        <>
          <View style={styles.summary}>
            <Text variant="titleLarge">{state.file.list.name}</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('import.itemCount', { count: state.file.list.items.length })}
            </Text>
            {/* Uebersprungene Eintraege werden genannt, nicht verschwiegen:
                Der Empfaenger soll wissen, dass die Liste unvollstaendig ist. */}
            {state.skipped > 0 ? (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.error }}
                testID="import-skipped"
              >
                {t('import.skipped', { count: state.skipped })}
              </Text>
            ) : null}
          </View>
          <Divider />

          <ScrollView testID="import-preview">
            {state.file.list.items.map((item, index) => (
              <List.Item
                key={`${item.name}-${index}`}
                title={item.name}
                description={item.note ?? undefined}
                right={() => (
                  <Text variant="labelLarge" style={styles.quantity}>
                    {formatQuantity(item, t(`units.${item.unit}.short`)) ?? ''}
                  </Text>
                )}
                style={styles.row}
              />
            ))}
          </ScrollView>

          <Divider />
          <View style={styles.footer}>
            <Button
              mode="contained"
              icon="download"
              onPress={confirm}
              disabled={busy}
              testID="import-confirm"
            >
              {t('import.confirm')}
            </Button>
          </View>
        </>
      ) : null}
    </View>
  );
}

function errorTextKey(reason: ParseFailure | 'keinZugriff'): string {
  switch (reason) {
    case 'fremdesFormat':
      return 'import.errorForeignFormat';
    case 'zuNeu':
      return 'import.errorTooNew';
    case 'keinZugriff':
      return 'import.errorNoAccess';
    default:
      return 'import.errorUnreadable';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  centeredText: {
    textAlign: 'center',
  },
  hint: {
    opacity: 0.8,
  },
  summary: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  row: {
    minHeight: 56,
    justifyContent: 'center',
  },
  quantity: {
    alignSelf: 'center',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
