import {
  appendError,
  buildReport,
  MAX_ERROR_ENTRIES,
  MAX_MESSAGE_LENGTH,
  MAX_STACK_LENGTH,
  parseErrorLog,
  serializeErrorLog,
  toErrorEntry,
  type ErrorEntry,
} from './logic';

const geraet = { appVersion: '1.0.0', osVersion: '16', device: 'SM-S928U1' };

const eintrag = (overrides: Partial<ErrorEntry> = {}): ErrorEntry => ({
  at: '2026-08-26T10:00:00.000Z',
  message: 'Kaputt',
  stack: 'at irgendwo',
  ...geraet,
  ...overrides,
});

describe('toErrorEntry', () => {
  it('uebernimmt Meldung, Aufrufkette und Geraeteangaben', () => {
    const fehler = new Error('Etwas ging schief');
    const entry = toErrorEntry(fehler, geraet, new Date('2026-08-26T10:00:00Z'));

    expect(entry.message).toBe('Etwas ging schief');
    expect(entry.stack).toContain('Error');
    expect(entry.at).toBe('2026-08-26T10:00:00.000Z');
    expect(entry.appVersion).toBe('1.0.0');
  });

  it('kommt auch mit etwas zurecht, das kein Fehler ist', () => {
    expect(toErrorEntry('nur ein Text', geraet).message).toBe('nur ein Text');
    expect(toErrorEntry('nur ein Text', geraet).stack).toBeNull();
    expect(toErrorEntry(undefined, geraet).message).toBe('undefined');
  });

  it('kuerzt sehr lange Meldungen und Aufrufketten', () => {
    const lang = new Error('x'.repeat(1000));
    lang.stack = 'y'.repeat(5000);
    const entry = toErrorEntry(lang, geraet);

    expect(entry.message.length).toBe(MAX_MESSAGE_LENGTH + 1);
    expect(entry.stack?.length).toBe(MAX_STACK_LENGTH + 1);
  });
});

describe('appendError', () => {
  it('stellt den neuesten Eintrag nach vorn', () => {
    const alt = eintrag({ message: 'alt' });
    const neu = eintrag({ message: 'neu' });
    expect(appendError([alt], neu).map((e) => e.message)).toEqual(['neu', 'alt']);
  });

  it('behaelt hoechstens zwanzig Eintraege (FR-8.1)', () => {
    let log: ErrorEntry[] = [];
    for (let i = 0; i < 30; i += 1) {
      log = appendError(log, eintrag({ message: `Fehler ${i}` }));
    }

    expect(log).toHaveLength(MAX_ERROR_ENTRIES);
    expect(log[0]?.message).toBe('Fehler 29');
    expect(log[MAX_ERROR_ENTRIES - 1]?.message).toBe('Fehler 10');
  });

  it('laesst sich die Obergrenze vorgeben', () => {
    expect(appendError([eintrag(), eintrag()], eintrag(), 2)).toHaveLength(2);
  });
});

describe('parseErrorLog', () => {
  it('liest, was serializeErrorLog geschrieben hat', () => {
    const log = [eintrag({ message: 'a' }), eintrag({ message: 'b' })];
    expect(parseErrorLog(serializeErrorLog(log))).toEqual(log);
  });

  it('liefert bei Unlesbarem eine leere Liste statt eines Fehlers', () => {
    expect(parseErrorLog('kaputt')).toEqual([]);
    expect(parseErrorLog('')).toEqual([]);
    expect(parseErrorLog('{"nicht":"array"}')).toEqual([]);
    expect(parseErrorLog('null')).toEqual([]);
  });

  it('wirft Eintraege weg, die keine sind', () => {
    const gemischt = JSON.stringify([eintrag(), null, 'text', { message: 'ohne Zeitpunkt' }, 42]);
    expect(parseErrorLog(gemischt)).toHaveLength(1);
  });

  it('kappt einen zu langen Speicher', () => {
    const zuViele = JSON.stringify(Array.from({ length: 50 }, () => eintrag()));
    expect(parseErrorLog(zuViele)).toHaveLength(MAX_ERROR_ENTRIES);
  });
});

describe('buildReport', () => {
  const labels = {
    header: 'Fehlerbericht To-Shopping',
    empty: 'Keine Fehler gespeichert.',
    privacy: 'Der Bericht enthält keine Einkaufslisten.',
  };

  it('sagt es, wenn es nichts zu berichten gibt', () => {
    const report = buildReport([], labels);
    expect(report).toContain('Keine Fehler gespeichert.');
  });

  it('nennt App, Android und Geraet', () => {
    const report = buildReport([eintrag()], labels);
    expect(report).toContain('App: 1.0.0');
    expect(report).toContain('Android: 16');
    expect(report).toContain('Gerät: SM-S928U1');
  });

  it('enthaelt den Datenschutzhinweis im Text selbst', () => {
    expect(buildReport([eintrag()], labels)).toContain('keine Einkaufslisten');
  });

  it('nummeriert die Eintraege', () => {
    const report = buildReport(
      [eintrag({ message: 'erster' }), eintrag({ message: 'zweiter' })],
      labels,
    );
    expect(report).toContain('--- 1/2 ·');
    expect(report).toContain('--- 2/2 ·');
    expect(report).toContain('erster');
    expect(report).toContain('zweiter');
  });

  it('kommt ohne Aufrufkette zurecht', () => {
    expect(() => buildReport([eintrag({ stack: null })], labels)).not.toThrow();
  });
});
