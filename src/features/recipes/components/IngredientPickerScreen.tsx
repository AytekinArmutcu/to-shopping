import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, View } from 'react-native';
import { Appbar, Button, Checkbox, List, Text, useTheme } from 'react-native-paper';

import { catalogProductsQuery, categoriesQuery } from '@/features/catalog/repository';
import { buildPantryChecklist } from '@/features/pantry/logic';
import { pantryQuery } from '@/features/pantry/repository';
import { toProductStats } from '@/features/suggestions/logic';
import { currentStatsQuery } from '@/features/suggestions/repository';
import { goTo } from '@/lib/navigation';

import { formatWithParam, presentPantrySections } from '../logic';

type Props = {
  /** Die schon gewaehlten Produkt-IDs aus dem Routenparameter "with". */
  preselected: string[];
};

/**
 * Zutaten waehlen, zu denen Gerichte gesucht werden (FR-10.12, ADR-048).
 *
 * Nur, was im Vorrat ist: Die Frage ist "was kann ich mit dem kochen, was da
 * ist". Gebaut wie der Vorrat - dieselben Datenquellen, dieselben Abschnitte,
 * dieselben Zeilen -, damit er sich nicht wie ein fremder Screen anfuehlt. Nur
 * heisst ein Haken hier "gewaehlt", nicht "ist da", und geschrieben wird
 * nichts: Die Auswahl reist als Routenparameter zurueck zur Uebersicht.
 */
export function IngredientPickerScreen({ preselected }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  const pantryRows = useLiveQuery(pantryQuery());
  const historyRows = useLiveQuery(currentStatsQuery());
  const catalog = useLiveQuery(catalogProductsQuery());
  const categoryRows = useLiveQuery(categoriesQuery());

  // In der Reihenfolge, in der getippt wurde - so steht es spaeter im Chip.
  const [selected, setSelected] = useState<string[]>(preselected);

  const stats = useMemo(() => toProductStats(historyRows.data ?? []), [historyRows.data]);

  const sections = useMemo(
    () =>
      presentPantrySections(
        buildPantryChecklist(
          catalog.data ?? [],
          stats,
          (pantryRows.data ?? []).map((row) => row.productId),
          categoryRows.data ?? [],
        ),
      ),
    [catalog.data, stats, pantryRows.data, categoryRows.data],
  );

  // SectionList liest die Zeilen aus "data"; die Logik nennt sie "items".
  const listSections = useMemo(
    () => sections.map((section) => ({ ...section, data: section.items })),
    [sections],
  );

  // Was nicht (mehr) im Vorrat steht, ist nicht zu sehen und zaehlt nicht mit.
  const effective = useMemo(() => {
    const visible = new Set(sections.flatMap((section) => section.items.map((i) => i.productId)));
    return selected.filter((id) => visible.has(id));
  }, [sections, selected]);

  const toggle = useCallback((productId: string) => {
    setSelected((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  }, []);

  // Zurueck mit Ergebnis: dismissTo setzt die Parameter an der vorhandenen
  // Uebersicht, statt eine zweite anzulegen (ADR-036, navigation.test.tsx).
  const apply = useCallback(() => {
    if (effective.length === 0) {
      return;
    }
    goTo({ pathname: '/rezepte', params: { with: formatWithParam(effective) } });
  }, [effective]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        {/* Benanntes Ziel statt router.back() (ADR-036). */}
        <Appbar.BackAction
          onPress={() => goTo('/rezepte')}
          accessibilityLabel={t('recipes.pickBack')}
          testID="pick-back"
        />
        <Appbar.Content title={t('recipes.pickTitle')} />
      </Appbar.Header>

      <SectionList
        sections={listSections}
        keyExtractor={(item) => item.productId}
        stickySectionHeadersEnabled
        style={styles.list}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : undefined}
        testID="pick-list"
        renderSectionHeader={({ section }) => (
          <Text
            variant="titleSmall"
            style={[
              styles.sectionHeader,
              { backgroundColor: theme.colors.surface, color: theme.colors.primary },
            ]}
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => {
          const checked = selected.includes(item.productId);
          return (
            <List.Item
              title={item.name}
              onPress={() => toggle(item.productId)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={item.name}
              testID={`pick-${item.name}`}
              style={styles.row}
              left={() => (
                // Der Haken ist nur Anzeige. Getippt wird die ganze Zeile, und
                // der Screenreader soll genau ein Kontrollkaestchen hoeren.
                <View
                  pointerEvents="none"
                  importantForAccessibility="no-hide-descendants"
                  accessibilityElementsHidden
                  style={styles.check}
                >
                  <Checkbox status={checked ? 'checked' : 'unchecked'} />
                </View>
              )}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty} testID="pick-empty">
            <Text variant="titleMedium" style={styles.emptyText}>
              {t('recipes.pickEmpty')}
            </Text>
            <Text
              variant="bodyMedium"
              style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
            >
              {t('recipes.pickEmptyHint')}
            </Text>
            <Button
              mode="outlined"
              // Vorwaerts in den Vorrat - deshalb push.
              onPress={() => router.push('/vorrat')}
              testID="pick-open-pantry"
              style={styles.emptyAction}
            >
              {t('recipes.openPantry')}
            </Button>
          </View>
        }
      />

      {sections.length > 0 ? (
        <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
          <View style={styles.footerRow}>
            <Text variant="labelLarge" testID="pick-count">
              {t('recipes.pickCount', { count: effective.length })}
            </Text>
          </View>
          <Button
            mode="contained"
            disabled={effective.length === 0}
            onPress={apply}
            testID="pick-apply"
          >
            {t('recipes.pickApply')}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  row: {
    minHeight: 56,
    justifyContent: 'center',
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
  emptyAction: {
    alignSelf: 'center',
  },
  // Wie der Fussbereich des Vorrats, damit beide gleich wirken.
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
