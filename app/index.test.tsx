import { render, screen } from '@testing-library/react-native';

import HomeScreen from './index';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('HomeScreen', () => {
  it('zeigt den Namen der App an', () => {
    render(<HomeScreen />);
    expect(screen.getByTestId('home-title')).toHaveTextContent('To-Shopping');
  });
});
