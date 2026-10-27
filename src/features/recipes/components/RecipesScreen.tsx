import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Button,
  Dialog,
  FAB,
  IconButton,
  List,
  Menu,
  Portal,
  Snackbar,
  Text,
  useTheme,
} from 'react-native-paper';

import { stapleProductIdsQuery } from '@/features/catalog/repository';
import { listItemsQuery } from '@/features/items/repository';
import { getOrCreateActiveList } from '@/features/lists/repository';
import { pantryQuery } from '@/features/pantry/repository';
import type { TargetItem } from '@/features/templates/logic';
import { goTo } from '@/lib/navigation';

import {
  buildRecipeOverview,
  MISSING_NAMES_LIMIT,
  planWeeklyShopping,
  type RecipeIngredient,
  type RecipeOverviewRow,
} from '../logic';
import {
  addRecipeMissingToList,
  clearWeeklyPlan,
  recipeItemsQuery,
  recipesQuery,
  resetRecipes,
  setInWeeklyPlan,
  weeklyPlanQuery,
} from '../repository';

/** Routenparameter fuer "neues Gericht anlegen" - RecipeScreen beginnt dann im Bearbeitungsmodus. */
export const NEW_RECIPE_ID = 'neu';

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
 */
export function RecipesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  const recipeRows = useLiveQuery(recipesQuery());
  const itemRows = useLiveQuery(recipeItemsQuery());
  const pantryRows = useLiveQuery(pantryQuery());
  const planRows = useLiveQuery(weeklyPlanQuery());
  const stapleRows = useLiveQuery(stapleProductIdsQuery());
  const targets = useActiveListTargets();

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

  const missingText = (row: RecipeOverviewRow) =>
    row.missingCount === 0
      ? t('recipes.allThere')
      : t('recipes.missing', { count: row.missingCount });

  const missingDescription = (row: RecipeOverviewRow) => {
    if (row.missingCount === 0) {
      return t('recipes.allThere');
    }
    const joined = row.missingNames.join(', ');
    const names =
      row.missingCount > MISSING_NAMES_LIMIT ? t('recipes.moreNames', { names: joined }) : joined;
    return t('recipes.missingWith', { count: row.missingCount, names });
  };

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
              <List.Item
                key={row.id}
                title={row.name}
                testID={`week-${row.name}`}
                style={styles.row}
                right={() => (
                  <View style={styles.right}>
                    <Text
                      variant="bodyMedium"
                      style={{
                        color:
                          row.missingCount === 0
                            ? theme.colors.primary
                            : theme.colors.onSurfaceVariant,
                      }}
                    >
                      {missingText(row)}
                    </Text>
                    <IconButton
                      icon="close"
                      onPress={() => void setInWeeklyPlan(row.id, false)}
                      accessibilityLabel={t('recipes.removeFromWeek', { name: row.name })}
                      testID={`week-remove-${row.name}`}
                      style={styles.iconButton}
                    />
                  </View>
                )}
              />
            ))}
            <View style={styles.weekActions}>
              <Button
                mode="outlined"
                icon="cart-plus"
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
        data={rows}
        keyExtractor={(row) => row.id}
        testID="recipes-list"
        ListHeaderComponent={header}
        contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.listContent}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={missingDescription(item)}
            descriptionStyle={item.missingCount === 0 ? { color: theme.colors.primary } : undefined}
            onPress={() => openRecipe(item.id)}
            testID={`recipe-${item.name}`}
            style={styles.row}
            right={() =>
              item.inPlan ? (
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
              )
            }
          />
        )}
        ListEmptyComponent={
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
        }
      />

      <FAB
        icon="plus"
        label={t('recipes.create')}
        accessibilityLabel={t('recipes.create')}
        onPress={() => router.push({ pathname: '/rezept', params: { recipeId: NEW_RECIPE_ID } })}
        testID="recipe-create"
        style={styles.fab}
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
  row: {
    minHeight: 56,
    justifyContent: 'center',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
  },
});
