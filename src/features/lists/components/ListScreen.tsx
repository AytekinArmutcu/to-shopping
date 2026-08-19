import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Appbar, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { listItems, products as productsTable } from '@/db/schema';
import { AddItemBar } from '@/features/catalog/components/AddItemBar';
import type { CatalogProduct } from '@/features/catalog/logic';
import { createProduct } from '@/features/catalog/repository';
import { ItemRow } from '@/features/items/components/ItemRow';
import { addItem, addProductToList, removeItem } from '@/features/items/repository';
import { getOrCreateActiveList } from '@/features/lists/repository';

/**
 * Der Haupt-Screen: eine Liste mit ihren Artikeln und dem Eingabefeld.
 *
 * In M2 ist die Liste noch flach. Die Gruppierung nach Kategorien in
 * Ladenreihenfolge kommt in M5, das Abhaken in M3.
 *
 * Alle Datenbankzugriffe laufen ueber Repository-Funktionen, nie direkt
 * (CLAUDE.md, Schichtenregel 1). Gelesen wird ueber Live-Abfragen, damit sich
 * die Anzeige nach jedem Schreibvorgang von selbst auffrischt (ADR-020).
 */
export function ListScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [listId, setListId] = useState<string | null>(null);
  const [listName, setListName] = useState('');

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

  const rows = items.data ?? [];
  const products: CatalogProduct[] = catalog.data ?? [];
  const productIdsOnList = rows
    .map((row) => row.productId)
    .filter((id): id is string => id !== null);

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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        {/* Kein subtitle: Material 3 kennt keine Untertitel in der Kopfzeile,
            react-native-paper ignoriert die Eigenschaft im MD3-Modus stillschweigend.
            Die Fortschrittsanzeige bekommt in M3 eine eigene Zeile (FR-3.7). */}
        <Appbar.Content title={listName} />
      </Appbar.Header>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          testID="item-list"
          renderItem={({ item }) => <ItemRow item={item} onRemove={handleRemove} />}
          ListEmptyComponent={
            <View style={styles.empty} testID="list-empty">
              <Text variant="titleMedium" style={styles.emptyText}>
                {t('list.empty.title')}
              </Text>
              <Text variant="bodyMedium" style={[styles.emptyText, styles.emptyHint]}>
                {t('list.empty.hint')}
              </Text>
            </View>
          }
        />

        <View style={{ paddingBottom: insets.bottom }}>
          <AddItemBar
            products={products}
            productIdsOnList={productIdsOnList}
            onPickProduct={handlePick}
            onCreateProduct={handleCreate}
          />
        </View>
      </KeyboardAvoidingView>
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
});
