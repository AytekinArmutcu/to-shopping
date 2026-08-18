import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StartupScreen } from '@/components/StartupScreen';
import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { seedIfEmpty } from '@/db/seed';
import '@/i18n';
import { navigationThemeFor, themeFor } from '@/theme';

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

  useEffect(() => {
    if (!migrated) {
      return;
    }

    let cancelled = false;
    seedIfEmpty(db)
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
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style="auto" />
          {ready && !error ? (
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.colors.background },
              }}
            />
          ) : (
            <StartupScreen error={error ?? null} />
          )}
        </ThemeProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
