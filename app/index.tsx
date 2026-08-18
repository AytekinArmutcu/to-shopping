import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_NAME, currentMilestone } from '@/lib/appInfo';

/**
 * Platzhalter-Startbildschirm fuer M0.
 *
 * Zweck: beweisen, dass die Kette Metro -> Expo Router -> Geraet steht und der
 * E2E-Smoke-Test etwas findet, an dem er sich festhalten kann. Wird in M2 durch
 * den echten Listen-Screen ersetzt.
 */
export default function HomeScreen() {
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
