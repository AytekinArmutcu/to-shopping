import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Button,
  Chip,
  Dialog,
  FAB,
  IconButton,
  Menu,
  Portal,
  Snackbar,
  Text,
  TouchableRipple,
} from 'react-native-paper';

import { catalogProductsQuery, stapleProductIdsQuery } from '@/features/catalog/repository';
import { listItemsQuery } from '@/features/items/repository';
import { getOrCreateActiveList } from '@/features/lists/repository';
import { pantryQuery } from '@/features/pantry/repository';
import type { TargetItem } from '@/features/templates/logic';
import { goTo } from '@/lib/navigation';
import { useAppTheme } from '@/theme';

import {
  buildRecipeOverview,
  filterRecipeOverview,
  formatWithParam,
  type IngredientMatchRow,
  MISSING_NAMES_LIMIT,
  parseWithParam,
  planWeeklyShopping,
  RECIPE_FILTERS,
  type RecipeFilter,
  type RecipeIngredient,
  type RecipeOverviewRow,
  rankRecipesByIngredients,
} from '../logic';
import {
  addRecipeMissingToList,
  clearWeeklyPlan,
  getRecipeFilter,
  recipeItemsQuery,
  recipesQuery,
  resetRecipes,
  setInWeeklyPlan,
  setRecipeFilter,
  weeklyPlanQuery,
} from '../repository';

/** Routenparameter fuer "neues Gericht anlegen" - RecipeScreen beginnt dann im Bearbeitungsmodus. */
export const NEW_RECIPE_ID = 'neu';

/**
 * Ein Paper-Chip ist 32 dp hoch. minHeight macht die Flaeche 48 dp hoch, der
 * tippbare Teil darin bleibt aber so hoch wie sein Inhalt und sitzt in der
 * Mitte. hitSlop verlaengert ihn um je 8 dp nach oben und unten - auf
 * genau die 48 dp der Flaeche (CLAUDE.md).
 */
const CHIP_HIT_SLOP = { top: 8, bottom: 8 };

/** Beschriftung je Filter-Chip (de.json, recipes.*). */
const FILTER_LABEL_KEYS: Record<RecipeFilter, string> = {
  all: 'recipes.filterAll',
  allThere: 'recipes.filterAllThere',
  almost: 'recipes.filterAlmost',
};

/**
 * Das Schild "Alles da" / "n fehlen" (M18, ADR-049 Punkt 3).
 *
 * Gruen heisst kochen koennen, Orange (tertiary) heisst einkaufen muessen -
 * beides als Container-Paar, damit der Kontrast aus dem Theme kommt. Keine
 * Kategoriefarben: Bei Rezepten ist die Frage "alles da?" (ADR-049 Punkt 4).
 *
 * Auch von RecipeScreen benutzt, damit Uebersicht und Gericht gleich aussehen.
 */
export function RecipeBadge({ missingCount, testID }: { missingCount: number; testID?: string }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const allThere = missingCount === 0;
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: allThere
            ? theme.colors.primaryContainer
            : theme.colors.tertiaryContainer,
        },
      ]}
    >
      <Text
        variant="labelMedium"
        testID={testID}
        style={{
          color: allThere ? theme.colors.onPrimaryContainer : theme.colors.onTertiaryContainer,
        }}
      >
        {allThere ? t('recipes.allThere') : t('recipes.missing', { count: missingCount })}
      </Text>
    </View>
  );
}

type Props = {
  /**
   * Routenparameter "with" (ADR-048): kommagetrennte Produkt-IDs aus der
   * Zutaten-Auswahl, roh, wie Expo Router ihn liefert.
   */
  withParam?: string | string[];
};

/**
 * Die Artikel der aktiven Liste als Vergleichsgrundlage fuer "steht schon
 * drauf" (FR-10.5).
 *
 * Aktiv ist die zuletzt geoeffnete Liste - dieselbe, auf die "Fehlendes auf
 * die Liste" schreibt (getOrCreateActiveList). Sie wird bei jedem Fokus neu
 * bestimmt: Wer zwischendurch eine andere Liste geoeffnet hat, soll hier deren
 * Stand sehen. Die Artikel selbst kommen live (ADR-027), damit ein Hinzufuegen
 * sofort im Zaehler steht.
 *
 * Auch von RecipeScreen benutzt - beide Screens muessen dieselbe Liste meinen.
 */
export function useActiveListTargets(): TargetItem[] {
  const [listId, setListId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getOrCreateActiveList().then((list) => {
        if (!cancelled) {
          setListId(list?.id ?? null);
        }
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Ohne ID eine Abfrage, die nichts findet: useLiveQuery laesst sich nicht
  // bedingt aufrufen (Hook-Regeln).
  const items = useLiveQuery(listItemsQuery(listId ?? ''), [listId]);

  return useMemo(
    () =>
      (items.data ?? []).map(({ productId, name, isChecked }) => ({
        productId,
        name,
        isChecked,
      })),
    [items.data],
  );
}

/**
 * Die Rezeptuebersicht (FR-10.3, FR-10.6, T-14.5, PRD Flow 9).
 *
 * Oben der Wochenplan, darunter alle Gerichte, "Alles da" zuerst. Beides in
 * einer FlatList: Der Wochenplan ist ihr Kopf und scrollt mit. Ein fest
 * stehender Kopf wuerde bei fuenf geplanten Gerichten die halbe Liste
 * verdecken.
 *
 * Gebaut wie der Vorrat (Appbar, Snackbar, busy-Sperre) und die Listen-
 * uebersicht (FAB fuer "Neu").
 *
 * Ueber den Gerichten stehen die Filter (ADR-048, FR-10.11, FR-10.12): drei
 * gemerkte Chips nach Vorrat und der Zutatenfilter, der als Routenparameter
 * reist. Der Wochenplan bleibt ungefiltert - er ist Auswahl, kein
 * Suchergebnis.
 */
export function RecipesScreen({ withParam }: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();

  const recipeRows = useLiveQuery(recipesQuery());
  const itemRows = useLiveQuery(recipeItemsQuery());
  const pantryRows = useLiveQuery(pantryQuery());
  const planRows = useLiveQuery(weeklyPlanQuery());
  const stapleRows = useLiveQuery(stapleProductIdsQuery());
  const catalog = useLiveQuery(catalogProductsQuery());
  const targets = useActiveListTargets();

  // Gemerkter Filter (app_state, ADR-020). Bis er geladen ist, gilt "Alle".
  // Tippt jemand schneller, als die Datenbank antwortet, gewinnt der Tipp.
  const [filter, setFilter] = useState<RecipeFilter>('all');
  const filterTouched = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void getRecipeFilter().then((stored) => {
      if (!cancelled && !filterTouched.current) {
        setFilter(stored);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const chooseFilter = useCallback((next: RecipeFilter) => {
    filterTouched.current = true;
    setFilter(next);
    void setRecipeFilter(next);
  }, []);

  const withIds = useMemo(() => parseWithParam(withParam), [withParam]);

  // Namen in Auswahlreihenfolge; ein inzwischen geloeschtes Produkt faellt weg.
  const withNames = useMemo(() => {
    const nameById = new Map((catalog.data ?? []).map((product) => [product.id, product.name]));
    return withIds.flatMap((id) => {
      const name = nameById.get(id);
      return name === undefined ? [] : [name];
    });
  }, [catalog.data, withIds]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const itemsByRecipe = useMemo(() => {
    const map = new Map<string, RecipeIngredient[]>();
    for (const row of itemRows.data ?? []) {
      const list = map.get(row.recipeId);
      if (list) {
        list.push(row);
      } else {
        map.set(row.recipeId, [row]);
      }
    }
    return map;
  }, [itemRows.data]);

  const pantryIds = useMemo(
    () => (pantryRows.data ?? []).map((row) => row.productId),
    [pantryRows.data],
  );

  // Grundvorrat fehlt nie und geht nie automatisch auf die Liste (ADR-047).
  const stapleIds = useMemo(() => (stapleRows.data ?? []).map((row) => row.id), [stapleRows.data]);

  const rows = useMemo(
    () =>
      buildRecipeOverview(
        recipeRows.data ?? [],
        itemsByRecipe,
        pantryIds,
        (planRows.data ?? []).map((row) => row.recipeId),
        stapleIds,
      ),
    [recipeRows.data, itemsByRecipe, pantryIds, planRows.data, stapleIds],
  );

  const weekRows = useMemo(() => rows.filter((row) => row.inPlan), [rows]);

  const visibleRows = useMemo(
    () => rankRecipesByIngredients(filterRecipeOverview(rows, filter), itemsByRecipe, withIds),
    [rows, filter, itemsByRecipe, withIds],
  );

  const weekPlan = useMemo(
    () =>
      planWeeklyShopping(
        weekRows.map((row) => itemsByRecipe.get(row.id) ?? []),
        pantryIds,
        targets,
        stapleIds,
      ),
    [weekRows, itemsByRecipe, pantryIds, targets, stapleIds],
  );
  const weekCount = weekPlan.productIds.length;

  const openRecipe = useCallback((recipeId: string) => {
    router.push({ pathname: '/rezept', params: { recipeId } });
  }, []);

  const addWeekMissing = useCallback(() => {
    if (busy || weekPlan.productIds.length === 0) {
      return;
    }
    setBusy(true);

    const { productIds, unresolvedNames } = weekPlan;
    const run = async () => {
      const target = await getOrCreateActiveList();
      if (!target) {
        return;
      }
      const added = await addRecipeMissingToList(target.id, productIds);
      const main = added === 0 ? t('recipes.addedNone') : t('recipes.added', { count: added });
      setMessage(
        unresolvedNames.length === 0
          ? main
          : t('recipes.withUnresolved', {
              message: main,
              unresolved: t('recipes.unresolved', { count: unresolvedNames.length }),
            }),
      );
    };

    void run().finally(() => setBusy(false));
  }, [busy, weekPlan, t]);

  const reset = useCallback(() => {
    setResetOpen(false);
    if (busy) {
      return;
    }
    setBusy(true);
    void resetRecipes()
      .then(({ restored }) => setMessage(t('recipes.resetDone', { count: restored })))
      .finally(() => setBusy(false));
  }, [busy, t]);

  const missingDescription = (row: RecipeOverviewRow) => {
    if (row.missingCount === 0) {
      return t('recipes.allThere');
    }
    const joined = row.missingNames.join(', ');
    const names =
      row.missingCount > MISSING_NAMES_LIMIT ? t('recipes.moreNames', { names: joined }) : joined;
    return t('recipes.missingWith', { count: row.missingCount, names });
  };

  // Mit Zutatenfilter steht vorne, welche der gewaehlten Zutaten das Gericht
  // verwendet - das ist der Grund, warum es in der Liste steht.
  // Ohne Zutatenfilter und mit allem da sagt das Schild schon alles: keine
  // zweite Zeile, die nur "Alles da" wiederholt.
  const rowDescription = (row: IngredientMatchRow): string | null => {
    if (withIds.length === 0) {
      return row.missingCount === 0 ? null : missingDescription(row);
    }
    return `${t('recipes.usesNames', { names: row.matchNames.join(', ') })} · ${missingDescription(row)}`;
  };

  const withLabel = t('recipes.filterWith', { names: withNames.join(', ') });

  // Vorwaerts in die Auswahl (ADR-036) - deshalb push. Die aktuelle Auswahl
  // reist mit, damit sie sich aendern laesst statt neu begonnen zu werden.
  const openPicker = useCallback(() => {
    router.push({ pathname: '/rezepte-zutaten', params: { with: formatWithParam(withIds) } });
  }, [withIds]);

  // Zeile 1 scrollt waagerecht und haelt immer dieselben vier Chips. Der
  // aktive Zutatenfilter steht darunter in einer eigenen, festen Zeile: In
  // der scrollenden lag er auf schmalen Bildschirmen ausserhalb des
  // sichtbaren Teils, und der Zeile sieht man nicht an, dass sie scrollt.
  const filterChips = (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        testID="recipes-filters"
      >
        {RECIPE_FILTERS.map((option) => (
          <Chip
            key={option}
            selected={filter === option}
            showSelectedOverlay
            onPress={() => chooseFilter(option)}
            accessibilityLabel={t(FILTER_LABEL_KEYS[option])}
            testID={`recipes-filter-${option}`}
            style={styles.chip}
            hitSlop={CHIP_HIT_SLOP}
          >
            {t(FILTER_LABEL_KEYS[option])}
          </Chip>
        ))}
        {/* Bleibt auch bei aktivem Zutatenfilter: Tipp oeffnet die Auswahl zum Aendern. */}
        <Chip
          icon="basket-outline"
          onPress={openPicker}
          accessibilityLabel={t('recipes.filterPick')}
          testID="recipes-filter-pick"
          style={styles.chip}
          hitSlop={CHIP_HIT_SLOP}
        >
          {t('recipes.filterPick')}
        </Chip>
      </ScrollView>
      {withIds.length > 0 ? (
        <View style={styles.withFilter}>
          {/* Kein Kreuz im Chip - Paper zeichnet es kleiner als 48 dp;
            Aufheben ist der Knopf daneben. Lange Namen enden mit "…"
            (Paper setzt am Chip-Text numberOfLines 1). */}
          <Chip
            selected
            showSelectedOverlay
            onPress={openPicker}
            ellipsizeMode="tail"
            accessibilityLabel={withLabel}
            testID="recipes-filter-with"
            style={[styles.chip, styles.withChip]}
            hitSlop={CHIP_HIT_SLOP}
          >
            {withLabel}
          </Chip>
          <IconButton
            icon="close"
            // Entfernt den Parameter an der vorhandenen Route - kein neuer Screen.
            onPress={() => router.setParams({ with: undefined })}
            accessibilityLabel={t('recipes.filterClear')}
            testID="recipes-filter-clear"
            style={styles.iconButton}
          />
        </View>
      ) : null}
    </View>
  );

  const header =
    rows.length === 0 ? null : (
      <View>
        {weekRows.length > 0 ? (
          <View testID="recipes-week">
            <Text
              variant="titleSmall"
              style={[styles.sectionHeader, { color: theme.colors.primary }]}
            >
              {t('recipes.weekTitle')}
            </Text>
            {weekRows.map((row) => (
              <View
                key={row.id}
                testID={`week-${row.name}`}
                style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}
              >
                <View style={styles.cardRow}>
                  <View style={styles.cardBody}>
                    <View style={styles.cardTitleRow}>
                      {/* Wochenplan-Markierung (ADR-049 Punkt 3), nur Anzeige. */}
                      <View
                        importantForAccessibility="no"
                        style={[styles.weekDot, { backgroundColor: theme.colors.tertiary }]}
                      />
                      <Text variant="titleMedium" style={styles.cardTitle}>
                        {row.name}
                      </Text>
                      <RecipeBadge missingCount={row.missingCount} />
                    </View>
                  </View>
                  <IconButton
                    icon="close"
                    onPress={() => void setInWeeklyPlan(row.id, false)}
                    accessibilityLabel={t('recipes.removeFromWeek', { name: row.name })}
                    testID={`week-remove-${row.name}`}
                    style={styles.iconButton}
                  />
                </View>
              </View>
            ))}
            <View style={styles.weekActions}>
              <Button
                mode="contained"
                icon="cart-plus"
                buttonColor={theme.colors.tertiary}
                textColor={theme.colors.onTertiary}
                disabled={weekCount === 0 || busy}
                onPress={addWeekMissing}
                testID="week-add-missing"
                style={styles.weekAdd}
              >
                {t('recipes.weekAddMissing', { count: weekCount })}
              </Button>
              <Button onPress={() => void clearWeeklyPlan()} testID="week-clear">
                {t('recipes.weekClear')}
              </Button>
            </View>
          </View>
        ) : null}

        <Text variant="titleSmall" style={[styles.sectionHeader, { color: theme.colors.primary }]}>
          {t('recipes.allTitle')}
        </Text>
        {filterChips}
      </View>
    );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        {/* Benanntes Ziel statt router.back() (ADR-036). */}
        <Appbar.BackAction
          onPress={() => goTo('/listen')}
          accessibilityLabel={t('recipes.back')}
          testID="recipes-back"
        />
        <Appbar.Content title={t('recipes.title')} />
        <Menu
          visible={menuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={
            <Appbar.Action
              icon="dots-vertical"
              onPress={() => setMenuOpen(true)}
              accessibilityLabel={t('recipes.menu')}
              testID="recipes-menu"
            />
          }
        >
          <Menu.Item
            leadingIcon="restore"
            title={t('recipes.reset')}
            testID="recipes-reset"
            onPress={() => {
              setMenuOpen(false);
              setResetOpen(true);
            }}
          />
        </Menu>
      </Appbar.Header>

      <FlatList
        data={visibleRows}
        keyExtractor={(row) => row.id}
        testID="recipes-list"
        ListHeaderComponent={header}
        contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.listContent}
        renderItem={({ item }) => {
          const description = rowDescription(item);
          return (
            // Die Karte ist die Tippflaeche wie vorher List.Item: Name, Schild
            // und Beschreibung liegen darin (E2E sucht sie per childOf).
            <View
              style={[
                styles.card,
                styles.cardClip,
                { backgroundColor: theme.colors.elevation.level1 },
              ]}
            >
              <TouchableRipple
                onPress={() => openRecipe(item.id)}
                testID={`recipe-${item.name}`}
                accessibilityRole="button"
              >
                <View style={styles.cardRow}>
                  <View style={styles.cardBody}>
                    <View style={styles.cardTitleRow}>
                      <Text variant="titleMedium" style={styles.cardTitle}>
                        {item.name}
                      </Text>
                      <RecipeBadge missingCount={item.missingCount} />
                    </View>
                    {description === null ? null : (
                      <Text
                        variant="bodySmall"
                        style={[styles.cardDescription, { color: theme.colors.onSurfaceVariant }]}
                      >
                        {description}
                      </Text>
                    )}
                  </View>
                  {item.inPlan ? (
                    <IconButton
                      icon="check"
                      onPress={() => void setInWeeklyPlan(item.id, false)}
                      accessibilityLabel={t('recipes.removeFromWeek', { name: item.name })}
                      testID={`plan-toggle-${item.name}`}
                      style={styles.iconButton}
                    />
                  ) : (
                    <IconButton
                      icon="plus"
                      onPress={() => void setInWeeklyPlan(item.id, true)}
                      accessibilityLabel={t('recipes.addToWeek', { name: item.name })}
                      testID={`week-add-${item.name}`}
                      style={styles.iconButton}
                    />
                  )}
                </View>
              </TouchableRipple>
            </View>
          );
        }}
        ListEmptyComponent={
          rows.length === 0 ? (
            <View style={styles.empty} testID="recipes-empty">
              <Text variant="titleMedium" style={styles.emptyText}>
                {t('recipes.empty')}
              </Text>
              <Text
                variant="bodyMedium"
                style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
              >
                {t('recipes.emptyHint')}
              </Text>
            </View>
          ) : (
            // Es gibt Gerichte, nur passt keins: meist ein Vorrat ohne Haken
            // (ADR-048). Erklaerung und Weg dorthin statt leerer Flaeche.
            <View style={[styles.empty, styles.filterEmpty]} testID="recipes-filter-empty">
              <Text variant="bodyMedium" style={styles.emptyText}>
                {t('recipes.filterEmpty')}
              </Text>
              <Button
                mode="outlined"
                onPress={() => router.push('/vorrat')}
                testID="recipes-open-pantry"
                style={styles.emptyAction}
              >
                {t('recipes.openPantry')}
              </Button>
            </View>
          )
        }
      />

      <FAB
        icon="plus"
        label={t('recipes.create')}
        accessibilityLabel={t('recipes.create')}
        onPress={() => router.push({ pathname: '/rezept', params: { recipeId: NEW_RECIPE_ID } })}
        testID="recipe-create"
        // Orange wie jeder "Neu"-Knopf (ADR-049): eine Farbe fuer "hier entsteht
        // etwas", auf allen drei Screens dieselbe.
        color={theme.colors.onTertiaryContainer}
        style={[styles.fab, { backgroundColor: theme.colors.tertiaryContainer }]}
      />

      <Portal>
        <Dialog visible={resetOpen} onDismiss={() => setResetOpen(false)}>
          <Dialog.Title>{t('recipes.resetTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t('recipes.resetHint')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setResetOpen(false)}>{t('common.cancel')}</Button>
            <Button onPress={reset} testID="recipes-reset-confirm">
              {t('recipes.resetConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={message !== null}
        onDismiss={() => setMessage(null)}
        duration={4000}
        testID="recipes-snackbar"
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
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  // Flaechen statt Linien (ADR-049 Punkt 5): 18 dp Rundung, 12 dp innen,
  // 10 dp zwischen den Karten, 12 dp zum Rand.
  card: {
    borderRadius: 18,
    marginHorizontal: 12,
    marginBottom: 10,
  },
  // Schneidet die Welle des Tippens an der Rundung ab.
  cardClip: {
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 12,
    // 48 dp Knopf plus Innenabstand - auch eine Karte ohne Beschreibung bleibt gross genug.
    minHeight: 72,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
  },
  cardDescription: {
    flexShrink: 1,
  },
  weekDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  badge: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  iconButton: {
    margin: 0,
    width: 48,
    height: 48,
  },
  weekActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  weekAdd: {
    flexShrink: 1,
  },
  // Die Zeile ist so hoch wie ihr hoechstes Element (48 dp) plus Rand; der
  // untere Rand trennt sie von der ersten Gerichtszeile.
  filters: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  // 48 dp hoch, Inhalt in der Mitte - dazu CHIP_HIT_SLOP fuer die Tippflaeche.
  chip: {
    minHeight: 48,
    justifyContent: 'center',
  },
  // Zweite Zeile, nicht scrollend, volle Breite - Abstaende wie "filters".
  withFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  // Gibt nach, wenn die Namen nicht passen; der Aufheben-Knopf bleibt ganz.
  withChip: {
    flexShrink: 1,
  },
  listContent: {
    // Platz, damit der letzte Eintrag nicht unter dem FAB verschwindet.
    paddingBottom: 96,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  empty: {
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyText: {
    textAlign: 'center',
  },
  filterEmpty: {
    paddingTop: 24,
  },
  emptyAction: {
    alignSelf: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
  },
});
