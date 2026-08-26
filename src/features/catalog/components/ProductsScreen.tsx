import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Button,
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
  useTheme,
} from 'react-native-paper';

import { useKeyboardHeight } from '@/lib/useKeyboardHeight';

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
  updateProduct,
} from '../repository';

type Draft = {
  /** null heisst: neues Produkt. */
  id: string | null;
  name: string;
  categoryId: string;
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
  const theme = useTheme();
  const keyboardHeight = useKeyboardHeight();

  const catalog = useLiveQuery(catalogProductsQuery());
  const categoryRows = useLiveQuery(categoriesQuery());

  const [query, setQuery] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleteFor, setDeleteFor] = useState<CatalogProduct | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const products: CatalogProduct[] = useMemo(() => catalog.data ?? [], [catalog.data]);
  const categories = useMemo(() => categoryRows.data ?? [], [categoryRows.data]);

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

    const { id, name, categoryId } = draft;
    setDraft(null);

    if (id === null) {
      void createProduct(name, categoryId);
    } else {
      void updateProduct(id, name, categoryId);
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
        testID="products-search"
        style={styles.search}
      />

      <SectionList
        sections={sections}
        keyExtractor={(product) => product.id}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled
        contentContainerStyle={styles.listContent}
        testID="products-list"
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
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            onPress={() =>
              setDraft({
                id: item.id,
                name: item.name,
                categoryId: item.categoryId ?? FALLBACK_CATEGORY_ID,
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
        )}
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
        onPress={() => setDraft({ id: null, name: query, categoryId: FALLBACK_CATEGORY_ID })}
        testID="product-create"
        style={styles.fab}
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
  listContent: {
    paddingBottom: 96,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
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
