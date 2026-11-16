import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Banner,
  Button,
  Dialog,
  FAB,
  IconButton,
  Menu,
  Portal,
  Snackbar,
  Text,
  TextInput,
  TouchableRipple,
} from 'react-native-paper';

import { ensureFirstStart } from '@/db/appState';
import { categoriesQuery, FALLBACK_CATEGORY_ID } from '@/features/catalog/repository';
import { needsBackupReminder } from '@/features/transfer/backup';
import {
  BACKUP_REMINDER_DISMISSED_KEY,
  LAST_BACKUP_KEY,
  getTimestamp,
  setTimestamp,
} from '@/features/transfer/repository';
import { useKeyboardHeight } from '@/lib/useKeyboardHeight';
import { useAppTheme } from '@/theme';
import { categoryColorFor } from '@/theme/categoryColors';

import {
  buildListOverview,
  buildListPreviews,
  cleanListName,
  EMPTY_LIST_PREVIEW,
  listRoute,
  MAX_LIST_NAME_LENGTH,
  type ListPreview,
} from '../logic';
import {
  allCategoryOrdersQuery,
  createList,
  deleteList,
  duplicateList,
  listPreviewItemsQuery,
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
 * Jede Karte fuehrt zu ihrer Liste; alles Weitere steckt hinter dem
 * Drei-Punkte-Knopf. Vier Aktionen offen nebeneinander waeren auf einem
 * Telefon eine Reihe von Zielen, die man im Vorbeigehen falsch trifft.
 *
 * Seit M18 (ADR-049) zeigt jede Karte, was auf der Liste steht: eine
 * Farbleiste mit einem Segment je Artikel in den Kategoriefarben und die
 * ersten Namen. So erkennt man die richtige Liste, bevor man sie oeffnet.
 */
export function ListsScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const keyboardHeight = useKeyboardHeight();

  const listRows = useLiveQuery(listsQuery());
  const countRows = useLiveQuery(openCountsQuery());
  // Drei Abfragen fuer alle Karten zusammen, nicht je Karte (T-18.3).
  const previewRows = useLiveQuery(listPreviewItemsQuery());
  const categoryRows = useLiveQuery(categoriesQuery());
  const orderRows = useLiveQuery(allCategoryOrdersQuery());

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [renameFor, setRenameFor] = useState<{ id: string; name: string } | null>(null);
  const [deleteFor, setDeleteFor] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [reminder, setReminder] = useState(false);

  const rows = useMemo(
    () => buildListOverview(listRows.data ?? [], countRows.data ?? []),
    [listRows.data, countRows.data],
  );

  const previews = useMemo(
    () =>
      buildListPreviews(
        previewRows.data ?? [],
        categoryRows.data ?? [],
        orderRows.data ?? [],
        FALLBACK_CATEGORY_ID,
      ),
    [previewRows.data, categoryRows.data, orderRows.data],
  );

  const previewText = useCallback(
    (preview: ListPreview): string | null => {
      if (preview.previewNames.length > 0) {
        const names = preview.previewNames.join(', ');
        return preview.hiddenCount > 0 ? t('lists.previewMore', { names }) : names;
      }
      // Nur Erledigtes: Der Stand sagt schon "Alles erledigt", die Leiste ist
      // gedaempft - eine dritte Aussage braucht die Karte nicht.
      return preview.segments.length === 0 ? t('lists.emptyPreview') : null;
    },
    [t],
  );

  // Erinnerung an die Sicherung (FR-6.6). Die Entscheidung selbst trifft eine
  // reine Funktion; hier werden nur die drei Zeitpunkte geholt.
  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      getTimestamp(LAST_BACKUP_KEY),
      getTimestamp(BACKUP_REMINDER_DISMISSED_KEY),
      ensureFirstStart(),
    ]).then(([lastBackupAt, dismissedAt, firstStartAt]) => {
      if (!cancelled) {
        setReminder(needsBackupReminder(lastBackupAt, dismissedAt, firstStartAt, Date.now()));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const dismissReminder = useCallback(() => {
    setReminder(false);
    void setTimestamp(BACKUP_REMINDER_DISMISSED_KEY);
  }, []);

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

  // Das Drei-Punkte-Menue einer Karte - Inhalt und Kennungen wie vor M18.
  const renderMenu = (item: { id: string; name: string }) => (
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
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        <Appbar.Content title={t('lists.title')} />
        {/* Der Katalog haengt an der Uebersicht und nicht an einer einzelnen
            Liste: Er gilt fuer alle. Eine eigene Einstellungsseite bekommt er
            in M9, wenn Sicherung und Diagnose dazukommen. */}
        <Appbar.Action
          icon="tray-arrow-down"
          onPress={() => router.push('/import')}
          accessibilityLabel={t('lists.import')}
          testID="open-import"
        />
        {/* Ein sichtbarer Knopf, der Rest im Menue: Empfangen passiert
            gelegentlich, Katalogpflege und Sicherung selten. Vier Symbole
            nebeneinander waeren fuer die Zielgruppe vier Raetsel. */}
        <Menu
          visible={appMenuOpen}
          onDismiss={() => setAppMenuOpen(false)}
          anchor={
            <Appbar.Action
              icon="dots-vertical"
              onPress={() => setAppMenuOpen(true)}
              accessibilityLabel={t('lists.menu')}
              testID="lists-menu"
            />
          }
        >
          <Menu.Item
            leadingIcon="fridge-outline"
            title={t('lists.pantry')}
            testID="open-pantry"
            onPress={() => {
              setAppMenuOpen(false);
              router.push('/vorrat');
            }}
          />
          <Menu.Item
            leadingIcon="chef-hat"
            title={t('lists.recipes')}
            testID="open-recipes"
            onPress={() => {
              setAppMenuOpen(false);
              router.push('/rezepte');
            }}
          />
          <Menu.Item
            leadingIcon="tag-multiple-outline"
            title={t('lists.products')}
            testID="open-products"
            onPress={() => {
              setAppMenuOpen(false);
              router.push('/produkte');
            }}
          />
          <Menu.Item
            leadingIcon="clipboard-list-outline"
            title={t('lists.templates')}
            testID="open-templates"
            onPress={() => {
              setAppMenuOpen(false);
              router.push('/vorlagen');
            }}
          />
          <Menu.Item
            leadingIcon="content-save-outline"
            title={t('lists.backup')}
            testID="open-backup"
            onPress={() => {
              setAppMenuOpen(false);
              router.push('/sicherung');
            }}
          />
          <Menu.Item
            leadingIcon="stethoscope"
            title={t('lists.diagnostics')}
            testID="open-diagnostics"
            onPress={() => {
              setAppMenuOpen(false);
              router.push('/diagnose');
            }}
          />
        </Menu>
      </Appbar.Header>

      {/* Der Streifen ist die Gegenmassnahme zu Risiko R3: Ohne Cloud-Sicherung
          bedeutet ein verlorenes Telefon den Verlust aller Daten. */}
      <Banner
        visible={reminder}
        icon="cloud-off-outline"
        testID="backup-reminder"
        actions={[
          {
            label: t('backup.reminderDismiss'),
            onPress: dismissReminder,
          },
          {
            label: t('backup.reminderAction'),
            onPress: () => {
              dismissReminder();
              router.push('/sicherung');
            },
          },
        ]}
      >
        {t('backup.reminder')}
      </Banner>

      {/* Vorrat und Rezepte offen statt nur im Menue (ADR-049): Beides wird
          mehrmals die Woche gebraucht. Die Menueeintraege bleiben trotzdem -
          wer sie kennt, soll sie nicht verlieren, und die E2E-Flows nutzen sie. */}
      <View style={styles.quick}>
        <Button
          mode="contained-tonal"
          icon="fridge-outline"
          onPress={() => router.push('/vorrat')}
          accessibilityLabel={t('lists.pantry')}
          testID="quick-pantry"
          style={styles.quickButton}
          contentStyle={styles.quickContent}
        >
          {t('lists.pantry')}
        </Button>
        <Button
          mode="contained-tonal"
          icon="chef-hat"
          onPress={() => router.push('/rezepte')}
          accessibilityLabel={t('lists.recipes')}
          testID="quick-recipes"
          style={styles.quickButton}
          contentStyle={styles.quickContent}
        >
          {t('lists.recipes')}
        </Button>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        testID="lists"
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => {
          const preview = previews[item.id] ?? EMPTY_LIST_PREVIEW;
          const text = previewText(preview);

          return (
            // Die Rundung schneidet die Welle beim Antippen mit ab; deshalb
            // liegt overflow auf der aeusseren Flaeche und nicht am Knopf.
            <View style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
              <TouchableRipple
                onPress={() => open(item.id)}
                accessibilityRole="button"
                accessibilityLabel={t('lists.openList', { name: item.name })}
                testID={`list-${item.name}`}
                style={styles.cardPress}
              >
                <View style={styles.cardBody}>
                  <View style={styles.cardHeader}>
                    <Text variant="titleMedium" numberOfLines={1} style={styles.cardTitle}>
                      {item.name}
                    </Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                      {item.openCount === 0
                        ? t('lists.allDone')
                        : t('lists.open', { count: item.openCount })}
                    </Text>
                    {renderMenu(item)}
                  </View>

                  {/* Die Leiste ist Schmuck mit Nutzen fuers Auge; der
                      Screenreader hoert Stand und Vorschau als Text. */}
                  {preview.segments.length > 0 ? (
                    <View
                      style={styles.bar}
                      importantForAccessibility="no-hide-descendants"
                      accessibilityElementsHidden
                    >
                      {preview.segments.map((segment, index) => (
                        <View
                          // Reine Anzeige ohne eigenen Zustand: Die Position
                          // ist hier ein ausreichender Schluessel.
                          key={index}
                          style={[
                            styles.segment,
                            {
                              backgroundColor: segment.checked
                                ? theme.colors.surfaceVariant
                                : categoryColorFor(theme.categories, segment.categoryId).container,
                            },
                          ]}
                        />
                      ))}
                    </View>
                  ) : null}

                  {text !== null ? (
                    <Text
                      variant="bodySmall"
                      numberOfLines={1}
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {text}
                    </Text>
                  ) : null}
                </View>
              </TouchableRipple>
            </View>
          );
        }}
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
          Zielgruppe eine Vermutung, kein Angebot. In der Tertiaerrolle
          (Orange, ADR-049): "Neue Liste" ist das Besondere auf diesem
          Bildschirm, nicht das Alltaegliche. */}
      <FAB
        icon="plus"
        label={t('lists.create')}
        accessibilityLabel={t('lists.create')}
        onPress={() => {
          setNameDraft('');
          setCreateOpen(true);
        }}
        testID="list-create"
        color={theme.colors.onTertiaryContainer}
        style={[styles.fab, { backgroundColor: theme.colors.tertiaryContainer }]}
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

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  quick: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  quickButton: {
    flex: 1,
  },
  // Paper-Knoepfe sind von sich aus 40 dp hoch; die Tippflaeche soll 48 haben.
  quickContent: {
    minHeight: 48,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    // Platz, damit die letzte Karte nicht unter dem FAB verschwindet.
    paddingBottom: 96,
  },
  // Abstand als Trenner und nicht als gap: Die FlatList legt fuer nicht
  // gezeichnete Bereiche eigene Platzhalter an, die sonst mitgezaehlt wuerden.
  separator: {
    height: 10,
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  cardPress: {
    padding: 12,
  },
  cardBody: {
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
  },
  bar: {
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
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
