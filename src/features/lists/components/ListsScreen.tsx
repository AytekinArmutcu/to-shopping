import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Button,
  Dialog,
  FAB,
  IconButton,
  List,
  Menu,
  Portal,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { useKeyboardHeight } from '@/lib/useKeyboardHeight';

import { buildListOverview, cleanListName, listRoute, MAX_LIST_NAME_LENGTH } from '../logic';
import {
  createList,
  deleteList,
  duplicateList,
  listsQuery,
  openCountsQuery,
  renameList,
  setLastRoute,
} from '../repository';

/**
 * Die Listenuebersicht (FR-1.4).
 *
 * Sie ist ab M6 der zweite Ort, an dem die App starten kann - und der einzige,
 * von dem aus sich Listen anlegen, umbenennen, duplizieren und loeschen
 * lassen (FR-1.2).
 *
 * Jede Zeile fuehrt zu ihrer Liste; alles Weitere steckt hinter dem
 * Drei-Punkte-Knopf. Vier Aktionen offen nebeneinander waeren auf einem
 * Telefon eine Reihe von Zielen, die man im Vorbeigehen falsch trifft.
 */
export function ListsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const keyboardHeight = useKeyboardHeight();

  const listRows = useLiveQuery(listsQuery());
  const countRows = useLiveQuery(openCountsQuery());

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [renameFor, setRenameFor] = useState<{ id: string; name: string } | null>(null);
  const [deleteFor, setDeleteFor] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const rows = useMemo(
    () => buildListOverview(listRows.data ?? [], countRows.data ?? []),
    [listRows.data, countRows.data],
  );

  // Die Route wird zweimal ausgedrueckt: als getippte Angabe fuer den Router
  // und als Zeichenkette fuer das Gedaechtnis. Nur so bleibt die Pruefung der
  // Routen durch TypeScript erhalten, ohne die reine Logik an den Router zu
  // binden.
  const open = useCallback((id: string) => {
    void setLastRoute(listRoute(id));
    router.push({ pathname: '/liste', params: { listId: id } });
  }, []);

  const create = useCallback(() => {
    const name = cleanListName(nameDraft);
    setCreateOpen(false);

    if (name === null) {
      return;
    }

    void createList(name).then((id) => {
      open(id);
    });
  }, [nameDraft, open]);

  const rename = useCallback(() => {
    const name = cleanListName(nameDraft);
    const target = renameFor;
    setRenameFor(null);

    if (name === null || target === null) {
      return;
    }

    void renameList(target.id, name);
  }, [nameDraft, renameFor]);

  const duplicate = useCallback(
    (id: string, name: string) => {
      setMenuFor(null);
      void duplicateList(id, t('lists.copySuffix')).then(() => {
        setMessage(t('lists.duplicated', { name }));
      });
    },
    [t],
  );

  const remove = useCallback(() => {
    const target = deleteFor;
    setDeleteFor(null);

    if (target === null) {
      return;
    }

    // Artikel und Ladenlayout haengen per Fremdschluessel-Kaskade daran und
    // verschwinden mit (db/client.ts schaltet PRAGMA foreign_keys ein).
    void deleteList(target.id).then(() => {
      setMessage(t('lists.deleted', { name: target.name }));
    });
  }, [deleteFor, t]);

  // Der Dialog haengt im Portal desselben Fensters und weiss nichts von der
  // Tastatur. Der Abstand hebt ihn darueber (ADR-026, useKeyboardHeight).
  const dialogStyle = { marginBottom: keyboardHeight };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        <Appbar.Content title={t('lists.title')} />
      </Appbar.Header>

      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        testID="lists"
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={
              item.openCount === 0 ? t('lists.allDone') : t('lists.open', { count: item.openCount })
            }
            onPress={() => open(item.id)}
            accessibilityLabel={t('lists.openList', { name: item.name })}
            testID={`list-${item.name}`}
            style={styles.row}
            right={() => (
              <Menu
                visible={menuFor === item.id}
                onDismiss={() => setMenuFor(null)}
                anchor={
                  <IconButton
                    icon="dots-vertical"
                    onPress={() => setMenuFor(item.id)}
                    accessibilityLabel={t('lists.more', { name: item.name })}
                    testID={`more-${item.name}`}
                    style={styles.more}
                  />
                }
              >
                <Menu.Item
                  leadingIcon="pencil"
                  title={t('lists.rename')}
                  testID="menu-rename"
                  onPress={() => {
                    setMenuFor(null);
                    setNameDraft(item.name);
                    setRenameFor({ id: item.id, name: item.name });
                  }}
                />
                <Menu.Item
                  leadingIcon="content-copy"
                  title={t('lists.duplicate')}
                  testID="menu-duplicate"
                  onPress={() => duplicate(item.id, item.name)}
                />
                <Menu.Item
                  leadingIcon="delete-outline"
                  title={t('lists.delete')}
                  testID="menu-delete"
                  onPress={() => {
                    setMenuFor(null);
                    setDeleteFor({ id: item.id, name: item.name });
                  }}
                />
              </Menu>
            )}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty} testID="lists-empty">
            <Text variant="titleMedium" style={styles.emptyText}>
              {t('lists.emptyTitle')}
            </Text>
            <Text variant="bodyMedium" style={[styles.emptyText, styles.emptyHint]}>
              {t('lists.emptyHint')}
            </Text>
          </View>
        }
      />

      {/* Beschriftet statt nur als Symbol: Ein Pluszeichen allein ist fuer die
          Zielgruppe eine Vermutung, kein Angebot. */}
      <FAB
        icon="plus"
        label={t('lists.create')}
        onPress={() => {
          setNameDraft('');
          setCreateOpen(true);
        }}
        testID="list-create"
        style={styles.fab}
      />

      <Portal>
        <Dialog visible={createOpen} onDismiss={() => setCreateOpen(false)} style={dialogStyle}>
          <Dialog.Title>{t('lists.createTitle')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              value={nameDraft}
              onChangeText={setNameDraft}
              label={t('lists.nameLabel')}
              placeholder={t('lists.namePlaceholder')}
              maxLength={MAX_LIST_NAME_LENGTH}
              testID="list-name"
              onSubmitEditing={create}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button onPress={create} testID="list-create-confirm">
              {t('lists.createConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={renameFor !== null}
          onDismiss={() => setRenameFor(null)}
          style={dialogStyle}
        >
          <Dialog.Title>{t('lists.renameTitle')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              value={nameDraft}
              onChangeText={setNameDraft}
              label={t('lists.nameLabel')}
              maxLength={MAX_LIST_NAME_LENGTH}
              testID="list-rename-input"
              onSubmitEditing={rename}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenameFor(null)}>{t('common.cancel')}</Button>
            <Button onPress={rename} testID="list-rename-confirm">
              {t('lists.renameConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Loeschen fragt nach: Es trifft nicht nur die Liste, sondern alle
            ihre Artikel - und dafuer gibt es kein Rueckgaengig. */}
        <Dialog visible={deleteFor !== null} onDismiss={() => setDeleteFor(null)}>
          <Dialog.Title>{t('lists.deleteTitle', { name: deleteFor?.name ?? '' })}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t('lists.deleteHint')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteFor(null)}>{t('common.cancel')}</Button>
            <Button onPress={remove} testID="list-delete-confirm">
              {t('lists.deleteConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={message !== null}
        onDismiss={() => setMessage(null)}
        duration={3000}
        testID="lists-snackbar"
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
  listContent: {
    // Platz, damit der letzte Eintrag nicht unter dem FAB verschwindet.
    paddingBottom: 96,
  },
  row: {
    minHeight: 64,
    justifyContent: 'center',
  },
  more: {
    margin: 0,
    width: 48,
    height: 48,
  },
  empty: {
    paddingHorizontal: 32,
    paddingTop: 64,
    gap: 8,
  },
  emptyText: {
    textAlign: 'center',
  },
  emptyHint: {
    opacity: 0.7,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
  },
});
