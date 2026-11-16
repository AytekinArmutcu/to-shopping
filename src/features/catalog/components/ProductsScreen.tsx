import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Button,
  Checkbox,
  Dialog,
  FAB,
  HelperText,
  IconButton,
  List,
  Menu,
  Portal,
  RadioButton,
  Searchbar,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';

import { useKeyboardHeight } from '@/lib/useKeyboardHeight';
import { useAppTheme } from '@/theme';
import { categoryColorFor } from '@/theme/categoryColors';

import {
  buildCatalogSections,
  cleanProductName,
  hasNameConflict,
  type CatalogProduct,
} from '../logic';
import {
  catalogProductsQuery,
  categoriesQuery,
  createProduct,
  deleteProduct,
  FALLBACK_CATEGORY_ID,
  resetCatalog,
  setProductStaple,
  stapleProductIdsQuery,
  updateProduct,
} from '../repository';

type Draft = {
  /** null heisst: neues Produkt. */
  id: string | null;
  name: string;
  categoryId: string;
  /** Grundvorrat (FR-4.5, ADR-047). */
  isStaple: boolean;
};

/**
 * Die Katalogpflege (FR-4.2, FR-4.3, FR-4.4).
 *
 * Mitgelieferte Produkte sind hier genauso veraenderbar wie eigene. Ein
 * Katalog, den der Nutzer nicht anfassen darf, waere nach zwei Wochen im Weg -
 * und die Sicherung dagegen ist nicht ein Verbot, sondern "Katalog
 * zuruecksetzen" (ADR-031).
 *
 * Die Gruppierung teilt sich die Funktion mit dem Auswahl-Katalog
 * (buildCatalogSections). Zwei Bildschirme, die dieselben Produkte in
 * unterschiedlicher Reihenfolge zeigen, waeren ein Fehler, den niemand sucht.
 */
export function ProductsScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const keyboardHeight = useKeyboardHeight();

  const catalog = useLiveQuery(catalogProductsQuery());
  const categoryRows = useLiveQuery(categoriesQuery());
  const stapleRows = useLiveQuery(stapleProductIdsQuery());

  const [query, setQuery] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleteFor, setDeleteFor] = useState<CatalogProduct | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const products: CatalogProduct[] = useMemo(() => catalog.data ?? [], [catalog.data]);
  const categories = useMemo(() => categoryRows.data ?? [], [categoryRows.data]);
  const stapleIds = useMemo(
    () => new Set((stapleRows.data ?? []).map((row) => row.id)),
    [stapleRows.data],
  );

  const sections = useMemo(
    () => buildCatalogSections(products, categories, query, t('catalog.uncategorized')),
    [products, categories, query, t],
  );

  const duplicate = draft !== null && hasNameConflict(draft.name, products, draft.id ?? undefined);
  const canSave = draft !== null && cleanProductName(draft.name).length > 0 && !duplicate;

  const save = useCallback(() => {
    if (draft === null || !canSave) {
      return;
    }

    const { id, name, categoryId, isStaple } = draft;
    setDraft(null);

    // Das Kennzeichen hat eine eigene Schreibfunktion (setProductStaple), damit
    // eine Namensaenderung es nie nebenbei ueberschreibt. Hier gehoert es zum
    // Dialog und wird deshalb gleich danach geschrieben.
    if (id === null) {
      void createProduct(name, categoryId).then((created) =>
        created && isStaple ? setProductStaple(created.id, true) : undefined,
      );
    } else {
      void updateProduct(id, name, categoryId).then((updated) =>
        updated ? setProductStaple(id, isStaple) : undefined,
      );
    }
  }, [draft, canSave]);

  const remove = useCallback(() => {
    const target = deleteFor;
    setDeleteFor(null);

    if (target === null) {
      return;
    }

    void deleteProduct(target.id).then(() => {
      setMessage(t('products.deleted', { name: target.name }));
    });
  }, [deleteFor, t]);

  const reset = useCallback(() => {
    setResetOpen(false);
    void resetCatalog().then((result) => {
      setMessage(
        result.blocked === 0
          ? t('products.resetDone', { count: result.restored })
          : `${t('products.resetDone', { count: result.restored })} · ${t('products.resetBlocked', { count: result.blocked })}`,
      );
    });
  }, [t]);

  // Siehe ADR-026: Der Dialog haengt im Portal desselben Fensters und weiss
  // nichts von der Tastatur.
  const dialogStyle = { marginBottom: keyboardHeight };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => router.back()} accessibilityLabel={t('products.back')} />
        <Appbar.Content title={t('products.title')} />
        <Appbar.Action
          icon="backup-restore"
          onPress={() => setResetOpen(true)}
          accessibilityLabel={t('products.reset')}
          testID="catalog-reset"
        />
      </Appbar.Header>

      <Searchbar
        value={query}
        onChangeText={setQuery}
        placeholder={t('products.search')}
        accessibilityLabel={t('products.search')}
        // Ohne diese beiden liest der Screenreader die englischen Vorgaben
        // von Paper vor: "search" und "clear", mitten in einer deutschen App.
        // Aufgefallen ist das erst im Hierarchie-Abzug eines E2E-Laufs - von
        // aussen sind es zwei Symbole ohne Beschriftung.
        searchAccessibilityLabel={t('products.searchAction')}
        clearAccessibilityLabel={t('products.searchClear')}
        testID="products-search"
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
        testID="products-list"
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
                description={stapleIds.has(item.id) ? t('products.staple') : undefined}
                // Nur das Paar container/onContainer ist auf Kontrast geprueft
                // (ADR-049) - deshalb nicht die Standardfarben von Paper.
                titleStyle={{ color: colors.onContainer }}
                descriptionStyle={{ color: colors.onContainer }}
                onPress={() =>
                  setDraft({
                    id: item.id,
                    name: item.name,
                    categoryId: item.categoryId ?? FALLBACK_CATEGORY_ID,
                    isStaple: stapleIds.has(item.id),
                  })
                }
                testID={`product-${item.name}`}
                style={styles.row}
                right={() => (
                  <Menu
                    visible={menuFor === item.id}
                    onDismiss={() => setMenuFor(null)}
                    anchor={
                      <IconButton
                        icon="dots-vertical"
                        iconColor={colors.onContainer}
                        onPress={() => setMenuFor(item.id)}
                        accessibilityLabel={t('products.more', { name: item.name })}
                        testID={`product-more-${item.name}`}
                        style={styles.more}
                      />
                    }
                  >
                    <Menu.Item
                      leadingIcon="pencil"
                      title={t('products.edit')}
                      testID="product-edit"
                      onPress={() => {
                        setMenuFor(null);
                        setDraft({
                          id: item.id,
                          name: item.name,
                          categoryId: item.categoryId ?? FALLBACK_CATEGORY_ID,
                          isStaple: stapleIds.has(item.id),
                        });
                      }}
                    />
                    <Menu.Item
                      leadingIcon="delete-outline"
                      title={t('products.delete')}
                      testID="product-delete"
                      onPress={() => {
                        setMenuFor(null);
                        setDeleteFor(item);
                      }}
                    />
                  </Menu>
                )}
              />
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty} testID="products-empty">
            <Text variant="titleMedium" style={styles.emptyText}>
              {t('products.empty')}
            </Text>
            <Text variant="bodyMedium" style={[styles.emptyText, styles.emptyHint]}>
              {t('products.emptyHint')}
            </Text>
          </View>
        }
      />

      <FAB
        icon="plus"
        label={t('products.create')}
        accessibilityLabel={t('products.create')}
        onPress={() =>
          setDraft({ id: null, name: query, categoryId: FALLBACK_CATEGORY_ID, isStaple: false })
        }
        testID="product-create"
        // Orange wie jeder "Neu"-Knopf (ADR-049): eine Farbe fuer "hier entsteht
        // etwas", auf allen drei Screens dieselbe.
        color={theme.colors.onTertiaryContainer}
        style={[styles.fab, { backgroundColor: theme.colors.tertiaryContainer }]}
      />

      <Portal>
        <Dialog visible={draft !== null} onDismiss={() => setDraft(null)} style={dialogStyle}>
          <Dialog.Title>
            {draft?.id === null ? t('products.createTitle') : t('products.editTitle')}
          </Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScroll}>
            <TextInput
              mode="outlined"
              value={draft?.name ?? ''}
              onChangeText={(name) =>
                setDraft((current) => (current ? { ...current, name } : null))
              }
              label={t('products.nameLabel')}
              placeholder={t('products.namePlaceholder')}
              error={duplicate}
              testID="product-name"
            />
            {/* Der Hinweis erscheint waehrend des Tippens, nicht erst beim
                Speichern: Ein abgelehnter Knopf ohne Begruendung ist die
                schlechteste aller Rueckmeldungen. */}
            <HelperText type="error" visible={duplicate}>
              {t('products.duplicate')}
            </HelperText>

            <Checkbox.Item
              label={t('products.staple')}
              status={draft?.isStaple ? 'checked' : 'unchecked'}
              onPress={() =>
                setDraft((current) =>
                  current ? { ...current, isStaple: !current.isStaple } : null,
                )
              }
              testID="product-staple"
              style={styles.radio}
            />
            <HelperText type="info" visible>
              {t('products.stapleHint')}
            </HelperText>

            <Text variant="labelLarge" style={styles.categoryLabel}>
              {t('products.categoryLabel')}
            </Text>
            <RadioButton.Group
              value={draft?.categoryId ?? FALLBACK_CATEGORY_ID}
              onValueChange={(categoryId) =>
                setDraft((current) => (current ? { ...current, categoryId } : null))
              }
            >
              {categories.map((category) => (
                <RadioButton.Item
                  key={category.id}
                  label={category.name}
                  value={category.id}
                  testID={`category-${category.name}`}
                  style={styles.radio}
                />
              ))}
            </RadioButton.Group>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDraft(null)}>{t('common.cancel')}</Button>
            <Button onPress={save} disabled={!canSave} testID="product-save">
              {draft?.id === null ? t('products.createConfirm') : t('products.editConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={deleteFor !== null} onDismiss={() => setDeleteFor(null)}>
          <Dialog.Title>{t('products.deleteTitle', { name: deleteFor?.name ?? '' })}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t('products.deleteHint')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteFor(null)}>{t('common.cancel')}</Button>
            <Button onPress={remove} testID="product-delete-confirm">
              {t('products.deleteConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={resetOpen} onDismiss={() => setResetOpen(false)}>
          <Dialog.Title>{t('products.resetTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t('products.resetHint')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setResetOpen(false)}>{t('common.cancel')}</Button>
            <Button onPress={reset} testID="catalog-reset-confirm">
              {t('products.resetConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={message !== null}
        onDismiss={() => setMessage(null)}
        duration={4000}
        testID="products-snackbar"
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
  search: {
    margin: 12,
  },
  // Seitenrand der Gruppenflaechen - wie im Vorrat (ADR-049).
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    // Platz, damit der letzte Eintrag nicht unter dem FAB verschwindet.
    paddingBottom: 96,
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
  dialogScroll: {
    paddingHorizontal: 24,
  },
  categoryLabel: {
    paddingTop: 8,
  },
  radio: {
    minHeight: 48,
    paddingVertical: 0,
  },
});
