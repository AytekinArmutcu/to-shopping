import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Button,
  Checkbox,
  Divider,
  List,
  Searchbar,
  Text,
  useTheme,
} from 'react-native-paper';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addProductsToList, listItemsQuery } from '@/features/items/repository';
import { useKeyboardHeight } from '@/lib/useKeyboardHeight';

import { buildCatalogSections, idsToAdd, type CatalogProduct } from '../logic';
import { catalogProductsQuery, categoriesQuery } from '../repository';

type Props = {
  listId: string;
};

/**
 * Der zweite Weg, Artikel auf die Liste zu bekommen (PRD Flow 1.7, FR-2.3).
 *
 * Er ist nicht nur Ersatz fuer die Texteingabe, sondern deren Gegenstueck:
 * Wer tippt, weiss bereits, was er will. Wer blaettert, sucht die Erinnerung -
 * deshalb die Gruppierung nach Kategorien und die Mehrfachauswahl, statt
 * einzeln hin und her zu springen.
 *
 * Die Auswahl lebt nur, solange dieser Screen offen ist. Sie in der Datenbank
 * zu halten, waere ein zweiter Zustand neben der Liste selbst - samt der
 * Frage, was mit einer halben Auswahl beim naechsten Start geschieht.
 */
export function CatalogScreen({ listId }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const catalog = useLiveQuery(catalogProductsQuery());
  const categoryRows = useLiveQuery(categoriesQuery());
  const items = useLiveQuery(listItemsQuery(listId), [listId]);

  const products: CatalogProduct[] = useMemo(() => catalog.data ?? [], [catalog.data]);
  const categories = useMemo(() => categoryRows.data ?? [], [categoryRows.data]);

  const productIdsOnList = useMemo(
    () =>
      (items.data ?? [])
        .filter((row) => !row.isChecked)
        .map((row) => row.productId)
        .filter((id): id is string => id !== null),
    [items.data],
  );

  const onList = useMemo(() => new Set(productIdsOnList), [productIdsOnList]);

  const sections = useMemo(
    () => buildCatalogSections(products, categories, query, t('catalog.uncategorized')),
    [products, categories, query, t],
  );

  const toAdd = idsToAdd(selected, productIdsOnList);

  const toggle = useCallback((productId: string) => {
    setSelected((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  }, []);

  const apply = useCallback(() => {
    void addProductsToList(listId, selected).then(() => {
      router.back();
    });
  }, [listId, selected]);

  // Siehe ADR-035: eine Quelle fuer die Tastaturhoehe, ueberall dieselbe.
  const footerTarget = Math.max(keyboardHeight, insets.bottom) + 12;
  const footerPadding = useAnimatedStyle(
    () => ({ paddingBottom: withTiming(footerTarget, { duration: 220 }) }),
    [footerTarget],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => router.back()} accessibilityLabel={t('catalog.back')} />
        <Appbar.Content title={t('catalog.title')} />
      </Appbar.Header>

      <Searchbar
        value={query}
        onChangeText={setQuery}
        placeholder={t('catalog.search')}
        accessibilityLabel={t('catalog.search')}
        testID="catalog-search"
        style={styles.search}
      />

      <SectionList
        sections={sections}
        keyExtractor={(product) => product.id}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled
        testID="catalog-list"
        renderSectionHeader={({ section }) => (
          <Text
            variant="titleSmall"
            style={[
              styles.sectionHeader,
              { backgroundColor: theme.colors.surface, color: theme.colors.primary },
            ]}
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => {
          const isOnList = onList.has(item.id);
          const isSelected = selected.includes(item.id);

          return (
            <List.Item
              title={item.name}
              // Was offen auf der Liste steht, bleibt sichtbar, aber nicht
              // waehlbar: Ausblenden wuerde beim Blaettern den Eindruck
              // erwecken, das Produkt fehle im Katalog.
              description={isOnList ? t('catalog.onList') : undefined}
              disabled={isOnList}
              onPress={() => toggle(item.id)}
              // Eine gesperrte Zeile fasst Android in der Bedienungshilfe zu
              // einem einzigen Knoten zusammen - ihre Beschriftung "Steht
              // schon auf der Liste" wird dann nicht mehr vorgelesen. Deshalb
              // muss die Ansage der Zeile selbst sie enthalten, sonst hoert
              // man "auswaehlen" bei etwas, das nicht waehlbar ist.
              accessibilityLabel={
                isOnList
                  ? t('catalog.onListLabel', { name: item.name })
                  : isSelected
                    ? t('catalog.deselect', { name: item.name })
                    : t('catalog.select', { name: item.name })
              }
              accessibilityState={{ disabled: isOnList, checked: isSelected || isOnList }}
              testID={`catalog-${item.name}`}
              left={(props) => (
                <Checkbox.Android
                  {...props}
                  status={isSelected || isOnList ? 'checked' : 'unchecked'}
                  disabled={isOnList}
                  onPress={() => toggle(item.id)}
                />
              )}
              style={[styles.row, isOnList ? styles.rowOnList : null]}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty} testID="catalog-empty">
            <Text variant="titleMedium" style={styles.emptyText}>
              {t('catalog.empty')}
            </Text>
            <Text variant="bodyMedium" style={[styles.emptyText, styles.emptyHint]}>
              {t('catalog.emptyHint')}
            </Text>
          </View>
        }
      />

      <Divider />
      <Animated.View
        style={[styles.footer, footerPadding, { backgroundColor: theme.colors.surface }]}
      >
        <Button
          mode="contained"
          icon="playlist-plus"
          disabled={toAdd.length === 0}
          onPress={apply}
          testID="catalog-apply"
        >
          {toAdd.length === 0
            ? t('catalog.apply')
            : t('catalog.applyCount', { count: toAdd.length })}
        </Button>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  search: {
    margin: 12,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  row: {
    minHeight: 56,
    justifyContent: 'center',
  },
  rowOnList: {
    opacity: 0.6,
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
    paddingHorizontal: 16,
    paddingTop: 12,
  },
});
