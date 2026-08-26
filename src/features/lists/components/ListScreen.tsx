import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, View } from 'react-native';
import { Appbar, Button, Dialog, Menu, Portal, Snackbar, Text, useTheme } from 'react-native-paper';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddItemBar } from '@/features/catalog/components/AddItemBar';
import type { CatalogProduct } from '@/features/catalog/logic';
import {
  catalogProductsQuery,
  categoriesQuery,
  createProduct,
  FALLBACK_CATEGORY_ID,
} from '@/features/catalog/repository';
import { ItemDetailBar, type ItemDetailChange } from '@/features/items/components/ItemDetailBar';
import { ItemRow } from '@/features/items/components/ItemRow';
import { canFinishShopping } from '@/features/items/logic';
import {
  addItem,
  addProductToList,
  finishShopping,
  listItemsQuery,
  removeItem,
  setItemChecked,
  updateItemDetails,
} from '@/features/items/repository';
import {
  buildListSections,
  CHECKED_SECTION_ID,
  listRoute,
  ROUTE_OVERVIEW,
} from '@/features/lists/logic';
import {
  categoryOrderQuery,
  listQuery,
  setLastRoute,
  touchList,
} from '@/features/lists/repository';
import { buildShareText, SHARE_COPY_HINT_KEY } from '@/features/transfer/logic';
import { buildSharedListForList } from '@/features/transfer/repository';
import { shareList } from '@/features/transfer/share';
import { getFlag, setFlag } from '@/db/appState';

/**
 * Der Haupt-Screen: eine Liste mit ihren Artikeln, Eingabefeld und Abschluss.
 *
 * In M3 kommt der Laden-Flow dazu (PRD Flow 2): abhaken, ausblenden,
 * rueckgaengig machen, Fortschritt sehen, Einkauf abschliessen. Die
 * Gruppierung nach Kategorien in Ladenreihenfolge folgt in M5.
 *
 * Alle Datenbankzugriffe laufen ueber Repository-Funktionen (CLAUDE.md,
 * Schichtenregel 1), alles Rechnende steckt in features/items/logic.ts.
 */
type Props = {
  listId: string;
};

export function ListScreen({ listId }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // UI-Zustand, bewusst lokal: Er gehoert zu genau diesem Screen und ueberlebt
  // dessen Verlassen nicht. Ein globaler Store waere hier Aufwand ohne Nutzen
  // (ADR-020 verlangt nur, dass er keine Daten haelt).
  const [showChecked, setShowChecked] = useState(false);
  const [undoItemId, setUndoItemId] = useState<string | null>(null);
  const [undoName, setUndoName] = useState('');
  const [finishedCount, setFinishedCount] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareHintOpen, setShareHintOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Ab Android 15 erzwingt das System Edge-to-Edge: Das Fenster wird beim
  // Oeffnen der Tastatur nicht mehr verkleinert, android:windowSoftInputMode
  // "adjustResize" ist wirkungslos. Die Tastatur ist stattdessen ein Inset,
  // um das sich die App selbst kuemmern muss - sonst liegt sie ueber dem
  // Eingabefeld und man sieht weder die Eingabe noch die Vorschlaege.
  //
  // Bewusst ueber Reanimated statt KeyboardAvoidingView: Letzteres tut auf
  // Android ohne "behavior" nichts, und die Hoehe aus useAnimatedKeyboard
  // folgt der Tastatur ruckelfrei im selben Takt wie ihre Animation.
  const keyboard = useAnimatedKeyboard();

  // Beim Oeffnen zwei Vermerke: Die Liste gilt als zuletzt benutzt, und die
  // App merkt sich diesen Screen als Startpunkt (FR-1.5).
  useEffect(() => {
    void touchList(listId);
    void setLastRoute(listRoute(listId));
  }, [listId]);

  // Die Abfragen kommen aus den Repositories, damit der Screen keine Tabellen
  // kennt (CLAUDE.md, Schichtenregel 1). Als Bauplan und nicht als Ergebnis,
  // weil useLiveQuery sie bei jeder Datenaenderung erneut ausfuehrt.
  const listRows = useLiveQuery(listQuery(listId), [listId]);
  const items = useLiveQuery(listItemsQuery(listId), [listId]);
  const catalog = useLiveQuery(catalogProductsQuery());
  const categoryRows = useLiveQuery(categoriesQuery());
  const orderRows = useLiveQuery(categoryOrderQuery(listId), [listId]);

  const rows = useMemo(() => items.data ?? [], [items.data]);
  const products: CatalogProduct[] = catalog.data ?? [];
  const productIdsOnList = rows
    .filter((row) => !row.isChecked)
    .map((row) => row.productId)
    .filter((id): id is string => id !== null);

  // Die Gruppierung nach Kategorien in Ladenreihenfolge (architecture.md 4.1).
  // Ob die Liste eine eigene Reihenfolge hat oder nicht, entscheidet sich in
  // orderCategories - hier gibt es dafuer keine Verzweigung.
  const { sections, openCount, checkedCount } = useMemo(
    () =>
      buildListSections(rows, categoryRows.data ?? [], orderRows.data ?? [], {
        showChecked,
        fallbackCategoryId: FALLBACK_CATEGORY_ID,
        fallbackTitle: t('list.fallbackCategory'),
        checkedTitle: t('list.checked'),
      }),
    [rows, categoryRows.data, orderRows.data, showChecked, t],
  );

  const handlePick = useCallback(
    (product: CatalogProduct) => {
      void addProductToList(listId, product.id);
    },
    [listId],
  );

  const handleCreate = useCallback(
    (name: string) => {
      void createProduct(name).then((product) => {
        if (product) {
          void addProductToList(listId, product.id);
        } else {
          // Sollte nicht vorkommen, aber der Artikel darf nicht verloren gehen:
          // dann eben als freier Text ohne Katalogbezug.
          void addItem({ listId, name });
        }
      });
    },
    [listId],
  );

  const handleRemove = useCallback((id: string) => {
    void removeItem(id);
    // Die Detailzeile darf keinen Artikel zeigen, den es nicht mehr gibt.
    setEditingId((current) => (current === id ? null : current));
  }, []);

  const handleDetails = useCallback((id: string, details: ItemDetailChange) => {
    void updateItemDetails(id, details);
  }, []);

  const handleToggle = useCallback(
    (id: string, isChecked: boolean) => {
      void setItemChecked(id, isChecked);
      if (isChecked) {
        // Der Artikel verschwindet sofort aus der Liste. Ohne diesen Hinweis
        // waere ein Fehlgriff nur ueber den Schalter "erledigt anzeigen"
        // zu korrigieren - zu umstaendlich fuer einen Wisch daneben.
        setUndoItemId(id);
        setUndoName(rows.find((row) => row.id === id)?.name ?? '');
      } else {
        setUndoItemId(null);
      }
    },
    [rows],
  );

  const handleUndo = useCallback(() => {
    if (undoItemId) {
      void setItemChecked(undoItemId, false);
      setUndoItemId(null);
    }
  }, [undoItemId]);

  const handleFinish = useCallback(() => {
    setConfirmOpen(false);
    void finishShopping(listId).then((count) => {
      setUndoItemId(null);
      setFinishedCount(count);
    });
  }, [listId]);

  const keyboardPadding = useAnimatedStyle(() => ({
    paddingBottom: Math.max(keyboard.height.value, insets.bottom),
  }));

  /**
   * Teilen (FR-6.1, PRD Flow 3): Datei plus lesbarer Text ins Android-Menue.
   *
   * Die Datei wird erst hier aus der Datenbank gebaut und nicht aus dem, was
   * gerade auf dem Bildschirm steht: Sichtbar ist je nach Schalter nur ein
   * Teil der Liste, geteilt gehoert aber alles Offene.
   */
  const doShare = useCallback(async () => {
    const file = await buildSharedListForList(listId);

    if (file === null || file.list.items.length === 0) {
      setMessage(t('share.empty'));
      return;
    }

    const text = buildShareText(file.list.items, {
      header: t('share.header', { name: file.list.name, count: file.list.items.length }),
      unitShort: (unit) => t(`units.${unit}.short`),
    });

    const outcome = await shareList(file, text, t('share.fallbackName'), t('share.dialogTitle'));

    if (outcome === 'nichtVerfuegbar') {
      setMessage(t('share.unavailable'));
    }
  }, [listId, t]);

  /**
   * Beim ersten Mal kommt der Hinweis, dass eine Kopie entsteht (FR-6.7).
   *
   * Er steht vor dem Teilen und nicht danach: Wer erst hinterher erfaehrt,
   * dass Aenderungen nicht zurueckfliessen, hat die falsche Erwartung schon
   * verschickt.
   */
  const startShare = useCallback(() => {
    setMenuOpen(false);
    void getFlag(SHARE_COPY_HINT_KEY).then((seen) => {
      if (seen) {
        void doShare();
      } else {
        setShareHintOpen(true);
      }
    });
  }, [doShare]);

  const confirmShareHint = useCallback(() => {
    setShareHintOpen(false);
    void setFlag(SHARE_COPY_HINT_KEY, true).then(() => doShare());
  }, [doShare]);

  // Die Detailzeile liest ihre Werte aus der Live-Abfrage, nicht aus einer
  // Kopie: So zeigt sie immer, was tatsaechlich in der Datenbank steht.
  const editingItem = rows.find((row) => row.id === editingId) ?? null;

  const canFinish = canFinishShopping(rows);
  const total = openCount + checkedCount;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        {/* Zurueck fuehrt immer zur Uebersicht - auch wenn die App direkt auf
            dieser Liste gestartet ist und es gar keinen Schritt zurueck gibt. */}
        <Appbar.BackAction
          onPress={() => {
            void setLastRoute(ROUTE_OVERVIEW);
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/listen');
            }
          }}
          accessibilityLabel={t('list.back')}
          testID="back-to-lists"
        />
        <Appbar.Content title={listRows.data?.[0]?.name ?? ''} />
        <Appbar.Action
          icon="store-outline"
          onPress={() => {
            router.push({ pathname: '/ladenlayout', params: { listId } });
          }}
          accessibilityLabel={t('list.layout')}
          testID="open-layout"
        />
        <Appbar.Action
          icon="playlist-plus"
          onPress={() => {
            router.push({ pathname: '/katalog', params: { listId } });
          }}
          accessibilityLabel={t('list.catalog')}
          testID="open-catalog"
        />
        <Menu
          visible={menuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={
            <Appbar.Action
              icon="dots-vertical"
              onPress={() => setMenuOpen(true)}
              accessibilityLabel={t('list.menu')}
              testID="list-menu"
            />
          }
        >
          <Menu.Item
            leadingIcon="share-variant"
            title={t('list.share')}
            onPress={startShare}
            testID="menu-share"
          />
        </Menu>
      </Appbar.Header>

      <View style={styles.container}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled
          testID="item-list"
          renderSectionHeader={({ section }) => (
            <Text
              variant="titleSmall"
              testID={`section-${section.key}`}
              style={[
                styles.sectionHeader,
                {
                  backgroundColor: theme.colors.background,
                  color:
                    section.key === CHECKED_SECTION_ID
                      ? theme.colors.onSurfaceVariant
                      : theme.colors.primary,
                },
              ]}
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <ItemRow
              item={item}
              unitShort={t(`units.${item.unit}.short`)}
              isEditing={item.id === editingId}
              onToggle={handleToggle}
              onRemove={handleRemove}
              onOpenDetails={setEditingId}
            />
          )}
          ListEmptyComponent={
            checkedCount > 0 ? null : (
              <View style={styles.empty} testID="list-empty">
                <Text variant="titleMedium" style={styles.emptyText}>
                  {t('list.empty.title')}
                </Text>
                <Text variant="bodyMedium" style={[styles.emptyText, styles.emptyHint]}>
                  {t('list.empty.hint')}
                </Text>
              </View>
            )
          }
        />

        {total > 0 ? (
          <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
            <View style={styles.footerRow}>
              <Text variant="labelLarge" testID="progress">
                {openCount === 0
                  ? t('list.allDone')
                  : t('list.progress', { open: openCount, total })}
              </Text>
              {checkedCount > 0 ? (
                <Button
                  compact
                  onPress={() => setShowChecked((value) => !value)}
                  testID="toggle-checked"
                >
                  {showChecked
                    ? t('list.hideChecked')
                    : t('list.showChecked', { count: checkedCount })}
                </Button>
              ) : null}
            </View>
            <Button
              mode="contained"
              icon="cart-check"
              disabled={!canFinish}
              onPress={() => (openCount > 0 ? setConfirmOpen(true) : handleFinish())}
              testID="finish-shopping"
            >
              {t('list.finish')}
            </Button>
          </View>
        ) : null}

        {/* Unten steht entweder das Eingabefeld oder die Detailzeile - nie
            beides. Zwei Eingabebereiche uebereinander waeren bei offener
            Tastatur kaum noch zu treffen, und die Detailzeile gehoert an
            genau die Stelle, die der Daumen ohnehin ansteuert. */}
        <Animated.View style={keyboardPadding}>
          {editingItem ? (
            <ItemDetailBar
              // Neuer Artikel, neuer Zustand: siehe ItemDetailBar.
              key={editingItem.id}
              item={editingItem}
              onChange={handleDetails}
              onClose={() => setEditingId(null)}
            />
          ) : (
            <AddItemBar
              products={products}
              productIdsOnList={productIdsOnList}
              onPickProduct={handlePick}
              onCreateProduct={handleCreate}
            />
          )}
        </Animated.View>
      </View>

      <Portal>
        {/* Einmaliger Hinweis vor dem ersten Teilen (FR-6.7). */}
        <Dialog visible={shareHintOpen} onDismiss={() => setShareHintOpen(false)}>
          <Dialog.Title>{t('share.copyTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t('share.copyHint')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShareHintOpen(false)}>{t('common.cancel')}</Button>
            <Button onPress={confirmShareHint} testID="share-hint-confirm">
              {t('share.copyConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Rueckfrage nur, wenn noch etwas offen ist (PRD Flow 2.8). Ist alles
            abgehakt, waere sie ein ueberfluessiger Klick. */}
        <Dialog visible={confirmOpen} onDismiss={() => setConfirmOpen(false)}>
          <Dialog.Title>{t('list.finishOpenTitle', { count: openCount })}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t('list.finishOpenHint')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmOpen(false)}>{t('common.cancel')}</Button>
            <Button onPress={handleFinish} testID="finish-confirm">
              {t('list.finishConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={message !== null}
        onDismiss={() => setMessage(null)}
        duration={4000}
        testID="list-message"
      >
        {message ?? ''}
      </Snackbar>

      <Snackbar
        visible={undoItemId !== null}
        onDismiss={() => setUndoItemId(null)}
        duration={4000}
        action={{ label: t('common.undo'), onPress: handleUndo }}
        testID="undo-snackbar"
      >
        {t('item.checked', { name: undoName })}
      </Snackbar>

      <Snackbar
        visible={finishedCount !== null}
        onDismiss={() => setFinishedCount(null)}
        duration={3000}
        testID="finished-snackbar"
      >
        {t('list.finished', { count: finishedCount ?? 0 })}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
});
