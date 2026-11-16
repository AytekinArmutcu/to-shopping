import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, FlatList, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Button,
  Dialog,
  HelperText,
  IconButton,
  List,
  Menu,
  Portal,
  Snackbar,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEFAULT_UNIT } from '@/db/units';
import { AddItemBar } from '@/features/catalog/components/AddItemBar';
import type { CatalogProduct } from '@/features/catalog/logic';
import {
  catalogProductsQuery,
  createProduct,
  stapleProductIdsQuery,
} from '@/features/catalog/repository';
import { ItemDetailBar, type ItemDetailChange } from '@/features/items/components/ItemDetailBar';
import { formatQuantity } from '@/features/items/logic';
import { getOrCreateActiveList } from '@/features/lists/repository';
import { pantryQuery } from '@/features/pantry/repository';
import { toProductStats } from '@/features/suggestions/logic';
import { currentStatsQuery } from '@/features/suggestions/repository';
import { MAX_TEMPLATE_NAME_LENGTH } from '@/features/templates/logic';
import { goTo } from '@/lib/navigation';
import { bottomInsetWithKeyboard } from '@/lib/keyboard';
import { useKeyboardHeight } from '@/lib/useKeyboardHeight';

import {
  cleanRecipeName,
  MAX_RECIPE_NOTE_LENGTH,
  MAX_STEP_LENGTH,
  moveStep,
  planRecipeShopping,
  type IngredientStatus,
} from '../logic';
import {
  addRecipeMissingToList,
  createRecipe,
  deleteRecipe,
  recipeItemsOfQuery,
  recipesQuery,
  recipeStepsOfQuery,
  setInWeeklyPlan,
  updateRecipe,
  weeklyPlanQuery,
  type NewIngredient,
} from '../repository';
import { NEW_RECIPE_ID, RecipeBadge, useActiveListTargets } from './RecipesScreen';

type Props = {
  recipeId: string;
};

/** Eine Zutat im Entwurf. key traegt die Zeile durch Hinzufuegen und Entfernen. */
type DraftIngredient = NewIngredient & { key: string };

/**
 * Ein Zubereitungsschritt im Entwurf (ADR-047: nur Text). key traegt die
 * Zeile durch Umsortieren - sonst wanderte beim Pfeil der Fokus samt
 * Tastatur in das falsche Feld.
 */
type DraftStep = { key: string; text: string };

type Draft = {
  name: string;
  note: string;
  items: DraftIngredient[];
  steps: DraftStep[];
};

type StepInput = ComponentRef<typeof TextInput>;

/**
 * Hat sich am Entwurf etwas geaendert? Verglichen wird, was gespeichert
 * wuerde - Name und Notiz wie eingegeben, Zutaten und Schritte in ihrer
 * Reihenfolge.
 */
function sameDraft(a: Draft, b: Draft): boolean {
  return (
    a.name === b.name &&
    a.note === b.note &&
    a.steps.length === b.steps.length &&
    a.steps.every((step, index) => {
      const other = b.steps[index];
      return other !== undefined && step.key === other.key && step.text === other.text;
    }) &&
    a.items.length === b.items.length &&
    a.items.every((item, index) => {
      const other = b.items[index];
      return (
        other !== undefined &&
        item.key === other.key &&
        item.productId === other.productId &&
        item.name === other.name &&
        item.quantity === other.quantity &&
        item.unit === other.unit
      );
    })
  );
}

/**
 * Ein Gericht ansehen und bearbeiten (FR-10.1, FR-10.4, FR-10.5, FR-10.7,
 * T-14.5, PRD Flow 9).
 *
 * Ein Screen fuer beides: Ansehen ist der Normalfall, der Stift schaltet in
 * den Bearbeitungsmodus. recipeId "neu" heisst anlegen - dann beginnt der
 * Screen gleich im Bearbeitungsmodus.
 *
 * Im Ansichtsmodus steht unten derselbe Fussbereich wie beim Vorrat. Im
 * Bearbeitungsmodus steht dort das Eingabefeld der Liste (AddItemBar):
 * Zutaten entstehen mit denselben Vorschlaegen wie Listenartikel (ADR-044).
 *
 * Bearbeitet wird ein Entwurf, gespeichert erst mit dem Haken: Ein Rezept ist
 * ein Ganzes (Name, Notiz, Zutaten, Schritte), und updateRecipe schreibt es in
 * einer Transaktion.
 *
 * Die Zubereitung (FR-10.9, ADR-047) steht unter den Zutaten. Umsortiert wird
 * sie nur mit Pfeilen, ohne Ziehen: ADR-028 nennt die Pfeile gleichwertig, und
 * bei einer Handvoll Schritte reichen sie.
 */
export function RecipeScreen({ recipeId }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();

  const isNew = recipeId === NEW_RECIPE_ID;

  const recipeRows = useLiveQuery(recipesQuery());
  const itemRows = useLiveQuery(recipeItemsOfQuery(recipeId), [recipeId]);
  const stepRows = useLiveQuery(recipeStepsOfQuery(recipeId), [recipeId]);
  const stapleRows = useLiveQuery(stapleProductIdsQuery());
  const pantryRows = useLiveQuery(pantryQuery());
  const planRows = useLiveQuery(weeklyPlanQuery());
  const catalog = useLiveQuery(catalogProductsQuery());
  const historyRows = useLiveQuery(currentStatsQuery());
  const targets = useActiveListTargets();

  const recipe = isNew
    ? null
    : ((recipeRows.data ?? []).find((row) => row.id === recipeId) ?? null);
  const items = useMemo(() => itemRows.data ?? [], [itemRows.data]);
  const steps = useMemo(() => stepRows.data ?? [], [stepRows.data]);
  const inPlan = (planRows.data ?? []).some((row) => row.recipeId === recipeId);

  const pantryIds = useMemo(
    () => (pantryRows.data ?? []).map((row) => row.productId),
    [pantryRows.data],
  );
  const stapleIds = useMemo(() => (stapleRows.data ?? []).map((row) => row.id), [stapleRows.data]);
  const products: CatalogProduct[] = catalog.data ?? [];
  const stats = useMemo(() => toProductStats(historyRows.data ?? []), [historyRows.data]);

  const [editing, setEditing] = useState(isNew);
  const [draftName, setDraftName] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [draftItems, setDraftItems] = useState<DraftIngredient[]>([]);
  const [draftSteps, setDraftSteps] = useState<DraftStep[]>([]);
  const [nameError, setNameError] = useState(false);
  // Stand beim Wechsel in den Bearbeitungsmodus - Grundlage fuer "geaendert?".
  const [baseline, setBaseline] = useState<Draft | null>(null);
  // Die Zutat, deren Menge gerade unten in der Detailzeile steht.
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const nextKey = useRef(0);
  const makeKey = useCallback(() => {
    nextKey.current += 1;
    return `entwurf-${nextKey.current}`;
  }, []);

  const listRef = useRef<FlatList<DraftIngredient>>(null);
  // Die Eingabefelder der Schritte, nach key - fuer den Fokus beim Hinzufuegen.
  const stepInputs = useRef(new Map<string, StepInput>());
  // Der Schritt, der den Fokus bekommen soll, sobald sein Feld da ist.
  const pendingFocus = useRef<string | null>(null);

  /* ---------------------------------------------------------------- *
   * Ansichtsmodus
   * ---------------------------------------------------------------- */

  const plan = useMemo(
    () => planRecipeShopping(items, pantryIds, targets, stapleIds),
    [items, pantryIds, targets, stapleIds],
  );

  const statusById = useMemo(() => {
    const map = new Map<string, IngredientStatus>();
    plan.staple.forEach((item) => map.set(item.id, 'staple'));
    plan.have.forEach((item) => map.set(item.id, 'have'));
    plan.onList.forEach((item) => map.set(item.id, 'onList'));
    plan.missing.forEach((item) => map.set(item.id, 'missing'));
    return map;
  }, [plan]);

  // Was nicht im Vorrat liegt - wie die Zahl in der Uebersicht (FR-10.3).
  // "Alles da" heisst: kochen koennen, nicht "steht auf der Liste".
  // Grundvorrat zaehlt nie mit (ADR-047): Er steht in plan.staple, nicht in
  // onList oder missing.
  const notInPantry = plan.onList.length + plan.missing.length;

  const addableIds = useMemo(
    () => plan.missing.map((item) => item.productId).filter((id): id is string => id !== null),
    [plan.missing],
  );
  const unresolvedCount = plan.missing.length - addableIds.length;

  const addMissing = useCallback(() => {
    if (busy || addableIds.length === 0) {
      return;
    }
    setBusy(true);

    const run = async () => {
      const target = await getOrCreateActiveList();
      if (!target) {
        return;
      }
      const added = await addRecipeMissingToList(target.id, addableIds);
      const main = added === 0 ? t('recipe.addedNone') : t('recipe.added', { count: added });
      setMessage(
        unresolvedCount === 0
          ? main
          : t('recipes.withUnresolved', {
              message: main,
              unresolved: t('recipe.unresolved', { count: unresolvedCount }),
            }),
      );
    };

    void run().finally(() => setBusy(false));
  }, [busy, addableIds, unresolvedCount, t]);

  /* ---------------------------------------------------------------- *
   * Bearbeitungsmodus
   * ---------------------------------------------------------------- */

  const startEditing = useCallback(() => {
    if (!recipe) {
      return;
    }
    const start: Draft = {
      name: recipe.name,
      note: recipe.note ?? '',
      items: items.map((item) => ({
        key: item.id,
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      })),
      steps: steps.map((step) => ({ key: step.id, text: step.text })),
    };
    setDraftName(start.name);
    setDraftNote(start.note);
    setDraftItems(start.items);
    setDraftSteps(start.steps);
    setBaseline(start);
    setEditingKey(null);
    setNameError(false);
    setEditing(true);
  }, [recipe, items, steps]);

  const draftProductIds = useMemo(
    () => draftItems.map((item) => item.productId).filter((id): id is string => id !== null),
    [draftItems],
  );

  // Menge 1 und die Standardeinheit des Produkts - wie beim Setzen auf die
  // Liste (addProductToList). Mengen sind optional (ADR-044).
  const appendProduct = useCallback(
    (product: { id: string; name: string; defaultUnit: string }) => {
      setDraftItems((current) =>
        current.some((item) => item.productId === product.id)
          ? current
          : [
              ...current,
              {
                key: makeKey(),
                productId: product.id,
                name: product.name,
                quantity: 1,
                unit: product.defaultUnit,
              },
            ],
      );
    },
    [makeKey],
  );

  const handleCreate = useCallback(
    (name: string) => {
      void createProduct(name).then((product) => {
        if (product) {
          appendProduct(product);
        } else {
          // Wie ListScreen: Die Eingabe darf nicht verloren gehen - dann eben
          // als Zutat ohne Katalogbezug.
          setDraftItems((current) => [
            ...current,
            { key: makeKey(), productId: null, name, quantity: 1, unit: DEFAULT_UNIT },
          ]);
        }
      });
    },
    [appendProduct, makeKey],
  );

  const removeDraft = useCallback((key: string) => {
    setDraftItems((current) => current.filter((item) => item.key !== key));
    // Die Detailzeile darf keine Zutat zeigen, die es nicht mehr gibt.
    setEditingKey((current) => (current === key ? null : current));
  }, []);

  // Menge und Einheit gehen in den Entwurf, nicht in die Datenbank: Gespeichert
  // wird das Rezept als Ganzes mit dem Haken. Eine Notiz gibt es hier nicht
  // (showNote={false}).
  const handleDetails = useCallback((key: string, details: ItemDetailChange) => {
    setDraftItems((current) =>
      current.map((item) =>
        item.key === key ? { ...item, quantity: details.quantity, unit: details.unit } : item,
      ),
    );
  }, []);

  /*
   * Zubereitungsschritte (FR-10.9). Ein neuer Schritt kommt leer ans Ende und
   * bekommt sofort den Fokus - wer "Schritt hinzufuegen" tippt, will
   * schreiben. Leere Schritte fallen beim Speichern weg (cleanRecipeSteps).
   */
  const addStep = useCallback(() => {
    const key = makeKey();
    pendingFocus.current = key;
    setDraftSteps((current) => [...current, { key, text: '' }]);
  }, [makeKey]);

  const focusIfPending = useCallback((key: string, input: StepInput) => {
    if (pendingFocus.current === key) {
      pendingFocus.current = null;
      input.focus();
    }
  }, []);

  // Das Feld des neuen Schritts gibt es erst nach dem Rendern. Steht es schon
  // da, bekommt es hier den Fokus. Sonst (lange Zutatenliste, die Fusszeile
  // ist noch nicht gerendert) bringt das Scrollen ans Ende sie herein, und
  // der Fokus kommt, sobald das Feld sich anmeldet (registerStepInput).
  useEffect(() => {
    const key = pendingFocus.current;
    if (key === null) {
      return;
    }
    listRef.current?.scrollToEnd({ animated: true });
    const input = stepInputs.current.get(key);
    if (input) {
      focusIfPending(key, input);
    }
  }, [draftSteps, focusIfPending]);

  const registerStepInput = useCallback(
    (key: string, input: StepInput | null) => {
      if (input === null) {
        stepInputs.current.delete(key);
        return;
      }
      stepInputs.current.set(key, input);
      focusIfPending(key, input);
    },
    [focusIfPending],
  );

  const changeStep = useCallback((key: string, text: string) => {
    setDraftSteps((current) =>
      current.map((step) => (step.key === key ? { ...step, text } : step)),
    );
  }, []);

  const shiftStep = useCallback((from: number, to: number) => {
    setDraftSteps((current) => moveStep(current, from, to));
  }, []);

  const removeStep = useCallback((key: string) => {
    setDraftSteps((current) => current.filter((step) => step.key !== key));
  }, []);

  /*
   * Ungespeicherte Aenderungen. Beim Anlegen zaehlt als Aenderung, was
   * eingegeben wurde: ein Name, mindestens eine Zutat oder ein Schritt. Beim
   * Bearbeiten der Vergleich mit dem Stand beim Oeffnen.
   */
  const dirty =
    editing &&
    (isNew
      ? draftName.trim().length > 0 || draftItems.length > 0 || draftSteps.length > 0
      : baseline !== null &&
        !sameDraft(baseline, {
          name: draftName,
          note: draftNote,
          items: draftItems,
          steps: draftSteps,
        }));

  // Zurueck ist ein benanntes Ziel (ADR-036). Mit ungespeicherten Aenderungen
  // fragt der Screen erst - ein Tipp daneben soll keine Arbeit verwerfen.
  const goBack = useCallback(() => {
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    goTo('/rezepte');
  }, [dirty]);

  const discard = useCallback(() => {
    setDiscardOpen(false);
    goTo('/rezepte');
  }, []);

  // Die Zuruecktaste von Android geht an der Appbar vorbei. Nur bei
  // ungespeicherten Aenderungen faengt der Screen sie ab; sonst bleibt das
  // gewohnte Verhalten des Systems.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!dirty) {
          return false;
        }
        setDiscardOpen(true);
        return true;
      });
      return () => subscription.remove();
    }, [dirty]),
  );

  const save = useCallback(() => {
    if (busy) {
      return;
    }
    const name = cleanRecipeName(draftName);
    if (name === null) {
      setNameError(true);
      return;
    }

    const ingredients: NewIngredient[] = draftItems.map(
      ({ productId, name: itemName, quantity, unit }) => ({
        productId,
        name: itemName,
        quantity,
        unit,
      }),
    );

    // Rohe Texte - das Bereinigen (leere weg, Positionen neu) macht das
    // Repository mit cleanRecipeSteps.
    const stepTexts = draftSteps.map((step) => step.text);

    setBusy(true);
    const run = async () => {
      if (isNew) {
        const id = await createRecipe(name, draftNote, ingredients, stepTexts);
        router.replace({ pathname: '/rezept', params: { recipeId: id } });
      } else {
        await updateRecipe(recipeId, name, draftNote, ingredients, stepTexts);
      }
      setEditingKey(null);
      setBaseline(null);
      setEditing(false);
    };

    void run().finally(() => setBusy(false));
  }, [busy, draftName, draftNote, draftItems, draftSteps, isNew, recipeId]);

  const remove = useCallback(() => {
    setDeleteOpen(false);
    if (busy) {
      return;
    }
    setBusy(true);
    void deleteRecipe(recipeId)
      .then(() => goTo('/rezepte'))
      .finally(() => setBusy(false));
  }, [busy, recipeId]);

  const keyboardTarget = bottomInsetWithKeyboard(keyboardHeight, insets.bottom);
  // Gewoehnlicher Stil statt Reanimated-Animation: siehe ADR-050.
  const keyboardPadding = { paddingBottom: keyboardTarget };

  const quantityText = (item: { quantity: number; unit: string }) =>
    formatQuantity(item, t(`units.${item.unit}.short`));

  const editingDraft = draftItems.find((item) => item.key === editingKey) ?? null;

  const title = isNew ? t('recipe.newTitle') : (recipe?.name ?? '');

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        {/* Benanntes Ziel statt router.back() (ADR-036). */}
        <Appbar.BackAction
          onPress={goBack}
          accessibilityLabel={t('recipe.back')}
          testID="recipe-back"
        />
        <Appbar.Content title={title} />
        {editing ? (
          <>
            <Appbar.Action
              icon="check"
              onPress={save}
              disabled={busy}
              accessibilityLabel={t('recipe.save')}
              testID="recipe-save"
            />
            {!isNew && recipe ? (
              <Menu
                visible={menuOpen}
                onDismiss={() => setMenuOpen(false)}
                anchor={
                  <Appbar.Action
                    icon="dots-vertical"
                    onPress={() => setMenuOpen(true)}
                    accessibilityLabel={t('recipe.menu')}
                    testID="recipe-menu"
                  />
                }
              >
                <Menu.Item
                  leadingIcon="delete-outline"
                  title={t('recipe.delete')}
                  testID="recipe-delete"
                  onPress={() => {
                    setMenuOpen(false);
                    setDeleteOpen(true);
                  }}
                />
              </Menu>
            ) : null}
          </>
        ) : recipe ? (
          <Appbar.Action
            icon="pencil"
            onPress={startEditing}
            accessibilityLabel={t('recipe.edit')}
            testID="recipe-edit"
          />
        ) : null}
      </Appbar.Header>

      {editing ? (
        <View style={styles.container}>
          <FlatList
            ref={listRef}
            data={draftItems}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            testID="recipe-edit-list"
            ListHeaderComponent={
              <View style={styles.form}>
                <TextInput
                  mode="outlined"
                  value={draftName}
                  onChangeText={(text) => {
                    setDraftName(text);
                    setNameError(false);
                  }}
                  label={t('recipe.nameLabel')}
                  maxLength={MAX_TEMPLATE_NAME_LENGTH}
                  error={nameError}
                  testID="recipe-name"
                />
                {nameError ? (
                  <HelperText type="error" visible testID="recipe-name-error">
                    {t('recipe.nameRequired')}
                  </HelperText>
                ) : null}
                <TextInput
                  mode="outlined"
                  value={draftNote}
                  onChangeText={setDraftNote}
                  label={t('recipe.noteLabel')}
                  multiline
                  maxLength={MAX_RECIPE_NOTE_LENGTH}
                  testID="recipe-note"
                />
                <Text
                  variant="titleSmall"
                  style={[styles.formHeader, { color: theme.colors.primary }]}
                >
                  {t('recipe.ingredients')}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const quantity = quantityText(item);
              return (
                <List.Item
                  title={item.name}
                  onPress={() => setEditingKey(item.key)}
                  accessibilityLabel={t('recipe.editIngredient', { name: item.name })}
                  testID={`ingredient-${item.name}`}
                  style={styles.row}
                  right={() => (
                    <View style={styles.right}>
                      {quantity ? (
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                          {quantity}
                        </Text>
                      ) : null}
                      <IconButton
                        icon="delete"
                        onPress={() => removeDraft(item.key)}
                        accessibilityLabel={t('recipe.removeIngredient', { name: item.name })}
                        testID={`ingredient-remove-${item.name}`}
                        style={styles.iconButton}
                      />
                    </View>
                  )}
                />
              );
            }}
            // Als Element, nicht als Funktion: Eine Funktion waere bei jedem
            // Tastendruck eine neue Komponente, und das Feld verloere den Fokus.
            ListFooterComponent={
              <View style={styles.form}>
                <Text
                  variant="titleSmall"
                  style={[styles.formHeader, { color: theme.colors.primary }]}
                >
                  {t('recipe.steps')}
                </Text>
                {draftSteps.map((step, index) => {
                  const n = index + 1;
                  return (
                    <View key={step.key} style={styles.stepEditRow}>
                      <Text
                        variant="labelLarge"
                        style={[styles.stepNumber, { color: theme.colors.primary }]}
                      >
                        {n}
                      </Text>
                      <TextInput
                        ref={(input: StepInput | null) => registerStepInput(step.key, input)}
                        mode="outlined"
                        value={step.text}
                        onChangeText={(text) => changeStep(step.key, text)}
                        placeholder={t('recipe.stepPlaceholder')}
                        accessibilityLabel={t('recipe.stepLabel', { n, text: step.text })}
                        multiline
                        maxLength={MAX_STEP_LENGTH}
                        testID={`step-input-${index}`}
                        style={styles.stepInput}
                      />
                      <IconButton
                        icon="arrow-up"
                        onPress={() => shiftStep(index, index - 1)}
                        disabled={index === 0}
                        accessibilityLabel={t('recipe.stepUp', { n })}
                        testID={`step-up-${index}`}
                        style={styles.iconButton}
                      />
                      <IconButton
                        icon="arrow-down"
                        onPress={() => shiftStep(index, index + 1)}
                        disabled={index === draftSteps.length - 1}
                        accessibilityLabel={t('recipe.stepDown', { n })}
                        testID={`step-down-${index}`}
                        style={styles.iconButton}
                      />
                      <IconButton
                        icon="delete"
                        onPress={() => removeStep(step.key)}
                        accessibilityLabel={t('recipe.stepRemove', { n })}
                        testID={`step-remove-${index}`}
                        style={styles.iconButton}
                      />
                    </View>
                  );
                })}
                <Button
                  mode="outlined"
                  icon="plus"
                  onPress={addStep}
                  accessibilityLabel={t('recipe.stepAdd')}
                  testID="step-add"
                  contentStyle={styles.buttonContent}
                  style={styles.stepAdd}
                >
                  {t('recipe.stepAdd')}
                </Button>
              </View>
            }
          />

          {/* Wie auf der Liste: Das Eingabefeld folgt der Tastatur (ADR-035).
              Ein fokussiertes Schrittfeld bleibt dabei sichtbar: Das Polster
              unten verkleinert die Liste, und Androids ScrollView holt das
              fokussierte Feld bei einer Groessenaenderung wieder ins Bild. */}
          {/* Unten entweder das Eingabefeld oder die Detailzeile, nie beides -
              wie auf der Liste. */}
          <View style={keyboardPadding}>
            {editingDraft ? (
              <ItemDetailBar
                // Neue Zutat, neuer Zustand: siehe ItemDetailBar.
                key={editingDraft.key}
                item={{
                  id: editingDraft.key,
                  name: editingDraft.name,
                  quantity: editingDraft.quantity,
                  unit: editingDraft.unit,
                  note: null,
                }}
                showNote={false}
                onChange={handleDetails}
                onClose={() => setEditingKey(null)}
              />
            ) : (
              <AddItemBar
                products={products}
                // Schon enthaltene Zutaten schlaegt das Feld nicht noch einmal vor.
                productIdsOnList={draftProductIds}
                stats={stats}
                pantryProductIds={pantryIds}
                onPickProduct={appendProduct}
                onCreateProduct={handleCreate}
              />
            )}
          </View>
        </View>
      ) : (
        <>
          <FlatList
            data={recipe ? items : []}
            keyExtractor={(item) => item.id}
            style={styles.container}
            testID="recipe-ingredients"
            ListHeaderComponent={
              recipe ? (
                <View>
                  <List.Item
                    title={t('recipe.cookThisWeek')}
                    onPress={() => void setInWeeklyPlan(recipeId, !inPlan)}
                    // Die ganze Zeile ist der Schalter, wie die Zeilen im
                    // Vorrat: 48 dp sicher, und der Screenreader hoert genau
                    // einen Schalter.
                    accessibilityRole="switch"
                    accessibilityState={{ checked: inPlan }}
                    accessibilityLabel={t('recipe.cookThisWeek')}
                    testID="recipe-week-switch"
                    style={styles.row}
                    right={() => (
                      <View
                        pointerEvents="none"
                        importantForAccessibility="no-hide-descendants"
                        accessibilityElementsHidden
                        style={styles.center}
                      >
                        <Switch value={inPlan} />
                      </View>
                    )}
                  />
                  <Text
                    variant="titleSmall"
                    style={[styles.sectionHeader, { color: theme.colors.primary }]}
                  >
                    {t('recipe.ingredients')}
                  </Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              const status = statusById.get(item.id) ?? 'missing';
              const quantity = quantityText(item);
              return (
                <List.Item
                  title={item.name}
                  testID={`ingredient-${item.name}`}
                  accessibilityLabel={
                    status === 'staple'
                      ? t('recipe.statusStaple', { name: item.name })
                      : status === 'have'
                        ? t('recipe.statusHave', { name: item.name })
                        : status === 'onList'
                          ? t('recipe.statusOnList', { name: item.name })
                          : t('recipe.statusMissing', { name: item.name })
                  }
                  style={styles.row}
                  left={(props) =>
                    status === 'staple' ? (
                      <List.Icon
                        {...props}
                        icon="home-outline"
                        color={theme.colors.onSurfaceVariant}
                      />
                    ) : status === 'have' ? (
                      <List.Icon {...props} icon="check" color={theme.colors.primary} />
                    ) : status === 'onList' ? (
                      <List.Icon {...props} icon="playlist-check" />
                    ) : (
                      <List.Icon
                        {...props}
                        icon="cart-outline"
                        color={theme.colors.onSurfaceVariant}
                      />
                    )
                  }
                  right={() =>
                    quantity ? (
                      <View style={styles.center}>
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                          {quantity}
                        </Text>
                      </View>
                    ) : null
                  }
                />
              );
            }}
            ListFooterComponent={
              recipe && (steps.length > 0 || recipe.note) ? (
                <View>
                  {/* Zubereitung direkt unter den Zutaten, nur wenn es Schritte gibt. */}
                  {steps.length > 0 ? (
                    <View>
                      <Text
                        variant="titleSmall"
                        style={[styles.sectionHeader, { color: theme.colors.primary }]}
                      >
                        {t('recipe.steps')}
                      </Text>
                      {steps.map((step, index) => (
                        <View
                          key={step.id}
                          accessible
                          accessibilityLabel={t('recipe.stepLabel', {
                            n: index + 1,
                            text: step.text,
                          })}
                          testID={`step-${index}`}
                          style={styles.stepRow}
                        >
                          <Text
                            variant="labelLarge"
                            style={[styles.stepNumber, { color: theme.colors.primary }]}
                          >
                            {index + 1}
                          </Text>
                          <Text variant="bodyMedium" style={styles.stepText}>
                            {step.text}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {recipe.note ? (
                    <View>
                      <Text
                        variant="titleSmall"
                        style={[styles.sectionHeader, { color: theme.colors.primary }]}
                      >
                        {t('recipe.note')}
                      </Text>
                      <Text variant="bodyMedium" style={styles.note} testID="recipe-note-text">
                        {recipe.note}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null
            }
          />

          {recipe ? (
            <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
              <View style={styles.footerRow}>
                {/* Dasselbe Schild wie in der Uebersicht (M18). */}
                <RecipeBadge missingCount={notInPantry} testID="recipe-missing" />
              </View>
              <Button
                mode="contained"
                icon="cart-plus"
                disabled={addableIds.length === 0 || busy}
                onPress={addMissing}
                testID="recipe-add-missing"
              >
                {t('recipe.addMissing')}
              </Button>
            </View>
          ) : null}
        </>
      )}

      <Portal>
        <Dialog visible={discardOpen} onDismiss={() => setDiscardOpen(false)}>
          <Dialog.Title>{t('recipe.discardTitle')}</Dialog.Title>
          <Dialog.Actions>
            <Button onPress={() => setDiscardOpen(false)} testID="recipe-discard-keep">
              {t('recipe.discardKeep')}
            </Button>
            <Button onPress={discard} testID="recipe-discard-confirm">
              {t('recipe.discardConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={deleteOpen} onDismiss={() => setDeleteOpen(false)}>
          <Dialog.Title>{t('recipe.deleteTitle', { name: recipe?.name ?? '' })}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t('recipe.deleteHint')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteOpen(false)}>{t('common.cancel')}</Button>
            <Button onPress={remove} testID="recipe-delete-confirm">
              {t('recipe.deleteConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={message !== null}
        onDismiss={() => setMessage(null)}
        duration={4000}
        testID="recipe-snackbar"
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
  form: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  formHeader: {
    paddingTop: 8,
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
  center: {
    justifyContent: 'center',
  },
  iconButton: {
    margin: 0,
    width: 48,
    height: 48,
  },
  note: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  stepNumber: {
    minWidth: 20,
    textAlign: 'right',
  },
  stepText: {
    flex: 1,
  },
  stepEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepInput: {
    flex: 1,
  },
  stepAdd: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  buttonContent: {
    minHeight: 48,
  },
  // Wie der Fussbereich von Vorrat und Einkaufsliste.
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
});
