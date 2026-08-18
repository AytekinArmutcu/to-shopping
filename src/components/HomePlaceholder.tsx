import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_NAME, currentMilestone } from '@/lib/appInfo';

/**
 * Platzhalter-Inhalt fuer M0.
 *
 * Zweck: beweisen, dass die Kette Metro -> Expo Router -> Geraet steht und der
 * E2E-Smoke-Test etwas findet, an dem er sich festhalten kann. Wird in M2 durch
 * den echten Listen-Screen ersetzt.
 *
 * Liegt bewusst unter src/ und nicht unter app/: Alles in app/ ist eine Route,
 * und nur dort duerfen keine Testdateien liegen (siehe CLAUDE.md).
 */
export default function HomePlaceholder() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]} testID="home-screen">
      <Text style={styles.title} testID="home-title">
        {APP_NAME}
      </Text>
      <Text style={styles.subtitle}>{currentMilestone()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    opacity: 0.7,
  },
});
