import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, SectionList, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Button,
  Dialog,
  List,
  Menu,
  Portal,
  ProgressBar,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddItemBar } from '@/features/catalog/components/AddItemBar';
import type { CatalogProduct } from '@/features/catalog/logic';
import {
  catalogProductsQuery,
  categoriesQuery,
  createProduct,
  FALLBACK_CATEGORY_ID,
} from '@/features/catalog/repository';
import { ItemDetailBar, type ItemDetailChange } from '@/features/items/components/ItemDetailBar';
import { ItemRow } from '@/features/items/components/ItemRow';
import { canFinishShopping } from '@/features/items/logic';
import {
  addItem,
  addProductToList,
  finishShopping,
  listItemsQuery,
  removeItem,
  setItemChecked,
  updateItemDetails,
} from '@/features/items/repository';
import {
  buildListSections,
  CHECKED_SECTION_ID,
  listRoute,
  ROUTE_OVERVIEW,
} from '@/features/lists/logic';
import {
  categoryOrderQuery,
  listQuery,
  setLastRoute,
  touchList,
} from '@/features/lists/repository';
import { toProductStats } from '@/features/suggestions/logic';
import { currentStatsQuery } from '@/features/suggestions/repository';
import { pantryQuery } from '@/features/pantry/repository';
import {
  cleanTemplateName,
  MAX_TEMPLATE_NAME_LENGTH,
  type TemplateOverviewRow,
} from '@/features/templates/logic';
import {
  applyTemplate,
  getTemplateOverview,
  saveListAsTemplate,
} from '@/features/templates/repository';
import { buildShareText, SHARE_COPY_HINT_KEY } from '@/features/transfer/logic';
import { buildSharedListForList } from '@/features/transfer/repository';
import { shareList } from '@/features/transfer/share';
import { getFlag, setFlag } from '@/db/appState';
import { goTo } from '@/lib/navigation';
import { bottomInsetWithKeyboard } from '@/lib/keyboard';
import { useKeyboardHeight } from '@/lib/useKeyboardHeight';
import { useAppTheme } from '@/theme';
import { categoryColorFor } from '@/theme/categoryColors';

/**
 * Der Haupt-Screen: eine Liste mit ihren Artikeln, Eingabefeld und Abschluss.
 *
 * In M3 kommt der Laden-Flow dazu (PRD Flow 2): abhaken, ausblenden,
 * rueckgaengig machen, Fortschritt sehen, Einkauf abschliessen. Die
 * Gruppierung nach Kategorien in Ladenreihenfolge folgt in M5.
 *
 * Alle Datenbankzugriffe laufen ueber Repository-Funktionen (CLAUDE.md,
 * Schichtenregel 1), alles Rechnende steckt in features/items/logic.ts.
 */
type Props = {
  listId: string;
};

export function ListScreen({ listId }: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  // UI-Zustand, bewusst lokal: Er gehoert zu genau diesem Screen und ueberlebt
  // dessen Verlassen nicht. Ein globaler Store waere hier Aufwand ohne Nutzen
  // (ADR-020 verlangt nur, dass er keine Daten haelt).
  const [showChecked, setShowChecked] = useState(false);
  const [undoItemId, setUndoItemId] = useState<string | null>(null);
  const [undoName, setUndoName] = useState('');
  const [finishedCount, setFinishedCount] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareHintOpen, setShareHintOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateChoices, setTemplateChoices] = useState<TemplateOverviewRow[] | null>(null);

  // Ab Android 15 erzwingt das System Edge-to-Edge: Das Fenster wird beim
  // Oeffnen der Tastatur nicht mehr verkleinert, android:windowSoftInputMode
  // "adjustResize" ist wirkungslos. Die Tastatur ist stattdessen ein Inset,
  // um das sich die App selbst kuemmern muss - sonst liegt sie ueber dem
  // Eingabefeld und man sieht weder die Eingabe noch die Vorschlaege
  // (ADR-026).
  //
  // Die Hoehe kommt aus useKeyboardHeight und nicht mehr aus Reanimateds
  // useAnimatedKeyboard - siehe ADR-035. Den weichen Uebergang gibt es seit
  // ADR-050 nicht mehr: Der Abstand ist ein gewoehnlicher Stil.
  const keyboardHeight = useKeyboardHeight();

  // Beim Oeffnen zwei Vermerke: Die Liste gilt als zuletzt benutzt, und die
  // App merkt sich diesen Screen als Startpunkt (FR-1.5).
  useEffect(() => {
    void touchList(listId);
    void setLastRoute(listRoute(listId));
  }, [listId]);

  // Die Abfragen kommen aus den Repositories, damit der Screen keine Tabellen
  // kennt (CLAUDE.md, Schichtenregel 1). Als Bauplan und nicht als Ergebnis,
  // weil useLiveQuery sie bei jeder Datenaenderung erneut ausfuehrt.
  const listRows = useLiveQuery(listQuery(listId), [listId]);
  const items = useLiveQuery(listItemsQuery(listId), [listId]);
  const catalog = useLiveQuery(catalogProductsQuery());
  const categoryRows = useLiveQuery(categoriesQuery());
  const orderRows = useLiveQuery(categoryOrderQuery(listId), [listId]);

  const historyRows = useLiveQuery(currentStatsQuery());
  const pantryRows = useLiveQuery(pantryQuery());
  const pantryProductIds = useMemo(
    () => (pantryRows.data ?? []).map((row) => row.productId),
    [pantryRows.data],
  );

  const rows = useMemo(() => items.data ?? [], [items.data]);
  const products: CatalogProduct[] = catalog.data ?? [];
  const stats = useMemo(() => toProductStats(historyRows.data ?? []), [historyRows.data]);
  const productIdsOnList = rows
    .filter((row) => !row.isChecked)
    .map((row) => row.productId)
    .filter((id): id is string => id !== null);

  // Die Gruppierung nach Kategorien in Ladenreihenfolge (architecture.md 4.1).
  // Ob die Liste eine eigene Reihenfolge hat oder nicht, entscheidet sich in
  // orderCategories - hier gibt es dafuer keine Verzweigung.
  const { sections, openCount, checkedCount } = useMemo(
    () =>
      buildListSections(rows, categoryRows.data ?? [], orderRows.data ?? [], {
        showChecked,
        fallbackCategoryId: FALLBACK_CATEGORY_ID,
        fallbackTitle: t('list.fallbackCategory'),
        checkedTitle: t('list.checked'),
      }),
    [rows, categoryRows.data, orderRows.data, showChecked, t],
  );

  const handlePick = useCallback(
    (product: CatalogProduct) => {
      void addProductToList(listId, product.id);
    },
    [listId],
  );

  const handleCreate = useCallback(
    (name: string) => {
      void createProduct(name).then((product) => {
        if (product) {
          void addProductToList(listId, product.id);
        } else {
          // Sollte nicht vorkommen, aber der Artikel darf nicht verloren gehen:
          // dann eben als freier Text ohne Katalogbezug.
          void addItem({ listId, name });
        }
      });
    },
    [listId],
  );

  const handleRemove = useCallback((id: string) => {
    void removeItem(id);
    // Die Detailzeile darf keinen Artikel zeigen, den es nicht mehr gibt.
    setEditingId((current) => (current === id ? null : current));
  }, []);

  const handleDetails = useCallback((id: string, details: ItemDetailChange) => {
    void updateItemDetails(id, details);
  }, []);

  const handleToggle = useCallback(
    (id: string, isChecked: boolean) => {
      void setItemChecked(id, isChecked);
      if (isChecked) {
        // Der Artikel verschwindet sofort aus der Liste. Ohne diesen Hinweis
        // waere ein Fehlgriff nur ueber den Schalter "erledigt anzeigen"
        // zu korrigieren - zu umstaendlich fuer einen Wisch daneben.
        setUndoItemId(id);
        setUndoName(rows.find((row) => row.id === id)?.name ?? '');
      } else {
        setUndoItemId(null);
      }
    },
    [rows],
  );

  const handleUndo = useCallback(() => {
    if (undoItemId) {
      void setItemChecked(undoItemId, false);
      setUndoItemId(null);
    }
  }, [undoItemId]);

  const handleFinish = useCallback(() => {
    setConfirmOpen(false);
    void finishShopping(listId).then((count) => {
      setUndoItemId(null);
      setFinishedCount(count);
    });
  }, [listId]);

  const keyboardTarget = bottomInsetWithKeyboard(keyboardHeight, insets.bottom);
  // Ein gewoehnlicher Stil, keine Reanimated-Animation mehr (ADR-050): Der
  // animierte Wert ging verloren, sobald React den Screen neu aufbaute - die
  // Leiste fiel dann bei offener Tastatur auf ihren Startwert zurueck und lag
  // unter der Tastatur. Lieber ohne Gleiten als unsichtbar.
  const keyboardPadding = { paddingBottom: keyboardTarget };

  /**
   * Teilen (FR-6.1, PRD Flow 3): Datei plus lesbarer Text ins Android-Menue.
   *
   * Die Datei wird erst hier aus der Datenbank gebaut und nicht aus dem, was
   * gerade auf dem Bildschirm steht: Sichtbar ist je nach Schalter nur ein
   * Teil der Liste, geteilt gehoert aber alles Offene.
   */
  const doShare = useCallback(async () => {
    const file = await buildSharedListForList(listId);

    if (file === null || file.list.items.length === 0) {
      setMessage(t('share.empty'));
      return;
    }

    const text = buildShareText(file.list.items, {
      header: t('share.header', { name: file.list.name, count: file.list.items.length }),
      unitShort: (unit) => t(`units.${unit}.short`),
    });

    const outcome = await shareList(file, text, t('share.fallbackName'), t('share.dialogTitle'));

    if (outcome === 'nichtVerfuegbar') {
      setMessage(t('share.unavailable'));
    }
  }, [listId, t]);

  /**
   * Beim ersten Mal kommt der Hinweis, dass eine Kopie entsteht (FR-6.7).
   *
   * Er steht vor dem Teilen und nicht danach: Wer erst hinterher erfaehrt,
   * dass Aenderungen nicht zurueckfliessen, hat die falsche Erwartung schon
   * verschickt.
   */
  const startShare = useCallback(() => {
    setMenuOpen(false);
    void getFlag(SHARE_COPY_HINT_KEY).then((seen) => {
      if (seen) {
        void doShare();
      } else {
        setShareHintOpen(true);
      }
    });
  }, [doShare]);

  const confirmShareHint = useCallback(() => {
    setShareHintOpen(false);
    void setFlag(SHARE_COPY_HINT_KEY, true).then(() => doShare());
  }, [doShare]);

  /**
   * Die aktuelle Liste als Vorlage sichern (FR-5.3).
   *
   * Der Name wird vorgeschlagen, nicht erzwungen: Meistens heisst die Vorlage
   * wie die Liste, aus der sie stammt.
   */
  const openSaveTemplate = useCallback(() => {
    setMenuOpen(false);

    if (rows.length === 0) {
      setMessage(t('templates.saveEmpty'));
      return;
    }

    setTemplateName(listRows.data?.[0]?.name ?? '');
    setSaveTemplateOpen(true);
  }, [rows.length, listRows.data, t]);

  const saveTemplate = useCallback(() => {
    const name = cleanTemplateName(templateName);
    setSaveTemplateOpen(false);

    if (name === null) {
      return;
    }

    void saveListAsTemplate(listId, name).then((count) => {
      setMessage(t('templates.saved', { name, count }));
    });
  }, [templateName, listId, t]);

  /**
   * Vorlagen werden erst beim Oeffnen geladen, nicht dauerhaft beobachtet -
   * siehe getTemplateOverview.
   */
  const openApplyTemplate = useCallback(() => {
    setMenuOpen(false);
    void getTemplateOverview().then(setTemplateChoices);
  }, []);

  const applyTemplateTo = useCallback(
    (templateId: string) => {
      setTemplateChoices(null);
      void applyTemplate(templateId, listId).then(({ added, skipped }) => {
        if (added === 0) {
          setMessage(t('templates.appliedNone'));
        } else if (skipped === 0) {
          setMessage(t('templates.applied', { count: added }));
        } else {
          setMessage(t('templates.appliedSkipped', { count: added, skipped }));
        }
      });
    },
    [listId, t],
  );

  // Die Detailzeile liest ihre Werte aus der Live-Abfrage, nicht aus einer
  // Kopie: So zeigt sie immer, was tatsaechlich in der Datenbank steht.
  const editingItem = rows.find((row) => row.id === editingId) ?? null;

  const canFinish = canFinishShopping(rows);
  const total = openCount + checkedCount;

  // Flaechen statt Linien (ADR-049 Punkt 5): Jede Abteilung liegt auf einer
  // getoenten Flaeche, das Erledigte auf einer stilleren. level2 statt level1
  // fuer die Abteilungen, weil die Erledigt-Flaeche noch leiser sein muss -
  // und leiser als level1 gibt es unter den Rollen nur noch "gar keine Flaeche".
  const groupSurface = theme.colors.elevation.level2;
  const checkedSurface = theme.colors.elevation.level1;
  const surfaceFor = (key: string) => (key === CHECKED_SECTION_ID ? checkedSurface : groupSurface);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        {/* Zurueck fuehrt zur Uebersicht - als benanntes Ziel, nicht als
            "einen Schritt zurueck".
            router.back() war hier falsch: Startet die App direkt auf einer
            Liste, liegt darunter die Einstiegsroute "/", und die leitet sofort
            wieder auf dieselbe Liste. Der Knopf tat dann sichtbar nichts.
            goTo geht zu einer schon vorhandenen Uebersicht zurueck und setzt
            sonst eine an die Stelle der Liste. router.navigate tat das nicht,
            es legte jedes Mal eine neue Uebersicht obendrauf (ADR-036). */}
        <Appbar.BackAction
          onPress={() => {
            void setLastRoute(ROUTE_OVERVIEW);
            goTo('/listen');
          }}
          accessibilityLabel={t('list.back')}
          testID="back-to-lists"
        />
        <Appbar.Content title={listRows.data?.[0]?.name ?? ''} />
        <Appbar.Action
          icon="store-outline"
          onPress={() => {
            router.push({ pathname: '/ladenlayout', params: { listId } });
          }}
          accessibilityLabel={t('list.layout')}
          testID="open-layout"
        />
        <Appbar.Action
          icon="playlist-plus"
          onPress={() => {
            router.push({ pathname: '/katalog', params: { listId } });
          }}
          accessibilityLabel={t('list.catalog')}
          testID="open-catalog"
        />
        <Menu
          visible={menuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={
            <Appbar.Action
              icon="dots-vertical"
              onPress={() => setMenuOpen(true)}
              accessibilityLabel={t('list.menu')}
              testID="list-menu"
            />
          }
        >
          <Menu.Item
            leadingIcon="share-variant"
            title={t('list.share')}
            onPress={startShare}
            testID="menu-share"
          />
          <Menu.Item
            leadingIcon="content-save-outline"
            title={t('list.saveTemplate')}
            onPress={openSaveTemplate}
            testID="menu-save-template"
          />
          <Menu.Item
            leadingIcon="clipboard-list-outline"
            title={t('list.applyTemplate')}
            onPress={openApplyTemplate}
            testID="menu-apply-template"
          />
          <Menu.Item
            leadingIcon="fridge-outline"
            title={t('list.menuPantry')}
            testID="menu-pantry"
            onPress={() => {
              setMenuOpen(false);
              router.push({ pathname: '/vorrat', params: { listId } });
            }}
          />
        </Menu>
      </Appbar.Header>

      {/* Der Fortschritt steht oben unter dem Titel (ADR-049 Punkt 5), nicht
          mehr in der Fussleiste: Dort verdeckte ihn die Tastatur, sobald man
          etwas nachtrug. Text und Balken sagen dasselbe auf zwei Arten - der
          Text fuer den genauen Stand, der Balken fuer den Blick im Gehen. */}
      {total > 0 ? (
        <View style={styles.progress}>
          <Text variant="titleMedium" testID="progress">
            {openCount === 0 ? t('list.allDone') : t('list.progress', { open: openCount, total })}
          </Text>
          <ProgressBar
            progress={checkedCount / total}
            color={theme.colors.primary}
            accessibilityLabel={t('list.progressA11y', { done: checkedCount, total })}
          />
        </View>
      ) : null}

      <View style={styles.container}>
        {/* Eine Gruppenflaeche besteht aus drei Teilen der SectionList: Kopf
            (oben gerundet, mit Schild), Zeilen (Flaeche ohne Rundung) und
            Fuss (unten gerundet, Abstand zur naechsten Gruppe). Eine View je
            Abschnitt waere einfacher zu stylen, nimmt der Liste aber das
            Virtualisieren und die mitlaufenden Ueberschriften.

            Die Ueberschriften bleiben mitlaufend (sticky): Im Laden sieht man
            so immer, in welcher Abteilung man gerade ist. Der Preis ist klein -
            solange eine Ueberschrift oben klebt, laufen die Zeilen hinter ihren
            gerundeten Ecken durch, und die Ecken wirken eckig. Da Kopf und
            Zeilen dieselbe Farbe haben, faellt das kaum auf. */}
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled
          testID="item-list"
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({ section }) => {
            const isChecked = section.key === CHECKED_SECTION_ID;
            const label = categoryColorFor(theme.categories, section.key);
            return (
              <View style={[styles.groupTop, { backgroundColor: surfaceFor(section.key) }]}>
                {isChecked ? (
                  // Das Erledigte bekommt kein Kategorieschild: Es ist keine
                  // Abteilung, und Farbe wuerde es lauter machen, als es ist.
                  <Text
                    variant="titleSmall"
                    accessibilityRole="header"
                    testID={`section-${section.key}`}
                    style={[styles.checkedTitle, { color: theme.colors.onSurfaceVariant }]}
                  >
                    {section.title}
                  </Text>
                ) : (
                  // Das Schild: Farbe der Abteilung (ADR-049 Punkt 1), damit man
                  // eine Gruppe am Farbton erkennt, bevor man den Titel liest.
                  // Punkt und Schrift tragen beide die Schriftfarbe des Paares -
                  // genau die Kombination, die der Kontrasttest prueft.
                  <View style={[styles.label, { backgroundColor: label.container }]}>
                    <View style={[styles.labelDot, { backgroundColor: label.onContainer }]} />
                    <Text
                      variant="titleSmall"
                      accessibilityRole="header"
                      testID={`section-${section.key}`}
                      style={[styles.labelText, { color: label.onContainer }]}
                    >
                      {section.title}
                    </Text>
                  </View>
                )}
              </View>
            );
          }}
          renderItem={({ item, section }) => (
            <View style={[styles.groupBody, { backgroundColor: surfaceFor(section.key) }]}>
              <ItemRow
                item={item}
                unitShort={t(`units.${item.unit}.short`)}
                isEditing={item.id === editingId}
                surfaceColor={surfaceFor(section.key)}
                onToggle={handleToggle}
                onRemove={handleRemove}
                onOpenDetails={setEditingId}
              />
            </View>
          )}
          renderSectionFooter={({ section }) => (
            <View style={[styles.groupBottom, { backgroundColor: surfaceFor(section.key) }]} />
          )}
          ListEmptyComponent={
            checkedCount > 0 ? null : (
              <View style={styles.empty} testID="list-empty">
                <Text variant="titleMedium" style={styles.emptyText}>
                  {t('list.empty.title')}
                </Text>
                <Text variant="bodyMedium" style={[styles.emptyText, styles.emptyHint]}>
                  {t('list.empty.hint')}
                </Text>
              </View>
            )
          }
        />

        {/* Die Fussleiste traegt nur noch, was man antippt. Kein Rand nach
            oben: Sie hat den Hintergrund des Bildschirms, die Gruppenflaechen
            darueber enden von selbst (ADR-049, "Flaechen statt Linien").

            Schalter und Knopf stehen bewusst untereinander und nicht in einer
            Zeile: Beide Beschriftungen zusammen passen auf einem 360-dp-
            Telefon nicht nebeneinander, und eine Zeile, die je nach Text mal
            umbricht und mal nicht, liesse den Abschluss-Knopf beim Umschalten
            springen. */}
        {total > 0 ? (
          <View style={[styles.footer, { backgroundColor: theme.colors.background }]}>
            {checkedCount > 0 ? (
              <Button
                onPress={() => setShowChecked((value) => !value)}
                testID="toggle-checked"
                style={styles.toggleChecked}
                contentStyle={styles.buttonContent}
              >
                {showChecked
                  ? t('list.hideChecked')
                  : t('list.showChecked', { count: checkedCount })}
              </Button>
            ) : null}
            <Button
              mode="contained"
              icon="cart-check"
              disabled={!canFinish}
              onPress={() => (openCount > 0 ? setConfirmOpen(true) : handleFinish())}
              testID="finish-shopping"
              contentStyle={styles.buttonContent}
            >
              {t('list.finish')}
            </Button>
          </View>
        ) : null}

        {/* Unten steht entweder das Eingabefeld oder die Detailzeile - nie
            beides. Zwei Eingabebereiche uebereinander waeren bei offener
            Tastatur kaum noch zu treffen, und die Detailzeile gehoert an
            genau die Stelle, die der Daumen ohnehin ansteuert. */}
        <View style={keyboardPadding}>
          {editingItem ? (
            <ItemDetailBar
              // Neuer Artikel, neuer Zustand: siehe ItemDetailBar.
              key={editingItem.id}
              item={editingItem}
              onChange={handleDetails}
              onClose={() => setEditingId(null)}
            />
          ) : (
            <AddItemBar
              products={products}
              productIdsOnList={productIdsOnList}
              stats={stats}
              pantryProductIds={pantryProductIds}
              onPickProduct={handlePick}
              onCreateProduct={handleCreate}
            />
          )}
        </View>
      </View>

      <Portal>
        {/* Liste als Vorlage sichern (FR-5.3). */}
        <Dialog
          visible={saveTemplateOpen}
          onDismiss={() => setSaveTemplateOpen(false)}
          style={{ marginBottom: keyboardHeight }}
        >
          <Dialog.Title>{t('templates.saveTitle')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              value={templateName}
              onChangeText={setTemplateName}
              label={t('templates.nameLabel')}
              placeholder={t('templates.namePlaceholder')}
              maxLength={MAX_TEMPLATE_NAME_LENGTH}
              testID="template-name"
              onSubmitEditing={saveTemplate}
            />
            <Text variant="bodySmall" style={styles.dialogHint}>
              {t('templates.saveHint')}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSaveTemplateOpen(false)}>{t('common.cancel')}</Button>
            <Button onPress={saveTemplate} testID="template-save-confirm">
              {t('templates.saveConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Vorlage auswaehlen und anwenden (FR-5.4). */}
        <Dialog visible={templateChoices !== null} onDismiss={() => setTemplateChoices(null)}>
          <Dialog.Title>{t('templates.applyTitle')}</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScroll}>
            {templateChoices?.length === 0 ? (
              <Text variant="bodyMedium" style={styles.dialogHint} testID="apply-empty">
                {t('templates.applyEmpty')}
              </Text>
            ) : (
              <ScrollView>
                {templateChoices?.map((template) => (
                  <List.Item
                    key={template.id}
                    title={template.name}
                    description={t('templates.count', { count: template.itemCount })}
                    onPress={() => applyTemplateTo(template.id)}
                    testID={`apply-${template.name}`}
                    style={styles.dialogRow}
                  />
                ))}
              </ScrollView>
            )}
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setTemplateChoices(null)}>{t('common.cancel')}</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Einmaliger Hinweis vor dem ersten Teilen (FR-6.7). */}
        <Dialog visible={shareHintOpen} onDismiss={() => setShareHintOpen(false)}>
          <Dialog.Title>{t('share.copyTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t('share.copyHint')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShareHintOpen(false)}>{t('common.cancel')}</Button>
            <Button onPress={confirmShareHint} testID="share-hint-confirm">
              {t('share.copyConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Rueckfrage nur, wenn noch etwas offen ist (PRD Flow 2.8). Ist alles
            abgehakt, waere sie ein ueberfluessiger Klick. */}
        <Dialog visible={confirmOpen} onDismiss={() => setConfirmOpen(false)}>
          <Dialog.Title>{t('list.finishOpenTitle', { count: openCount })}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t('list.finishOpenHint')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmOpen(false)}>{t('common.cancel')}</Button>
            <Button onPress={handleFinish} testID="finish-confirm">
              {t('list.finishConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={message !== null}
        onDismiss={() => setMessage(null)}
        duration={4000}
        testID="list-message"
      >
        {message ?? ''}
      </Snackbar>

      {/* Laenger als die uebrigen Meldungen: Dieser Hinweis will nicht gelesen,
          sondern benutzt werden. Wer im Laden danebengewischt hat, muss den
          Blick erst auf den Bildschirm richten, den Hinweis erfassen und
          treffen - vier Sekunden reichten dafuer nachweislich nicht, der
          E2E-Lauf kam auf dem Geraet zu spaet. Sieben Sekunden liegen im
          Rahmen, den Material fuer Meldungen mit Aktion vorsieht. */}
      <Snackbar
        visible={undoItemId !== null}
        onDismiss={() => setUndoItemId(null)}
        duration={7000}
        action={{ label: t('common.undo'), onPress: handleUndo }}
        testID="undo-snackbar"
      >
        {t('item.checked', { name: undoName })}
      </Snackbar>

      <Snackbar
        visible={finishedCount !== null}
        onDismiss={() => setFinishedCount(null)}
        duration={3000}
        testID="finished-snackbar"
      >
        {t('list.finished', { count: finishedCount ?? 0 })}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  progress: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  listContent: {
    paddingTop: 4,
  },
  // Gruppenflaeche (ADR-049 Punkt 5): 18 dp Rundung, 8 dp innen, 10 dp
  // zwischen den Gruppen, 12 dp zum Rand. Verteilt auf Kopf, Zeilen und Fuss.
  groupTop: {
    marginHorizontal: 12,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  groupBody: {
    marginHorizontal: 12,
    paddingHorizontal: 8,
  },
  groupBottom: {
    marginHorizontal: 12,
    marginBottom: 10,
    height: 8,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  // Das Schild waechst mit der Schrift und bricht um, statt abzuschneiden
  // (Abnahme M18: grosse Systemschrift).
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  labelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  labelText: {
    flexShrink: 1,
  },
  checkedTitle: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  footer: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 4,
  },
  toggleChecked: {
    alignSelf: 'flex-end',
  },
  // Paper-Knoepfe sind 40 dp hoch; CLAUDE.md verlangt 48 dp.
  buttonContent: {
    minHeight: 48,
  },
  dialogScroll: {
    paddingHorizontal: 0,
    maxHeight: 320,
  },
  dialogRow: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dialogHint: {
    paddingTop: 8,
    paddingHorizontal: 24,
    opacity: 0.8,
  },
});
