import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button, Chip, IconButton, Text, TextInput, useTheme } from 'react-native-paper';

import { UNITS } from '@/db/units';

import { cleanNote, MAX_NOTE_LENGTH, parseQuantity, stepQuantity } from '../logic';

export type ItemDetailData = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  note: string | null;
};

export type ItemDetailChange = {
  quantity: number;
  unit: string;
  note: string | null;
};

type Props = {
  item: ItemDetailData;
  onChange: (id: string, details: ItemDetailChange) => void;
  onClose: () => void;
  /**
   * Notizfeld zeigen (Standard). Rezeptzutaten haben keine Notiz - dort
   * blendet RecipeScreen das Feld aus, statt eine Eingabe anzubieten, die
   * nirgends gespeichert wird.
   */
  showNote?: boolean;
};

/**
 * Die Detailzeile: Menge, Einheit und Notiz eines Artikels (PRD Flow 1.8).
 *
 * Warum unten und nicht als Dialog in der Bildschirmmitte: Der Dialog von
 * Paper haengt im Portal und weiss nichts von der Tastatur - bei zwei
 * Eingabefeldern waere derselbe Fehler zurueck, der auf Android 15 schon
 * einmal das Eingabefeld verdeckt hat. Hier sitzt die Zeile an genau der
 * Stelle, an der sonst das Eingabefeld liegt, und erbt dessen bereits
 * geprueftes Verhalten samt Daumenreichweite (ADR-026).
 *
 * Kein Speichern-Knopf (FR-2.8): Jede Aenderung geht sofort in die Datenbank,
 * "Fertig" schliesst nur. Ein Abbrechen gibt es bewusst nicht - es koennte
 * eine Aenderung stillschweigend verwerfen.
 */
export function ItemDetailBar({ item, onChange, onClose, showNote = true }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  // Das Mengenfeld hat eine feste Breite, damit die Reihe nicht wandert. Sie
  // muss mit der Systemschrift wachsen, sonst schneidet "1500" bei grosser
  // Schrift ab (FR-7.3).
  const { fontScale } = useWindowDimensions();

  // Die Menge braucht einen eigenen Textzustand: Waehrend des Tippens steht
  // dort zwischendurch "1," - das ist keine Zahl, soll das Feld aber auch
  // nicht zuruecksetzen.
  //
  // Beim Wechsel auf einen anderen Artikel setzt der Aufrufer die Komponente
  // ueber key={item.id} neu auf. Das ersetzt einen Effekt, der die Felder
  // nachtraeglich zurueckschreiben muesste - und der waere genau der Effekt,
  // der beim Tippen die Eingabe ueberschreibt.
  const [quantityText, setQuantityText] = useState(formatInput(item.quantity));
  const [note, setNote] = useState(item.note ?? '');

  function apply(next: Partial<ItemDetailChange>) {
    onChange(item.id, {
      quantity: next.quantity ?? item.quantity,
      unit: next.unit ?? item.unit,
      note: next.note !== undefined ? next.note : (item.note ?? null),
    });
  }

  function step(direction: 1 | -1) {
    const value = stepQuantity(item.quantity, item.unit, direction);
    setQuantityText(formatInput(value));
    apply({ quantity: value });
  }

  function editQuantity(text: string) {
    setQuantityText(text);
    const value = parseQuantity(text);
    if (value !== null) {
      apply({ quantity: value });
    }
  }

  return (
    <View
      style={[styles.wrapper, { backgroundColor: theme.colors.surfaceVariant }]}
      testID="item-detail"
    >
      <View style={styles.header}>
        <Text variant="titleMedium" numberOfLines={1} style={styles.name}>
          {item.name}
        </Text>
        <Button onPress={onClose} testID="detail-done">
          {t('detail.done')}
        </Button>
      </View>

      <View style={styles.quantityRow}>
        <IconButton
          icon="minus"
          mode="contained-tonal"
          size={20}
          onPress={() => step(-1)}
          accessibilityLabel={t('detail.decrease')}
          testID="detail-minus"
          style={styles.stepButton}
        />
        <TextInput
          mode="outlined"
          dense
          value={quantityText}
          onChangeText={editQuantity}
          // Beim Verlassen wieder auf den gespeicherten Wert: Was nicht als
          // Menge lesbar war, verschwindet, statt als Vertipper stehen zu
          // bleiben und eine Aenderung vorzutaeuschen.
          onBlur={() => setQuantityText(formatInput(item.quantity))}
          keyboardType="numeric"
          accessibilityLabel={t('detail.quantity')}
          testID="detail-quantity"
          style={[styles.quantityInput, { width: 76 * fontScale }]}
        />
        <IconButton
          icon="plus"
          mode="contained-tonal"
          size={20}
          onPress={() => step(1)}
          accessibilityLabel={t('detail.increase')}
          testID="detail-plus"
          style={styles.stepButton}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.units}
          testID="detail-units"
        >
          {UNITS.map((unit) => (
            <Chip
              key={unit}
              selected={item.unit === unit}
              showSelectedCheck={false}
              onPress={() => apply({ unit })}
              accessibilityLabel={t(`units.${unit}.other`)}
              testID={`unit-${unit}`}
              style={styles.chip}
              hitSlop={CHIP_HIT_SLOP}
            >
              {t(`units.${unit}.short`)}
            </Chip>
          ))}
        </ScrollView>
      </View>

      {showNote ? (
        <TextInput
          mode="outlined"
          dense
          value={note}
          // Bewusst bei jedem Buchstaben und nicht erst beim Verlassen des
          // Feldes: "Fertig" nimmt der Zeile den Fokus nicht ab, sie
          // verschwindet einfach - eine Notiz, die erst beim Verlassen
          // gespeichert wird, waere damit still verloren.
          onChangeText={(text) => {
            setNote(text);
            apply({ note: cleanNote(text) });
          }}
          placeholder={t('detail.notePlaceholder')}
          accessibilityLabel={t('detail.note')}
          maxLength={MAX_NOTE_LENGTH}
          testID="detail-note"
          style={styles.note}
        />
      ) : null}
    </View>
  );
}

/**
 * Ein Paper-Chip ist 32 dp hoch. minHeight macht die Flaeche 48 dp hoch, der
 * tippbare Teil darin bleibt aber so hoch wie sein Inhalt und sitzt in der
 * Mitte. hitSlop verlaengert ihn um je 8 dp nach oben und unten - auf
 * genau die 48 dp der Flaeche (CLAUDE.md).
 */
const CHIP_HIT_SLOP = { top: 8, bottom: 8 };

/** Zahl fuer das Eingabefeld: deutsches Komma, keine unnoetige Null. */
function formatInput(value: number): string {
  return String(value).replace('.', ',');
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.12)',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  name: {
    flex: 1,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepButton: {
    margin: 0,
    width: 48,
    height: 48,
  },
  quantityInput: {
    textAlign: 'center',
  },
  units: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  // 48 dp hoch, Inhalt in der Mitte - dazu CHIP_HIT_SLOP fuer die Tippflaeche.
  chip: {
    minHeight: 48,
    justifyContent: 'center',
  },
  note: {
    minHeight: 48,
  },
});
