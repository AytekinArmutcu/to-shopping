import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Appbar, Button, Dialog, Portal, Snackbar, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { listItems, products as productsTable } from '@/db/schema';
import { AddItemBar } from '@/features/catalog/components/AddItemBar';
import type { CatalogProduct } from '@/features/catalog/logic';
import { createProduct } from '@/features/catalog/repository';
import { ItemRow } from '@/features/items/components/ItemRow';
import { canFinishShopping, partitionItems } from '@/features/items/logic';
import {
  addItem,
  addProductToList,
  finishShopping,
  removeItem,
  setItemChecked,
} from '@/features/items/repository';
import { getOrCreateActiveList } from '@/features/lists/repository';

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
export function ListScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [listId, setListId] = useState<string | null>(null);
  const [listName, setListName] = useState('');

  // UI-Zustand, bewusst lokal: Er gehoert zu genau diesem Screen und ueberlebt
  // dessen Verlassen nicht. Ein globaler Store waere hier Aufwand ohne Nutzen
  // (ADR-020 verlangt nur, dass er keine Daten haelt).
  const [showChecked, setShowChecked] = useState(false);
  const [undoItemId, setUndoItemId] = useState<string | null>(null);
  const [undoName, setUndoName] = useState('');
  const [finishedCount, setFinishedCount] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getOrCreateActiveList().then((list) => {
      if (!cancelled && list) {
        setListId(list.id);
        setListName(list.name);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useLiveQuery(
    db
      .select()
      .from(listItems)
      .where(eq(listItems.listId, listId ?? ''))
      .orderBy(listItems.position),
    [listId],
  );

  const catalog = useLiveQuery(
    db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        categoryId: productsTable.categoryId,
        defaultUnit: productsTable.defaultUnit,
      })
      .from(productsTable),
  );

  const rows = useMemo(() => items.data ?? [], [items.data]);
  const products: CatalogProduct[] = catalog.data ?? [];
  const productIdsOnList = rows
    .filter((row) => !row.isChecked)
    .map((row) => row.productId)
    .filter((id): id is string => id !== null);

  const { visible, openCount, checkedCount } = useMemo(
    () => partitionItems(rows, showChecked),
    [rows, showChecked],
  );

  const handlePick = useCallback(
    (product: CatalogProduct) => {
      if (listId) {
        void addProductToList(listId, product.id);
      }
    },
    [listId],
  );

  const handleCreate = useCallback(
    (name: string) => {
      if (!listId) {
        return;
      }
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
    if (!listId) {
      return;
    }
    setConfirmOpen(false);
    void finishShopping(listId).then((count) => {
      setUndoItemId(null);
      setFinishedCount(count);
    });
  }, [listId]);

  const canFinish = canFinishShopping(rows);
  const total = openCount + checkedCount;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        <Appbar.Content title={listName} />
      </Appbar.Header>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          testID="item-list"
          renderItem={({ item }) => (
            <ItemRow
              item={item}
              unitShort={t(`units.${item.unit}.short`)}
              onToggle={handleToggle}
              onRemove={handleRemove}
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

        <View style={{ paddingBottom: insets.bottom }}>
          <AddItemBar
            products={products}
            productIdsOnList={productIdsOnList}
            onPickProduct={handlePick}
            onCreateProduct={handleCreate}
          />
        </View>
      </KeyboardAvoidingView>

      <Portal>
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
