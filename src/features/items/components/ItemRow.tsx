import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Checkbox, Divider, Icon, IconButton, Text, useTheme } from 'react-native-paper';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { formatQuantity } from '../logic';

export type ItemRowData = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  isChecked: boolean;
};

type Props = {
  item: ItemRowData;
  unitShort: string;
  onToggle: (id: string, isChecked: boolean) => void;
  onRemove: (id: string) => void;
};

/**
 * Eine Zeile der Einkaufsliste mit Wischgeste (FR-3.1 bis FR-3.4).
 *
 * Zwei gleichwertige Wege zum Abhaken: wischen oder das Kaestchen antippen.
 * Die Antipp-Alternative ist Pflicht - nicht jeder kann oder will wischen
 * (CLAUDE.md, Barrierefreiheit).
 *
 * Die Zeile entfernt sich nicht selbst aus der Liste. Sie meldet nur, dass
 * abgehakt wurde; was danach sichtbar bleibt, entscheidet partitionItems.
 */
export function ItemRow({ item, unitShort, onToggle, onRemove }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const swipeable = useRef<SwipeableMethods>(null);
  const strike = useSharedValue(item.isChecked ? 1 : 0);

  const quantity = formatQuantity(item, unitShort);

  function toggle(next: boolean) {
    // Kurzes Klopfen statt einer langen Vibration: Es soll den Daumen
    // bestaetigen, nicht das Telefon durch den Einkaufswagen schieben.
    void Haptics.impactAsync(
      next ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    );
    strike.value = withTiming(next ? 1 : 0, { duration: 180 });
    onToggle(item.id, next);
  }

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={2}
      leftThreshold={56}
      rightThreshold={56}
      renderLeftActions={(_progress, translation) => (
        <SwipeBackground translation={translation} checked={item.isChecked} align="flex-start" />
      )}
      renderRightActions={(_progress, translation) => (
        <SwipeBackground translation={translation} checked={item.isChecked} align="flex-end" />
      )}
      onSwipeableOpen={() => {
        toggle(!item.isChecked);
        // Zurueckschnappen, damit die Zeile nicht offen stehen bleibt.
        swipeable.current?.close();
      }}
    >
      <View
        style={[styles.row, { backgroundColor: theme.colors.background }]}
        testID={`item-${item.name}`}
      >
        <Checkbox.Android
          status={item.isChecked ? 'checked' : 'unchecked'}
          onPress={() => toggle(!item.isChecked)}
          accessibilityLabel={
            item.isChecked
              ? t('item.uncheck', { name: item.name })
              : t('item.check', { name: item.name })
          }
        />
        <View style={styles.texts}>
          <StrikethroughText
            strike={strike}
            text={item.name}
            color={item.isChecked ? theme.colors.onSurfaceVariant : theme.colors.onSurface}
          />
        </View>
        {quantity ? (
          <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            {quantity}
          </Text>
        ) : null}
        {/* Entfernen bleibt als eigener Knopf erreichbar (FR-2.7). Die
            Wischgeste ist mit dem Abhaken belegt, und ein Artikel, den man
            nur wegwischen kann, waere ohne Alternative fuer alle, die nicht
            wischen koennen. */}
        <IconButton
          icon="close"
          size={20}
          onPress={() => onRemove(item.id)}
          accessibilityLabel={t('item.remove', { name: item.name })}
          style={styles.removeButton}
        />
      </View>
      <Divider />
    </ReanimatedSwipeable>
  );
}

/**
 * Der Text mit der Durchstreich-Animation.
 *
 * Der Strich waechst von links nach rechts, statt einfach zu erscheinen -
 * das ist die Geste mit dem Stift, die sich der Auftraggeber gewuenscht hat.
 * Zusaetzlich wird die Schrift blasser: Erledigtes darf nicht nur durch
 * Farbe erkennbar sein (Barrierefreiheit), aber beides zusammen liest sich
 * eindeutiger als eines allein.
 */
function StrikethroughText({
  strike,
  text,
  color,
}: {
  strike: SharedValue<number>;
  text: string;
  color: string;
}) {
  // Die Breite wird gemessen statt in Prozent angegeben: Eine Prozentbreite
  // bezieht sich auf den umgebenden Container, und der ist so breit wie die
  // ganze Zeile - der Strich lief dadurch bis zum Entfernen-Knopf durch.
  const [textWidth, setTextWidth] = useState(0);

  const lineStyle = useAnimatedStyle(() => ({
    width: strike.value * textWidth,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: 1 - strike.value * 0.4,
  }));

  return (
    <View style={styles.strikeWrapper}>
      <Animated.Text
        style={[styles.name, textStyle, { color }]}
        numberOfLines={2}
        onTextLayout={(event) => {
          const lines = event.nativeEvent.lines;
          const widest = lines.reduce((max, line) => Math.max(max, line.width), 0);
          setTextWidth(widest);
        }}
      >
        {text}
      </Animated.Text>
      <Animated.View style={[styles.strike, lineStyle, { backgroundColor: color }]} />
    </View>
  );
}

/** Farbiger Grund, der beim Wischen unter der Zeile sichtbar wird. */
function SwipeBackground({
  translation,
  checked,
  align,
}: {
  translation: SharedValue<number>;
  checked: boolean;
  align: 'flex-start' | 'flex-end';
}) {
  const theme = useTheme();

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(Math.abs(translation.value) / 56, 1),
  }));

  return (
    <Animated.View
      style={[
        styles.swipeBackground,
        style,
        { backgroundColor: theme.colors.primaryContainer, justifyContent: align },
      ]}
    >
      <Icon
        source={checked ? 'undo-variant' : 'check'}
        size={24}
        color={theme.colors.onPrimaryContainer}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingRight: 4,
    gap: 4,
  },
  texts: {
    flex: 1,
  },
  name: {
    fontSize: 16,
  },
  strikeWrapper: {
    alignSelf: 'flex-start',
  },
  strike: {
    position: 'absolute',
    top: '50%',
    left: 0,
    height: 1.5,
  },
  removeButton: {
    margin: 0,
    width: 48,
    height: 48,
  },
  swipeBackground: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
});
