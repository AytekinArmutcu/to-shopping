import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Appbar, Button, Divider, Icon, IconButton, Text, useTheme } from 'react-native-paper';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { categoriesQuery } from '@/features/catalog/repository';

import { dropIndex, moveCategory, orderCategories, type CategoryLike } from '../logic';
import { categoryOrderQuery, saveCategoryOrder } from '../repository';

type Props = {
  listId: string;
};

/**
 * Grundhoehe einer Zeile. Das Ziehen rechnet in Zeilen, nicht in Pixeln - ohne
 * einen festen Wert waere jede Zeile anders hoch und der Zielplatz nicht
 * berechenbar. 64 dp liegen ueber den geforderten 48 dp Mindestgroesse.
 *
 * Der Wert waechst mit der Systemschrift (FR-7.3): Bei grosser Schrift wuerde
 * ein Kategoriename in 64 dp abgeschnitten. Weil dieselbe Zahl auch in die
 * Zielplatz-Rechnung geht, bleibt das Ziehen dabei stimmig.
 */
const BASE_ROW_HEIGHT = 64;

/**
 * Das Ladenlayout: die Kategorie-Reihenfolge dieser Liste (FR-1.3, T-5.3).
 *
 * Zwei gleichwertige Wege, wie ueberall in dieser App: ziehen am Griff oder
 * die Pfeile antippen. Die Pfeile sind nicht der Notbehelf - sie sind der
 * verlaessliche Weg, und `CLAUDE.md` verlangt zu jeder Geste eine
 * Antipp-Alternative.
 *
 * Kein neues Paket fuer das Ziehen (ADR-028): gesture-handler und reanimated
 * sind bereits da, und die eigentliche Rechnung steckt in `dropIndex` und
 * `moveCategory` - beide getestet, ohne dass ein Finger noetig waere.
 */
export function StoreLayoutScreen({ listId }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const rowHeight = BASE_ROW_HEIGHT * Math.max(1, fontScale);

  const categoryRows = useLiveQuery(categoriesQuery());
  const orderRows = useLiveQuery(categoryOrderQuery(listId), [listId]);

  // Solange dieser Screen offen ist, fuehrt die oertliche Auswahl. Sie geht
  // sofort in die Datenbank; die Live-Abfrage zieht danach nach. Ohne den
  // Vorrang wuerde die Zeile beim Ziehen einmal zurueckspringen, bevor die
  // Antwort aus der Datenbank eintrifft.
  const [override, setOverride] = useState<string[] | null>(null);

  const categories = useMemo(() => categoryRows.data ?? [], [categoryRows.data]);

  const ordered = useMemo(
    () => orderCategories(categories, orderRows.data ?? []),
    [categories, orderRows.data],
  );

  const order = useMemo(() => override ?? ordered.map((entry) => entry.id), [override, ordered]);

  const byId = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const visible: CategoryLike[] = useMemo(
    () =>
      order
        .map((id) => byId.get(id))
        .filter((category): category is CategoryLike => category !== undefined),
    [order, byId],
  );

  const activeIndex = useSharedValue(-1);
  const offsetY = useSharedValue(0);

  // Geschrieben wird nur hier, gelesen ueberall: Die Zeilen bekommen die
  // beiden Werte zum Lesen und diese drei Worklets zum Aendern. Eine Zeile,
  // die an fremdem Zustand schreibt, waere schwerer nachzuvollziehen - und der
  // Linter verbietet es zu Recht.
  const beginDrag = (index: number) => {
    'worklet';
    activeIndex.value = index;
    offsetY.value = 0;
  };

  const updateDrag = (translationY: number) => {
    'worklet';
    offsetY.value = translationY;
  };

  const endDrag = () => {
    'worklet';
    activeIndex.value = -1;
    offsetY.value = 0;
  };

  const move = useCallback(
    (from: number, to: number) => {
      if (from === to) {
        return;
      }

      const next = moveCategory(order, from, to);
      setOverride(next);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void saveCategoryOrder(listId, next);
    },
    [order, listId],
  );

  const reset = useCallback(() => {
    setOverride(null);
    void saveCategoryOrder(listId, []);
  }, [listId]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => router.back()} accessibilityLabel={t('layout.back')} />
        <Appbar.Content title={t('layout.title')} />
      </Appbar.Header>

      <Text variant="bodyMedium" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
        {t('layout.hint')}
      </Text>

      {/* Kein Wegschneiden unsichtbarer Zeilen. Android macht das in einer
          ScrollView von sich aus, und der zustaendige Manager haengt beim
          Umsortieren Views um - bei zwoelf Zeilen, die beim Zuruecksetzen die
          Plaetze tauschen, endete das in einem Absturz:
          "The specified child already has a parent". Fuer zwoelf Zeilen
          spart das Wegschneiden ohnehin nichts. */}
      <ScrollView testID="layout-list" removeClippedSubviews={false}>
        {visible.map((category, index) => (
          <LayoutRow
            key={category.id}
            category={category}
            index={index}
            count={visible.length}
            rowHeight={rowHeight}
            activeIndex={activeIndex}
            offsetY={offsetY}
            onBeginDrag={beginDrag}
            onUpdateDrag={updateDrag}
            onEndDrag={endDrag}
            onMove={move}
          />
        ))}
      </ScrollView>

      <Divider />
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button icon="backup-restore" onPress={reset} testID="layout-reset">
          {t('layout.reset')}
        </Button>
      </View>
    </View>
  );
}

type RowProps = {
  category: CategoryLike;
  index: number;
  count: number;
  rowHeight: number;
  activeIndex: SharedValue<number>;
  offsetY: SharedValue<number>;
  onBeginDrag: (index: number) => void;
  onUpdateDrag: (translationY: number) => void;
  onEndDrag: () => void;
  onMove: (from: number, to: number) => void;
};

function LayoutRow({
  category,
  index,
  count,
  rowHeight,
  activeIndex,
  offsetY,
  onBeginDrag,
  onUpdateDrag,
  onEndDrag,
  onMove,
}: RowProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const drag = Gesture.Pan()
    // Kurzes Halten, bevor das Ziehen beginnt. Das entscheidet zugleich den
    // Streit mit der ScrollView: Wer sofort losfaehrt, will scrollen; wer
    // einen Moment liegen bleibt, will verschieben. Ohne diese Trennung
    // muessten beide Gesten ueber Referenzen miteinander verdrahtet werden.
    .activateAfterLongPress(200)
    .onStart(() => {
      onBeginDrag(index);
      // Bestaetigt dem Daumen, dass das Ziehen jetzt scharf ist - sonst weiss
      // niemand, wann das Halten lang genug war.
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
    })
    .onUpdate((event) => {
      onUpdateDrag(event.translationY);
    })
    .onEnd(() => {
      runOnJS(onMove)(index, dropIndex(index, offsetY.value, rowHeight, count));
    })
    .onFinalize(() => {
      onEndDrag();
    });

  /**
   * Die gezogene Zeile folgt dem Finger, die uebersprungenen Zeilen weichen um
   * genau eine Zeilenhoehe aus. Erst dadurch sieht man vor dem Loslassen, wo
   * die Kategorie landen wird.
   *
   * Nach oben gehoben wird ueber "elevation" und nicht ueber "zIndex". zIndex
   * laesst React Native die Kind-Views im nativen Container umsortieren, und
   * genau daran ist die App abgestuertzt (siehe removeClippedSubviews oben).
   * elevation hebt die Zeile in der Z-Achse, ohne die Reihenfolge anzufassen -
   * und wirft nebenbei den Schatten, den Material fuer eine aufgenommene
   * Zeile ohnehin vorsieht.
   */
  const rowStyle = useAnimatedStyle(() => {
    const active = activeIndex.value;

    if (active === -1) {
      return { transform: [{ translateY: 0 }], elevation: 0, opacity: 1 };
    }

    if (active === index) {
      return { transform: [{ translateY: offsetY.value }], elevation: 8, opacity: 0.95 };
    }

    const target = dropIndex(active, offsetY.value, rowHeight, count);

    if (active < index && index <= target) {
      return { transform: [{ translateY: -rowHeight }], elevation: 0, opacity: 1 };
    }
    if (target <= index && index < active) {
      return { transform: [{ translateY: rowHeight }], elevation: 0, opacity: 1 };
    }

    return { transform: [{ translateY: 0 }], elevation: 0, opacity: 1 };
  });

  return (
    <Animated.View
      style={[
        styles.row,
        rowStyle,
        { height: rowHeight, backgroundColor: theme.colors.background },
      ]}
      testID={`layout-${category.name}`}
    >
      <Text variant="labelLarge" style={[styles.number, { color: theme.colors.primary }]}>
        {index + 1}
      </Text>
      <Text variant="bodyLarge" numberOfLines={1} style={styles.name}>
        {category.name}
      </Text>

      <IconButton
        icon="arrow-up"
        size={20}
        disabled={index === 0}
        onPress={() => onMove(index, index - 1)}
        accessibilityLabel={t('layout.moveUp', { name: category.name })}
        testID={`up-${category.name}`}
        style={styles.button}
      />
      <IconButton
        icon="arrow-down"
        size={20}
        disabled={index === count - 1}
        onPress={() => onMove(index, index + 1)}
        accessibilityLabel={t('layout.moveDown', { name: category.name })}
        testID={`down-${category.name}`}
        style={styles.button}
      />

      <GestureDetector gesture={drag}>
        <View
          style={styles.handle}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t('layout.drag', { name: category.name })}
          accessibilityValue={{ text: t('layout.position', { position: index + 1, total: count }) }}
        >
          <Icon source="drag-horizontal-variant" size={24} color={theme.colors.onSurfaceVariant} />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hint: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 4,
    gap: 4,
  },
  number: {
    minWidth: 24,
  },
  name: {
    flex: 1,
  },
  button: {
    margin: 0,
    width: 48,
    height: 48,
  },
  handle: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
});
