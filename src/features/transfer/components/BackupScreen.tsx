import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Button,
  Dialog,
  Divider,
  Portal,
  Snackbar,
  Text,
  useTheme,
} from 'react-native-paper';

import {
  BACKUP_EXTENSION,
  countRows,
  parseBackup,
  type BackupFailure,
  type BackupFile,
} from '../backup';
import {
  collectBackup,
  currentSchemaVersion,
  LAST_BACKUP_KEY,
  getTimestamp,
  restoreBackup,
  setTimestamp,
} from '../repository';
import { pickBackupFile, shareBackup } from '../share';

/**
 * Sicherung und Wiederherstellung (FR-6.4, FR-6.5).
 *
 * Das ist die Gegenmassnahme zu Risiko R3 im PRD: Ohne Cloud-Sicherung
 * (ADR-004) bedeutet ein verlorenes Telefon sonst den Verlust aller Daten.
 * Die Sicherung ist deshalb bewusst einfach zu erreichen - und die
 * Wiederherstellung bewusst schwer zu versehentlich auszuloesen.
 */
export function BackupScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [error, setError] = useState<BackupFailure | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getTimestamp(LAST_BACKUP_KEY).then((at) => {
      if (!cancelled) {
        setLastBackupAt(at);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const exportBackup = useCallback(() => {
    setBusy(true);
    void collectBackup()
      .then(async (file) => {
        const name = `${t('backup.fileName')}.${BACKUP_EXTENSION}`;
        const outcome = await shareBackup(file, name, t('backup.dialogTitle'));

        if (outcome === 'nichtVerfuegbar') {
          setMessage(t('backup.unavailable'));
          return;
        }

        // Der Zeitpunkt wird gesetzt, sobald die Datei im Teilen-Menue liegt.
        // Ob der Nutzer sie dort tatsaechlich irgendwohin schickt, kann die
        // App nicht wissen - Android verraet es nicht.
        const now = Date.now();
        await setTimestamp(LAST_BACKUP_KEY, now);
        setLastBackupAt(now);
        setMessage(t('backup.exportDone', { count: countRows(file.data) }));
      })
      .finally(() => setBusy(false));
  }, [t]);

  const choose = useCallback(() => {
    setBusy(true);
    void pickBackupFile()
      .then((raw) => {
        if (raw === null) {
          return;
        }

        const result = parseBackup(raw, currentSchemaVersion());
        if (result.ok) {
          setPending(result.file);
        } else {
          setError(result.reason);
        }
      })
      .finally(() => setBusy(false));
  }, []);

  const confirmRestore = useCallback(() => {
    const file = pending;
    setPending(null);

    if (file === null) {
      return;
    }

    setBusy(true);
    void restoreBackup(file)
      .then((written) => {
        setMessage(t('backup.restoreDone', { count: written }));
        // Zurueck zur Uebersicht: Die Liste, auf der der Nutzer vorher war,
        // gibt es nach dem Ersetzen womoeglich nicht mehr.
        router.replace('/listen');
      })
      .finally(() => setBusy(false));
  }, [pending, t]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => router.back()} accessibilityLabel={t('backup.back')} />
        <Appbar.Content title={t('backup.title')} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content} testID="backup-screen">
        <Text variant="titleMedium">{t('backup.exportTitle')}</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {t('backup.exportHint')}
        </Text>
        <Text variant="labelLarge" testID="backup-last">
          {lastBackupAt === null
            ? t('backup.never')
            : t('backup.lastAt', { date: new Date(lastBackupAt).toLocaleDateString('de-DE') })}
        </Text>
        <Button
          mode="contained"
          icon="content-save-outline"
          onPress={exportBackup}
          disabled={busy}
          testID="backup-export"
        >
          {t('backup.export')}
        </Button>

        <Divider style={styles.divider} />

        <Text variant="titleMedium">{t('backup.restoreTitle')}</Text>
        {/* Die Warnung steht vor dem Knopf, nicht daneben: Wer hier landet,
            soll sie gelesen haben, bevor er tippt. */}
        <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
          {t('backup.restoreHint')}
        </Text>
        <Button
          mode="outlined"
          icon="file-restore-outline"
          onPress={choose}
          disabled={busy}
          testID="backup-restore"
        >
          {t('backup.restore')}
        </Button>
      </ScrollView>

      <Portal>
        <Dialog visible={pending !== null} onDismiss={() => setPending(null)}>
          <Dialog.Title>{t('backup.restoreConfirmTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {t('backup.restoreConfirmHint', {
                count: pending === null ? 0 : countRows(pending.data),
                date:
                  pending === null || pending.exportedAt === ''
                    ? '?'
                    : new Date(pending.exportedAt).toLocaleDateString('de-DE'),
              })}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPending(null)}>{t('common.cancel')}</Button>
            <Button onPress={confirmRestore} testID="backup-restore-confirm">
              {t('backup.restoreConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={error !== null} onDismiss={() => setError(null)}>
          <Dialog.Title>{t('backup.errorTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{error === null ? '' : t(errorTextKey(error))}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setError(null)}>{t('detail.done')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={message !== null}
        onDismiss={() => setMessage(null)}
        duration={4000}
        testID="backup-message"
      >
        {message ?? ''}
      </Snackbar>
    </View>
  );
}

function errorTextKey(reason: BackupFailure): string {
  switch (reason) {
    case 'fremdesFormat':
      return 'backup.errorForeignFormat';
    case 'zuNeu':
      return 'backup.errorTooNew';
    case 'neueresSchema':
      return 'backup.errorNewerSchema';
    default:
      return 'backup.errorUnreadable';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  divider: {
    marginVertical: 12,
  },
});
