import { Component, type ErrorInfo, type ReactNode } from 'react';
import { withTranslation, type WithTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { recordError } from '../store';

type Props = WithTranslation & {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

/**
 * Faengt Abstuerze der Oberflaeche ab (FR-8.1, architecture.md 9).
 *
 * Muss eine Klassenkomponente sein: `componentDidCatch` und
 * `getDerivedStateFromError` gibt es in React nur dort. Deshalb auch
 * `withTranslation` statt des Hooks - Hooks laufen in Klassen nicht.
 *
 * **Was sie nicht kann:** Abstuerze im nativen Teil abfangen. Der Fehler, der
 * in M5 die App umgebracht hat, entstand beim Einhaengen der Views durch
 * React Native selbst - davon erfaehrt JavaScript nichts mehr. Diese Grenze
 * ist wichtig zu kennen: Die Error Boundary ist ein Netz fuer Fehler im
 * eigenen Code, kein Schutz gegen alles.
 */
class ErrorBoundaryBase extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Die Komponentenkette gehoert zur Diagnose: Sie sagt, wo es passiert ist,
    // und enthaelt keine Nutzerdaten - nur Komponentennamen.
    recordError(new Error(`${error.message}\n${info.componentStack ?? ''}`, { cause: error }));
  }

  override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { t } = this.props;

    return (
      <View style={styles.container} testID="crash-screen">
        <Text variant="headlineSmall" style={styles.centered}>
          {t('crash.title')}
        </Text>
        <Text variant="bodyMedium" style={styles.centered}>
          {t('crash.hint')}
        </Text>
        {/* Kein Neustart der App, nur ein neuer Versuch der Oberflaeche: Die
            Daten liegen in der Datenbank und sind von dem Fehler nicht
            betroffen. */}
        <Button mode="contained" onPress={() => this.setState({ hasError: false })}>
          {t('crash.restart')}
        </Button>
      </View>
    );
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryBase);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  centered: {
    textAlign: 'center',
  },
});
