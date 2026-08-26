import {
  BACKUP_FORMAT,
  BACKUP_TABLES,
  BACKUP_VERSION,
  buildBackup,
  countRows,
  needsBackupReminder,
  parseBackup,
  serializeBackup,
  type BackupData,
} from './backup';

const leer = (): BackupData =>
  Object.fromEntries(BACKUP_TABLES.map((table) => [table, []])) as unknown as BackupData;

const gefuellt = (): BackupData => ({
  ...leer(),
  categories: [{ id: 'obst', name: 'Obst', defaultPosition: 1 }],
  products: [{ id: 'p-milch', name: 'Milch', categoryId: 'obst' }],
  lists: [{ id: 'l-1', name: 'Rewe', position: 0 }],
  listItems: [{ id: 'i-1', listId: 'l-1', name: 'Milch', quantity: 2 }],
});

const TAG = 24 * 60 * 60 * 1000;

describe('buildBackup und serializeBackup', () => {
  it('setzt Format, Version, Schemastand und Zeitpunkt', () => {
    const file = buildBackup(leer(), 3, new Date('2026-08-18T18:22:00Z'));
    expect(file.format).toBe(BACKUP_FORMAT);
    expect(file.version).toBe(BACKUP_VERSION);
    expect(file.schemaVersion).toBe(3);
    expect(file.exportedAt).toBe('2026-08-18T18:22:00.000Z');
  });

  it('enthaelt alle Tabellen aus architecture.md 5.2 (T-9.1)', () => {
    const file = buildBackup(leer(), 1);
    expect(Object.keys(file.data).sort()).toEqual([...BACKUP_TABLES].sort());
  });

  it('nennt app_state nicht - Geraete-Sachen gehoeren nicht in die Sicherung', () => {
    expect([...BACKUP_TABLES]).not.toContain('appState');
  });

  it('erzeugt eine Datei, die sich wieder einlesen laesst', () => {
    const file = buildBackup(gefuellt(), 1);
    const result = parseBackup(serializeBackup(file), 1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.data).toEqual(gefuellt());
    }
  });
});

describe('parseBackup lehnt ab', () => {
  const mit = (overrides: Record<string, unknown>) =>
    parseBackup(
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 1,
        schemaVersion: 1,
        exportedAt: '',
        data: leer(),
        ...overrides,
      }),
      1,
    );

  it('was kein JSON ist', () => {
    expect(parseBackup('kaputt', 1)).toEqual({ ok: false, reason: 'unlesbar' });
  });

  it('ein fremdes Format', () => {
    expect(mit({ format: 'to-shopping.list' })).toEqual({ ok: false, reason: 'fremdesFormat' });
  });

  it('eine Datei aus einer neueren Fassung der App', () => {
    expect(mit({ version: BACKUP_VERSION + 1 })).toEqual({ ok: false, reason: 'zuNeu' });
  });

  it('eine Sicherung aus einem neueren Datenbankstand', () => {
    expect(mit({ schemaVersion: 2 })).toEqual({ ok: false, reason: 'neueresSchema' });
  });

  it('nimmt einen aelteren Datenbankstand an', () => {
    expect(parseBackup(JSON.stringify(buildBackup(leer(), 1)), 5).ok).toBe(true);
  });

  it('eine unsinnige Version oder einen unsinnigen Schemastand', () => {
    expect(mit({ version: 0 })).toEqual({ ok: false, reason: 'unlesbar' });
    expect(mit({ schemaVersion: 'drei' })).toEqual({ ok: false, reason: 'unlesbar' });
  });

  it('eine Datei ohne data-Abschnitt', () => {
    expect(mit({ data: null })).toEqual({ ok: false, reason: 'unlesbar' });
  });

  it('eine Datei, in der eine Tabelle fehlt', () => {
    const ohneListen = { ...leer() } as Record<string, unknown>;
    delete ohneListen.lists;
    expect(mit({ data: ohneListen })).toEqual({ ok: false, reason: 'unlesbar' });
  });

  it('eine Tabelle, die keine Liste von Zeilen ist', () => {
    expect(mit({ data: { ...leer(), lists: 'keine Liste' } })).toEqual({
      ok: false,
      reason: 'unlesbar',
    });
    expect(mit({ data: { ...leer(), lists: [1, 2, 3] } })).toEqual({
      ok: false,
      reason: 'unlesbar',
    });
  });
});

describe('countRows', () => {
  it('zaehlt ueber alle Tabellen', () => {
    expect(countRows(gefuellt())).toBe(4);
  });

  it('zaehlt eine leere Sicherung als null', () => {
    expect(countRows(leer())).toBe(0);
  });
});

describe('needsBackupReminder', () => {
  const start = 1_000_000_000_000;

  it('schweigt in den ersten vierzehn Tagen nach dem ersten Start', () => {
    expect(needsBackupReminder(null, null, start, start + 13 * TAG)).toBe(false);
  });

  it('meldet sich, wenn nie gesichert wurde und die Frist um ist', () => {
    expect(needsBackupReminder(null, null, start, start + 14 * TAG)).toBe(true);
  });

  it('schweigt nach einer frischen Sicherung', () => {
    const gesichert = start + 20 * TAG;
    expect(needsBackupReminder(gesichert, null, start, gesichert + 1 * TAG)).toBe(false);
  });

  it('meldet sich vierzehn Tage nach der letzten Sicherung wieder', () => {
    const gesichert = start + 20 * TAG;
    expect(needsBackupReminder(gesichert, null, start, gesichert + 14 * TAG)).toBe(true);
  });

  it('schweigt nach dem Wegklicken - aber nur fuer eine weitere Frist', () => {
    const weggeklickt = start + 30 * TAG;
    expect(needsBackupReminder(null, weggeklickt, start, weggeklickt + 13 * TAG)).toBe(false);
    expect(needsBackupReminder(null, weggeklickt, start, weggeklickt + 14 * TAG)).toBe(true);
  });

  it('nimmt den spaeteren der beiden Zeitpunkte', () => {
    const gesichert = start + 40 * TAG;
    const weggeklickt = start + 10 * TAG;
    expect(needsBackupReminder(gesichert, weggeklickt, start, gesichert + 5 * TAG)).toBe(false);
  });

  it('laesst sich die Frist vorgeben', () => {
    expect(needsBackupReminder(null, null, start, start + 3 * TAG, 3)).toBe(true);
    expect(needsBackupReminder(null, null, start, start + 2 * TAG, 3)).toBe(false);
  });
});
