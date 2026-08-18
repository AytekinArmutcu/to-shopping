import { render, screen } from '@testing-library/react-native';

import HomePlaceholder from './HomePlaceholder';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('HomePlaceholder', () => {
  it('zeigt den Namen der App an', () => {
    render(<HomePlaceholder />);
    expect(screen.getByTestId('home-title')).toHaveTextContent('To-Shopping');
  });
});
