import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ComponentProps } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import type { IconProps } from 'react-native-paper/lib/typescript/components/MaterialCommunityIcon';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StartupScreen } from '@/components/StartupScreen';
import { ErrorBoundary } from '@/features/diagnostics/components/ErrorBoundary';
import { IncomingFileWatcher } from '@/features/transfer/IncomingFileWatcher';
import { ensureFirstStart } from '@/db/appState';
import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { seedIfEmpty, seedRecipesOnce } from '@/db/seed';
import '@/i18n';
import { startWidgetRefresh } from '@/lib/widgetRefresh';
import { navigationThemeFor, themeFor } from '@/theme';

/**
 * React Native Paper erwartet standardmaessig react-native-vector-icons.
 * Unter Expo heisst das Paket @expo/vector-icons - ohne diese Zuweisung
 * bleiben alle Symbole leere Kaestchen. Faellt weder im Typecheck noch im
 * Lint noch in den Unit-Tests auf, nur beim Hinsehen.
 */
const paperSettings = {
  icon: ({ name, color, size, ...rest }: IconProps) => (
    <MaterialCommunityIcons
      {...rest}
      name={name as ComponentProps<typeof MaterialCommunityIcons>['name']}
      color={color}
      size={size}
    />
  ),
};

/**
 * Wurzel-Layout: haelt Theme, Texte und die Datenbank.
 *
 * Reihenfolge ist nicht beliebig: Erst laufen die Migrationen, danach der
 * Startkatalog. Ein Seed vor der Migration wuerde in Tabellen schreiben, die
 * es noch nicht gibt.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = themeFor(colorScheme);
  const navigationTheme = navigationThemeFor(colorScheme);

  const { success: migrated, error: migrationError } = useMigrations(db, migrations);
  const [seeded, setSeeded] = useState(false);
  const [seedError, setSeedError] = useState<Error | null>(null);

  // Widget nachziehen, sobald die App an Listen oder Artikeln schreibt
  // (FR-11.3). Eine Stelle fuer alle Schreibvorgaenge, Begruendung in
  // src/lib/widgetRefresh.ts. Nach der Migration und vor dem Seed: So sieht
  // das Widget auch die Standardliste, die der erste Start anlegt.
  useEffect(() => {
    if (!migrated) {
      return;
    }
    return startWidgetRefresh();
  }, [migrated]);

  useEffect(() => {
    if (!migrated) {
      return;
    }

    let cancelled = false;
    seedIfEmpty(db)
      // Der Rezept-Grundstock kommt auf Bestandsgeraeten erst mit diesem Update;
      // er wird einmalig gesaet, nach dem Katalog, dessen Produkte er braucht.
      .then(() => seedRecipesOnce(db))
      // Der Zeitpunkt des ersten Starts wird gleich mit festgehalten: Die
      // Erinnerung an die Sicherung (FR-6.6) braucht einen Anfangspunkt, und
      // hier ist die erste Stelle, an der die Datenbank bereitsteht.
      .then(() => ensureFirstStart())
      .then(() => {
        if (!cancelled) {
          setSeeded(true);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSeedError(error instanceof Error ? error : new Error(String(error)));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [migrated]);

  const error = migrationError ?? seedError;
  const ready = migrated && seeded;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme} settings={paperSettings}>
          {/* Die Error Boundary liegt innerhalb des Themes: Der Fehlerbildschirm
              soll aussehen wie die App und nicht wie ein Systemdialog. */}
          <ThemeProvider value={navigationTheme}>
            <StatusBar style="auto" />
            <ErrorBoundary>
              {ready && !error ? (
                <>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: theme.colors.background },
                    }}
                  />
                  <IncomingFileWatcher />
                </>
              ) : (
                <StartupScreen error={error ?? null} />
              )}
            </ErrorBoundary>
          </ThemeProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
