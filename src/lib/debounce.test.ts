import { Debouncer } from './debounce';

const DELAY = 500;

describe('Debouncer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ruft nach der Ruhepause genau einmal auf', () => {
    const action = jest.fn();
    const debouncer = new Debouncer(action, DELAY);

    debouncer.trigger();
    jest.advanceTimersByTime(DELAY - 1);
    expect(action).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(action).toHaveBeenCalledTimes(1);

    // Ohne neuen Ausloeser kommt auch nach langer Ruhe nichts nach.
    jest.advanceTimersByTime(10 * DELAY);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('macht aus zwei Ausloesern innerhalb der Wartezeit einen Aufruf', () => {
    const action = jest.fn();
    const debouncer = new Debouncer(action, DELAY);

    debouncer.trigger();
    jest.advanceTimersByTime(300);
    debouncer.trigger();

    // 500 ms nach dem ERSTEN Ausloeser: noch nichts, der zweite hat verschoben.
    jest.advanceTimersByTime(200);
    expect(action).not.toHaveBeenCalled();

    // 500 ms nach dem zweiten (letzter gewinnt).
    jest.advanceTimersByTime(300);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('ruft fuer Ausloeser mit Ruhe dazwischen jeweils einmal auf', () => {
    const action = jest.fn();
    const debouncer = new Debouncer(action, DELAY);

    debouncer.trigger();
    jest.advanceTimersByTime(DELAY);
    debouncer.trigger();
    jest.advanceTimersByTime(DELAY);

    expect(action).toHaveBeenCalledTimes(2);
  });

  it('plant mit postpone allein nichts', () => {
    const action = jest.fn();
    const debouncer = new Debouncer(action, DELAY);

    debouncer.postpone();
    jest.advanceTimersByTime(10 * DELAY);

    expect(action).not.toHaveBeenCalled();
    expect(debouncer.pending).toBe(false);
  });

  it('verschiebt mit postpone einen geplanten Aufruf', () => {
    const action = jest.fn();
    const debouncer = new Debouncer(action, DELAY);

    debouncer.trigger();
    jest.advanceTimersByTime(400);
    debouncer.postpone();
    jest.advanceTimersByTime(400);
    expect(action).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('verwirft mit cancel einen geplanten Aufruf', () => {
    const action = jest.fn();
    const debouncer = new Debouncer(action, DELAY);

    debouncer.trigger();
    expect(debouncer.pending).toBe(true);
    debouncer.cancel();
    jest.advanceTimersByTime(10 * DELAY);

    expect(action).not.toHaveBeenCalled();
    expect(debouncer.pending).toBe(false);
  });

  it('zaehlt einen Ausloeser aus der Aktion heraus als neuen', () => {
    let calls = 0;
    const debouncer: Debouncer = new Debouncer(() => {
      calls += 1;
      if (calls === 1) {
        debouncer.trigger();
      }
    }, DELAY);

    debouncer.trigger();
    jest.advanceTimersByTime(DELAY);
    expect(calls).toBe(1);
    expect(debouncer.pending).toBe(true);

    jest.advanceTimersByTime(DELAY);
    expect(calls).toBe(2);
  });
});
