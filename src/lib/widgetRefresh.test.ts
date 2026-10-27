import { addDatabaseChangeListener, type DatabaseChangeEvent } from 'expo-sqlite';

import { refreshWidget } from '../../modules/to-shopping-widget';
import { startWidgetRefresh, WIDGET_REFRESH_DELAY_MS } from './widgetRefresh';

jest.mock('expo-sqlite', () => ({ addDatabaseChangeListener: jest.fn() }));
jest.mock('../../modules/to-shopping-widget', () => ({ refreshWidget: jest.fn() }));

const addListener = jest.mocked(addDatabaseChangeListener);
const refresh = jest.mocked(refreshWidget);
const remove = jest.fn();

/** Startet die Beobachtung und liefert den Listener, den sie angemeldet hat. */
function start(): { emit: (tableName: string) => void; stop: () => void } {
  const stop = startWidgetRefresh();
  const listener = addListener.mock.calls.at(-1)?.[0];
  if (listener === undefined) {
    throw new Error('kein Listener angemeldet');
  }
  const emit = (tableName: string) => {
    const event: DatabaseChangeEvent = {
      databaseName: 'main',
      databaseFilePath: '/data/to-shopping.db',
      tableName,
      rowId: 1,
    };
    listener(event);
  };
  return { emit, stop };
}

describe('startWidgetRefresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    addListener.mockReset();
    addListener.mockReturnValue({ remove });
    refresh.mockReset();
    remove.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('aktualisiert nach Aenderungen an lists und list_items, entprellt', () => {
    const { emit } = start();

    emit('list_items');
    emit('list_items');
    emit('lists');
    jest.advanceTimersByTime(WIDGET_REFRESH_DELAY_MS - 1);
    expect(refresh).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('ignoriert Aenderungen an anderen Tabellen', () => {
    const { emit } = start();

    emit('products');
    emit('purchase_history');
    emit('app_state');
    jest.advanceTimersByTime(10 * WIDGET_REFRESH_DELAY_MS);

    expect(refresh).not.toHaveBeenCalled();
  });

  it('wartet, bis eine laufende Transaktion auch andere Tabellen fertig hat', () => {
    const { emit } = start();

    // Wie die Wiederherstellung: erst Artikel, danach weitere Tabellen.
    emit('list_items');
    jest.advanceTimersByTime(400);
    emit('purchase_history');
    jest.advanceTimersByTime(400);
    expect(refresh).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('meldet den Listener beim Beenden ab und verwirft einen offenen Timer', () => {
    const { emit, stop } = start();

    emit('lists');
    stop();
    jest.advanceTimersByTime(10 * WIDGET_REFRESH_DELAY_MS);

    expect(remove).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });
});
