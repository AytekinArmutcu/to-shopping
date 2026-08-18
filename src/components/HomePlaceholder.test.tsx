import { render, screen } from '@testing-library/react-native';

import '@/i18n';

import HomePlaceholder from './HomePlaceholder';

// Nur der Hook wird ersetzt, den die Komponente tatsaechlich benutzt.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Bewusst ohne PaperProvider: Die Paper-Komponenten greifen ohne Provider auf
// das Standard-Theme zurueck, und der Provider zoege Safe-Area-Kontexte nach,
// die dieser Test nicht braucht. Geprueft wird hier der Text, nicht die Farbe -
// das Aussehen gehoert in die manuelle Abnahme (Quality Gate 5).
function renderScreen(productCount: number, categoryCount: number) {
  return render(<HomePlaceholder productCount={productCount} categoryCount={categoryCount} />);
}

describe('HomePlaceholder', () => {
  it('zeigt den Namen der App aus der Uebersetzungsdatei', () => {
    renderScreen(200, 12);
    expect(screen.getByTestId('home-title')).toHaveTextContent('To-Shopping');
  });

  it('setzt die Zahlen aus der Datenbank in den Text ein', () => {
    renderScreen(200, 12);
    expect(screen.getByTestId('home-db-summary')).toHaveTextContent(
      '200 Produkte in 12 Kategorien',
    );
  });

  it('kommt mit einer leeren Datenbank zurecht', () => {
    renderScreen(0, 0);
    expect(screen.getByTestId('home-db-summary')).toHaveTextContent('0 Produkte in 0 Kategorien');
  });
});
