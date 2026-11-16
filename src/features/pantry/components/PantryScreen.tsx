import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, View } from 'react-native';
import { Appbar, Button, Checkbox, List, Snackbar, Text } from 'react-native-paper';

import { catalogProductsQuery, categoriesQuery } from '@/features/catalog/repository';
import { getOrCreateActiveList } from '@/features/lists/repository';
import { toProductStats } from '@/features/suggestions/logic';
import { currentStatsQuery } from '@/features/suggestions/repository';
import { goTo } from '@/lib/navigation';
import { useAppTheme } from '@/theme';
import { categoryColorFor } from '@/theme/categoryColors';

import { buildPantryChecklist, countInPantry, missingProductIds } from '../logic';
import { addMissingToList, pantryQuery, setInPantry } from '../repository';

type Props = {
  /** Die Liste, von der aus der Vorrat geoeffnet wurde - Ziel fuer Zurueck und "Auf die Liste". */
  listId?: string;
};

/**
 * Der Vorrat als Checkliste der ueblichen Artikel (ADR-043, T-13.4, PRD Flow 8).
 *
 * Abschnitte nach Abteilung, seit M18 als farbige Gruppenflaechen (ADR-049,
 * Punkt 6), und derselbe Fussbereich wie die Einkaufsliste: links der Stand,
 * darunter die eine Aktion. Der Vorrat soll sich nicht wie ein fremdes Modul
 * anfuehlen.
 *
 * Nach "Auf die Liste setzen" bleibt der Screen offen. Wer gerade den
 * Kuehlschrank durchgeht, will vielleicht noch einen Haken korrigieren - der
 * Weg zurueck ist ein Tipp.
 */
export function PantryScreen({ listId }: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();

  const pantryRows = useLiveQuery(pantryQuery());
  const historyRows = useLiveQuery(currentStatsQuery());
  const catalog = useLiveQuery(catalogProductsQuery());
  const categoryRows = useLiveQuery(categoriesQuery());

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const stats = useMemo(() => toProductStats(historyRows.data ?? []), [historyRows.data]);

  const sections = useMemo(
    () =>
      buildPantryChecklist(
        catalog.data ?? [],
        stats,
        (pantryRows.data ?? []).map((row) => row.productId),
        // Vollstaendig durchgereicht: Die Ersatzkategorie "sonstiges" ist im
        // Katalog mitgeliefert und bekommt so ihren echten Namen.
        categoryRows.data ?? [],
      ),
    [catalog.data, stats, pantryRows.data, categoryRows.data],
  );

  // SectionList liest die Zeilen aus "data"; die Logik nennt sie "items".
  const listSections = useMemo(
    () => sections.map((section) => ({ ...section, data: section.items })),
    [sections],
  );

  const missing = useMemo(() => missingProductIds(sections), [sections]);
  const missingCount = missing.length;
  const thereCount = useMemo(() => countInPantry(sections), [sections]);

  // Zurueck ist ein benanntes Ziel (ADR-036), kein router.back(): Der Vorrat
  // kann ueber die Uebersicht oder ueber eine Liste erreicht werden.
  const goBack = useCallback(() => {
    if (listId) {
      goTo({ pathname: '/liste', params: { listId } });
    } else {
      goTo('/listen');
    }
  }, [listId]);

  const addMissing = useCallback(() => {
    if (busy || missing.length === 0) {
      return;
    }
    setBusy(true);

    const run = async () => {
      const targetId = listId ?? (await getOrCreateActiveList())?.id;
      if (!targetId) {
        return;
      }
      const added = await addMissingToList(targetId, missing);
      setMessage(added === 0 ? t('pantry.addedNone') : t('pantry.added', { count: added }));
    };

    void run().finally(() => setBusy(false));
  }, [busy, listId, missing, t]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        <Appbar.BackAction
          onPress={goBack}
          accessibilityLabel={t('pantry.back')}
          testID="pantry-back"
        />
        <Appbar.Content title={t('pantry.title')} />
      </Appbar.Header>

      {/* Der Kopf beantwortet die Frage, mit der man den Vorrat oeffnet:
          Wie viel fehlt? (ADR-049, "23 da · 4 fehlen"). Der Stand in der
          Fussleiste bleibt - dort steht er neben dem Knopf, der etwas damit tut. */}
      <View style={styles.header}>
        {sections.length > 0 ? (
          <Text variant="titleMedium">
            {t('pantry.summary', { there: thereCount, count: missingCount })}
          </Text>
        ) : null}
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {t('pantry.hint')}
        </Text>
      </View>

      {/* Jede Abteilung liegt auf einer Flaeche in ihrer Kategoriefarbe
          (ADR-049): Kopf, Zeilen und Abschluss sind einzelne Zellen der
          SectionList, die zusammen eine Flaeche ergeben. So bleibt die Liste
          auch bei 200 Produkten virtualisiert.

          Ohne feste Ueberschriften: Eine haftende Ueberschrift wuerde ihre
          gerundete Oberkante ueber die Zeilen darunter schieben, und die
          Flaeche saehe zerschnitten aus. Die Farbe sagt beim Scrollen ohnehin,
          in welcher Abteilung man ist. */}
      <SectionList
        sections={listSections}
        keyExtractor={(item) => item.productId}
        stickySectionHeadersEnabled={false}
        style={styles.list}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : styles.listContent}
        testID="pantry-list"
        renderSectionHeader={({ section }) => {
          const colors = categoryColorFor(theme.categories, section.key);
          return (
            <Text
              variant="titleSmall"
              style={[
                styles.sectionHeader,
                { backgroundColor: colors.container, color: colors.onContainer },
              ]}
            >
              {section.title}
            </Text>
          );
        }}
        renderSectionFooter={() => <View style={styles.sectionGap} />}
        renderItem={({ item, index, section }) => {
          const colors = categoryColorFor(theme.categories, section.key);
          const isLast = index === section.data.length - 1;

          return (
            <View
              style={[
                styles.rowSurface,
                isLast ? styles.rowSurfaceLast : null,
                { backgroundColor: colors.container },
              ]}
            >
              <List.Item
                title={item.name}
                onPress={() => void setInPantry(item.productId, !item.inPantry)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.inPantry }}
                accessibilityLabel={t('pantry.toggle', { name: item.name })}
                testID={`pantry-${item.name}`}
                style={styles.row}
                // Gedaempft ueber die Deckkraft statt ueber eine zweite Farbe:
                // Fuer jede Kategorie ist nur das Paar container/onContainer
                // auf Kontrast geprueft (ADR-049).
                titleStyle={[
                  { color: colors.onContainer },
                  item.inPantry ? null : styles.missingTitle,
                ]}
                left={() => (
                  // Der Haken ist nur Anzeige. Getippt wird die ganze Zeile, und
                  // der Screenreader soll genau ein Kontrollkaestchen hoeren.
                  <View
                    pointerEvents="none"
                    importantForAccessibility="no-hide-descendants"
                    accessibilityElementsHidden
                    style={styles.check}
                  >
                    <Checkbox status={item.inPantry ? 'checked' : 'unchecked'} />
                  </View>
                )}
              />
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty} testID="pantry-empty">
            <Text variant="titleMedium" style={styles.emptyText}>
              {t('pantry.empty')}
            </Text>
            <Text
              variant="bodyMedium"
              style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
            >
              {t('pantry.emptyHint')}
            </Text>
          </View>
        }
      />

      {sections.length > 0 ? (
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Text variant="labelLarge" testID="pantry-missing">
              {missingCount === 0
                ? t('pantry.allThere')
                : t('pantry.missing', { count: missingCount })}
            </Text>
          </View>
          {/* Nebeneinander, wenn Platz ist; bei grosser Systemschrift bricht der
              zweite Knopf in eine eigene Zeile um, statt abgeschnitten zu werden. */}
          <View style={styles.actions}>
            <Button
              mode="contained"
              icon="cart-plus"
              disabled={missingCount === 0 || busy}
              onPress={addMissing}
              testID="pantry-add-missing"
              style={styles.action}
            >
              {t('pantry.addMissing')}
            </Button>
            {/* Vorwaerts in die Rezepte (FR-9.7, ADR-048) - deshalb push. */}
            <Button
              mode="outlined"
              icon="chef-hat"
              onPress={() => router.push('/rezepte')}
              testID="pantry-cook"
              style={styles.action}
            >
              {t('pantry.cook')}
            </Button>
          </View>
        </View>
      ) : null}

      <Snackbar
        visible={message !== null}
        onDismiss={() => setMessage(null)}
        duration={4000}
        testID="pantry-snackbar"
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 2,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  // Oberkante der Gruppenflaeche: 18 dp Rundung, 8 dp Innenabstand. Der Titel
  // rueckt noch einmal 8 dp ein und steht damit ueber den Haken der Zeilen
  // (die Checkbox bringt ihren eigenen Rand mit).
  sectionHeader: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 12,
    paddingBottom: 4,
    paddingHorizontal: 8 + 8,
    overflow: 'hidden',
  },
  rowSurface: {
    paddingHorizontal: 8,
  },
  // Unterkante der Gruppenflaeche. overflow schneidet die Welle der letzten
  // Zeile an der Rundung ab.
  rowSurfaceLast: {
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    paddingBottom: 8,
    overflow: 'hidden',
  },
  sectionGap: {
    height: 10,
  },
  row: {
    minHeight: 56,
    justifyContent: 'center',
  },
  missingTitle: {
    opacity: 0.7,
  },
  check: {
    justifyContent: 'center',
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
  // Wie der Fussbereich der Einkaufsliste (ListScreen), damit beide gleich
  // wirken - seit M18 ohne Trennlinie (ADR-049, Flaechen statt Linien).
  footer: {
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // Waechst in den freien Platz. Reicht die Zeile nicht fuer beide, bricht
  // flexWrap um; flexShrink haelt einen allein stehenden Knopf in der Breite
  // des Screens.
  action: {
    flexGrow: 1,
    flexShrink: 1,
  },
});
