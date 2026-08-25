import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Divider, List, TextInput, useTheme } from 'react-native-paper';

import { cleanProductName, findSuggestions, type CatalogProduct } from '../logic';

type Props = {
  products: CatalogProduct[];
  productIdsOnList: string[];
  onPickProduct: (product: CatalogProduct) => void;
  onCreateProduct: (name: string) => void;
};

/**
 * Eingabefeld am unteren Bildschirmrand samt Vorschlagsliste (PRD Flow 1.3-1.6).
 *
 * Unten statt oben, weil es mit dem Daumen erreichbar sein muss - das Geraet
 * der Zielgruppe ist ein grosses Telefon, das einhaendig bedient wird.
 *
 * Das Feld behaelt nach der Auswahl den Fokus und leert sich: So lassen sich
 * mehrere Artikel hintereinander eintippen, ohne erneut zu zielen.
 */
export function AddItemBar({ products, productIdsOnList, onPickProduct, onCreateProduct }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const { suggestions, canCreate } = useMemo(
    () => findSuggestions(query, products, productIdsOnList),
    [query, products, productIdsOnList],
  );

  const trimmed = cleanProductName(query);
  const showPanel = trimmed.length > 0;

  function pick(product: CatalogProduct) {
    onPickProduct(product);
    setQuery('');
  }

  function create() {
    onCreateProduct(trimmed);
    setQuery('');
  }

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.colors.surface }]}>
      {showPanel ? (
        <>
          <ScrollView style={styles.panel} keyboardShouldPersistTaps="handled" testID="suggestions">
            {suggestions.map(({ product }) => (
              <List.Item
                key={product.id}
                title={product.name}
                onPress={() => pick(product)}
                accessibilityLabel={t('add.suggestion', { name: product.name })}
                testID={`suggestion-${product.name}`}
                style={styles.suggestion}
              />
            ))}
            {canCreate ? (
              <List.Item
                title={t('add.create', { name: trimmed })}
                description={t('add.createHint')}
                left={(props) => <List.Icon {...props} icon="plus" />}
                onPress={create}
                testID="suggestion-create"
                style={styles.suggestion}
              />
            ) : null}
          </ScrollView>
          <Divider />
        </>
      ) : null}

      <TextInput
        mode="flat"
        value={query}
        onChangeText={setQuery}
        placeholder={t('add.placeholder')}
        accessibilityLabel={t('add.label')}
        testID="add-input"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={() => {
          const first = suggestions[0];
          if (first) {
            pick(first.product);
          } else if (canCreate) {
            create();
          }
        }}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.12)',
  },
  panel: {
    // Bewusst niedrig: Bei offener Tastatur teilen sich Vorschlaege und
    // Artikelliste den Rest des Bildschirms. Mit 280 dp blieb auf einem
    // grossen Telefon keine Zeile der Liste mehr uebrig.
    maxHeight: 200,
  },
  suggestion: {
    minHeight: 48,
    justifyContent: 'center',
  },
  input: {
    minHeight: 56,
  },
});
