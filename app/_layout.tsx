import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/**
 * Wurzel-Layout der App.
 *
 * Hier werden spaeter Theme (M1), i18n (M1) und der Migrationslauf der
 * Datenbank (M1) eingehaengt. In M0 haelt es nur die Navigation.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
