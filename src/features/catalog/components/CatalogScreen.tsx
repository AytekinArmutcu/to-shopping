import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, View } from 'react-native';
import { Appbar, Button, Checkbox, List, Searchbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addProductsToList, listItemsQuery } from '@/features/items/repository';
import { bottomInsetWithKeyboard } from '@/lib/keyboard';
import { useKeyboardHeight } from '@/lib/useKeyboardHeight';
import { useAppTheme } from '@/theme';
import { categoryColorFor } from '@/theme/categoryColors';

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
  const theme = useAppTheme();
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
  const footerTarget = bottomInsetWithKeyboard(keyboardHeight, insets.bottom) + 12;
  // Gewoehnlicher Stil statt Reanimated-Animation: siehe ADR-050.
  const footerPadding = { paddingBottom: footerTarget };

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
        // Siehe ProductsScreen: Paper beschriftet Lupe und X sonst englisch.
        searchAccessibilityLabel={t('catalog.searchAction')}
        clearAccessibilityLabel={t('catalog.searchClear')}
        testID="catalog-search"
        style={styles.search}
      />

      <SectionList
        sections={sections}
        keyExtractor={(product) => product.id}
        keyboardShouldPersistTaps="handled"
        // Keine festen Ueberschriften mehr: Ein klebender Kopf haette oben
        // runde Ecken und laege als Fremdkoerper ueber der naechsten Flaeche.
        // Die Farbe der Flaeche sagt beim Blaettern, in welcher Abteilung man
        // ist (ADR-049).
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        testID="catalog-list"
        renderSectionHeader={({ section }) => {
          const colors = categoryColorFor(theme.categories, section.key);
          return (
            <Text
              variant="titleSmall"
              accessibilityRole="header"
              style={[
                styles.sectionHeader,
                { backgroundColor: colors.container, color: colors.onContainer },
              ]}
            >
              {section.title}
            </Text>
          );
        }}
        renderSectionFooter={() => <View style={styles.sectionGap} />}
        renderItem={({ item, index, section }) => {
          const isOnList = onList.has(item.id);
          const isSelected = selected.includes(item.id);
          const colors = categoryColorFor(theme.categories, section.key);
          const isLast = index === section.data.length - 1;

          return (
            <View
              style={[
                styles.rowSurface,
                isLast ? styles.rowSurfaceLast : null,
                { backgroundColor: colors.container },
              ]}
            >
              <List.Item
                title={item.name}
                // Was offen auf der Liste steht, bleibt sichtbar, aber nicht
                // waehlbar: Ausblenden wuerde beim Blaettern den Eindruck
                // erwecken, das Produkt fehle im Katalog.
                description={isOnList ? t('catalog.onList') : undefined}
                // Fuer jede Kategorie ist nur das Paar container/onContainer auf
                // Kontrast geprueft - Titel und Hinweis nehmen deshalb beide
                // onContainer statt der Standardfarben von Paper (ADR-049).
                titleStyle={{ color: colors.onContainer }}
                descriptionStyle={{ color: colors.onContainer }}
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
                    uncheckedColor={colors.onContainer}
                    onPress={() => toggle(item.id)}
                    // Bedienelement ist die ganze Zeile - sie traegt die Ansage
                    // und den Zustand. Waere das Kaestchen zusaetzlich
                    // ansteuerbar, laege es unbeschriftet im Vorlesefluss.
                    importantForAccessibility="no"
                  />
                )}
                style={[styles.row, isOnList ? styles.rowOnList : null]}
              />
            </View>
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

      {/* Ohne Trennlinie: Flaechen statt Linien (ADR-049). */}
      <View style={[styles.footer, footerPadding, { backgroundColor: theme.colors.background }]}>
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
      </View>
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
  // Seitenrand der Gruppenflaechen - wie im Vorrat (ADR-049).
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  // Oberkante der Gruppenflaeche: 18 dp Rundung. Der Titel rueckt 16 dp ein
  // und steht damit ueber den Kaestchen der Zeilen.
  sectionHeader: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 12,
    paddingBottom: 4,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  rowSurface: {
    paddingHorizontal: 8,
  },
  // Unterkante der Gruppenflaeche. overflow schneidet die Welle der letzten
  // Zeile an der Rundung ab.
  rowSurfaceLast: {
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    paddingBottom: 8,
    overflow: 'hidden',
  },
  sectionGap: {
    height: 10,
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
