import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, View } from 'react-native';
import { Appbar, Button, Checkbox, List, Snackbar, Text, useTheme } from 'react-native-paper';

import { catalogProductsQuery, categoriesQuery } from '@/features/catalog/repository';
import { getOrCreateActiveList } from '@/features/lists/repository';
import { toProductStats } from '@/features/suggestions/logic';
import { currentStatsQuery } from '@/features/suggestions/repository';
import { goTo } from '@/lib/navigation';

import { buildPantryChecklist, missingProductIds } from '../logic';
import { addMissingToList, pantryQuery, setInPantry } from '../repository';

type Props = {
  /** Die Liste, von der aus der Vorrat geoeffnet wurde - Ziel fuer Zurueck und "Auf die Liste". */
  listId?: string;
};

/**
 * Der Vorrat als Checkliste der ueblichen Artikel (ADR-043, T-13.4, PRD Flow 8).
 *
 * Gebaut wie die Produktverwaltung (Abschnitte nach Abteilung, feste
 * Ueberschriften) und mit demselben Fussbereich wie die Einkaufsliste: links
 * der Stand, darunter die eine Aktion. Der Vorrat soll sich nicht wie ein
 * fremdes Modul anfuehlen.
 *
 * Nach "Auf die Liste setzen" bleibt der Screen offen. Wer gerade den
 * Kuehlschrank durchgeht, will vielleicht noch einen Haken korrigieren - der
 * Weg zurueck ist ein Tipp.
 */
export function PantryScreen({ listId }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

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

      <Text variant="bodySmall" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
        {t('pantry.hint')}
      </Text>

      <SectionList
        sections={listSections}
        keyExtractor={(item) => item.productId}
        stickySectionHeadersEnabled
        style={styles.list}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : undefined}
        testID="pantry-list"
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
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            onPress={() => void setInPantry(item.productId, !item.inPantry)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.inPantry }}
            accessibilityLabel={t('pantry.toggle', { name: item.name })}
            testID={`pantry-${item.name}`}
            style={styles.row}
            // Gedaempft, aber lesbar: onSurfaceVariant ist die Rolle fuer
            // zweitrangigen Text und haelt den Kontrast in hell und dunkel.
            titleStyle={item.inPantry ? undefined : { color: theme.colors.onSurfaceVariant }}
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
        )}
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
        <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
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
  hint: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
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
  // Wie der Fussbereich der Einkaufsliste (ListScreen), damit beide gleich wirken.
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
