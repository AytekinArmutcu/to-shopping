import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type TextInput as NativeTextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Icon, List, TextInput, useTheme } from 'react-native-paper';

import { SESSION_START } from '@/features/suggestions/clock';
import { rankSuggestions, type ProductStats } from '@/features/suggestions/logic';

import { cleanProductName, type CatalogProduct } from '../logic';

type Props = {
  products: CatalogProduct[];
  productIdsOnList: string[];
  /** Kaufhistorie je Produkt - die Grundlage der Reihenfolge (FR-5.2). */
  stats: ProductStats[];
  /** Produkte, die gerade im Vorrat liegen (FR-9.5) - nur als Hinweis. */
  pantryProductIds?: string[];
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
export function AddItemBar({
  products,
  productIdsOnList,
  stats,
  pantryProductIds = [],
  onPickProduct,
  onCreateProduct,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const input = useRef<NativeTextInput>(null);

  const { suggestions, canCreate } = useMemo(
    () => rankSuggestions(query, products, stats, productIdsOnList, SESSION_START),
    [query, products, stats, productIdsOnList],
  );

  // Vorrat ist nur ein Hinweis, kein Filter (ADR-043): Nichts wird
  // ausgeblendet oder umsortiert. Wer mehr kaufen will, soll das koennen,
  // ohne mit der App zu streiten.
  const pantrySet = useMemo(() => new Set(pantryProductIds), [pantryProductIds]);

  const trimmed = cleanProductName(query);

  // Seit M10 erscheinen Vorschlaege auch bei leerem Feld - aber nur, solange
  // das Feld den Fokus hat (T-10.4). Ohne die Fokus-Bedingung stuende das
  // Feld dauerhaft offen und verdeckte die halbe Liste.
  //
  // "oder es steht Text im Feld" haelt die Vorschlaege waehrend des Tippens
  // offen, falls der Fokus kurz woanders hinspringt.
  const showPanel = (focused || trimmed.length > 0) && (suggestions.length > 0 || canCreate);

  function pick(product: CatalogProduct) {
    onPickProduct(product);
    setQuery('');
  }

  function create() {
    onCreateProduct(trimmed);
    setQuery('');
  }

  return (
    // Kein Rand nach oben mehr: Die Pille hebt sich selbst ab ("Flaechen statt
    // Linien", ADR-049). Der alte Rand war ausserdem ein fester Farbwert, der
    // im Dunkelmodus nicht zu sehen war.
    <View style={{ backgroundColor: theme.colors.surface }}>
      {showPanel ? (
        <>
          <ScrollView style={styles.panel} keyboardShouldPersistTaps="handled" testID="suggestions">
            {suggestions.map(({ product }) => (
              <List.Item
                key={product.id}
                title={product.name}
                description={pantrySet.has(product.id) ? t('add.inPantry') : undefined}
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
        </>
      ) : null}

      {/* Das Feld als runde Pille mit Plus davor (ADR-049): Es soll nach
          "hier kommt etwas dazu" aussehen, nicht nach einem Formular. Die
          Pille ist eine eigene Flaeche, das Paper-Feld darin traegt dieselbe
          Farbe und keine Unterstreichung - so bleiben Platzhalter, Cursor und
          Verhalten von Paper, nur die Form ist neu.

          Ein Tipp auf das Plus oder den Rand der Pille setzt den Fokus ins
          Feld. accessible={false}, damit der Screenreader nicht zwei Ziele
          fuer dasselbe meldet - das Feld selbst ist ansprechbar. */}
      <View style={styles.pillRow}>
        <Pressable
          accessible={false}
          onPress={() => input.current?.focus()}
          style={[styles.pill, { backgroundColor: theme.colors.elevation.level2 }]}
        >
          <Icon source="plus" size={24} color={theme.colors.onSurfaceVariant} />
          <TextInput
            ref={input}
            mode="flat"
            value={query}
            onChangeText={setQuery}
            placeholder={t('add.placeholder')}
            accessibilityLabel={t('add.label')}
            testID="add-input"
            autoCorrect={false}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            returnKeyType="done"
            onSubmitEditing={() => {
              const first = suggestions[0];
              if (first) {
                pick(first.product);
              } else if (canCreate) {
                create();
              }
            }}
            style={[styles.input, { backgroundColor: theme.colors.elevation.level2 }]}
            contentStyle={styles.inputContent}
            underlineStyle={styles.noUnderline}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pillRow: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingLeft: 16,
    paddingRight: 8,
    overflow: 'hidden',
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
    flex: 1,
    minHeight: 56,
  },
  inputContent: {
    paddingLeft: 8,
  },
  // Die Pille ist die Form, eine Unterstreichung darunter waere doppelt.
  noUnderline: {
    display: 'none',
  },
});
