import { APP_NAME, currentMilestone } from './appInfo';

describe('appInfo', () => {
  it('kennt den Namen der App', () => {
    expect(APP_NAME).toBe('To-Shopping');
  });

  it('formatiert den Meilenstein lesbar', () => {
    expect(currentMilestone('M3')).toBe('Meilenstein M3');
  });

  it('faellt auf den aktuellen Meilenstein zurueck', () => {
    expect(currentMilestone()).toMatch(/^Meilenstein M\d+$/);
  });
});
