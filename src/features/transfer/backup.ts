/**
 * Die Vollsicherung (`.tsb`, architecture.md 5.2).
 *
 * Anders als die geteilte Liste enthaelt sie **echte IDs**: Sie stellt den
 * vollstaendigen Zustand wieder her und muss dabei die Verknuepfungen zwischen
 * Listen, Artikeln, Produkten und Kategorien treffen.
 *
 * Reine Funktionen ohne Datenbankzugriff (ADR-008). Das ist hier die einzige
 * Moeglichkeit, das Format zu pruefen, ohne ein Geraet plattzumachen.
 */

export const BACKUP_FORMAT = 'to-shopping.backup';
export const BACKUP_VERSION = 1;
export const BACKUP_EXTENSION = 'tsb';

/**
 * Die Tabellen der Sicherung, in der Reihenfolge, in der sie geschrieben
 * werden muessen: Erst das, worauf andere zeigen.
 *
 * `app_state` fehlt bewusst (architecture.md 5.2). Dort stehen Geraete-Sachen -
 * zuletzt genutzte Route, gesehene Hinweise, Zeitpunkt der letzten Sicherung.
 * Sie auf ein anderes Geraet zu tragen waere sinnlos bis stoerend.
 */
export const BACKUP_TABLES = [
  'categories',
  'products',
  'lists',
  'listCategoryOrder',
  'listItems',
  'templates',
  'templateItems',
  'purchaseHistory',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export type BackupData = Record<BackupTable, Record<string, unknown>[]>;

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  schemaVersion: number;
  data: BackupData;
};

export type BackupFailure =
  | 'unlesbar'
  | 'fremdesFormat'
  /** Aus einer neueren Fassung der App. */
  | 'zuNeu'
  /** Aus einem neueren Datenbankstand - Spalten, die diese App nicht kennt. */
  | 'neueresSchema';

export type BackupParseResult =
  { ok: true; file: BackupFile } | { ok: false; reason: BackupFailure };

export function buildBackup(
  data: BackupData,
  schemaVersion: number,
  exportedAt: Date = new Date(),
): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    schemaVersion,
    data,
  };
}

export function serializeBackup(file: BackupFile): string {
  // Ohne Einrueckung: Eine Sicherung kann Zehntausende Zeilen enthalten, und
  // sie ist nicht zum Lesen gedacht, sondern zum Zurueckspielen. Die geteilte
  // Liste wird eingerueckt, die Sicherung nicht.
  return JSON.stringify(file);
}

/**
 * Liest eine Sicherungsdatei.
 *
 * Strenger als beim Einlesen einer geteilten Liste: Dort werden kaputte
 * Eintraege uebersprungen, hier wird die ganze Datei abgelehnt. Der Grund ist
 * die Wirkung - eine Wiederherstellung **ersetzt** den vorhandenen Bestand.
 * Eine halb gelesene Sicherung wuerde alles loeschen und nur einen Teil
 * zurueckbringen, und das faellt erst auf, wenn es zu spaet ist.
 */
export function parseBackup(raw: string, currentSchemaVersion: number): BackupParseResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'unlesbar' };
  }

  if (!isRecord(parsed)) {
    return { ok: false, reason: 'unlesbar' };
  }

  if (parsed.format !== BACKUP_FORMAT) {
    return { ok: false, reason: 'fremdesFormat' };
  }

  const version = parsed.version;
  if (typeof version !== 'number' || !Number.isFinite(version) || version < 1) {
    return { ok: false, reason: 'unlesbar' };
  }
  if (version > BACKUP_VERSION) {
    return { ok: false, reason: 'zuNeu' };
  }

  const schemaVersion = parsed.schemaVersion;
  if (typeof schemaVersion !== 'number' || !Number.isFinite(schemaVersion) || schemaVersion < 1) {
    return { ok: false, reason: 'unlesbar' };
  }
  if (schemaVersion > currentSchemaVersion) {
    // Die Datei kennt Spalten, die es hier noch nicht gibt. Zurueckspielen
    // hiesse, sie stillschweigend zu verlieren - und der Nutzer haette danach
    // eine Sicherung, die weniger enthaelt als die vorige.
    return { ok: false, reason: 'neueresSchema' };
  }

  const data = parsed.data;
  if (!isRecord(data)) {
    return { ok: false, reason: 'unlesbar' };
  }

  const tables = {} as BackupData;

  for (const table of BACKUP_TABLES) {
    const rows = data[table];

    if (!Array.isArray(rows) || !rows.every(isRecord)) {
      return { ok: false, reason: 'unlesbar' };
    }

    tables[table] = rows;
  }

  return {
    ok: true,
    file: {
      format: BACKUP_FORMAT,
      version,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
      schemaVersion,
      data: tables,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Wie viele Zeilen enthaelt die Sicherung insgesamt? Fuer die Rueckfrage. */
export function countRows(data: BackupData): number {
  return BACKUP_TABLES.reduce((sum, table) => sum + data[table].length, 0);
}

/* ------------------------------------------------------------------ *
 * Erinnerung an die Sicherung (FR-6.6, T-9.3)
 * ------------------------------------------------------------------ */

export const BACKUP_REMINDER_DAYS = 14;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Soll der Hinweisstreifen erscheinen (FR-6.6)?
 *
 * Er erscheint auch, wenn **nie** gesichert wurde - das ist der gefaehrlichste
 * Zustand von allen und zugleich der haeufigste. Ohne Cloud-Sicherung (ADR-004)
 * bedeutet ein verlorenes Telefon sonst den Verlust aller Daten; das ist
 * Risiko R3 im PRD, und dieser Streifen ist die Gegenmassnahme.
 *
 * Wegklicken verschiebt ihn um dieselbe Frist, statt ihn fuer immer
 * abzuschalten: Ein Hinweis, der sich endgueltig abschalten laesst, ist beim
 * ersten Wegtippen tot - und genau dann wird er noch gebraucht.
 *
 * Die erste Frist zaehlt ab dem ersten Start und nicht ab null, damit der
 * Streifen nicht schon in der ersten Minute erscheint, in der es noch nichts
 * zu sichern gibt.
 */
export function needsBackupReminder(
  lastBackupAt: number | null,
  dismissedAt: number | null,
  firstStartAt: number,
  now: number,
  days: number = BACKUP_REMINDER_DAYS,
): boolean {
  const frist = days * DAY_IN_MS;
  const seit = Math.max(lastBackupAt ?? firstStartAt, dismissedAt ?? 0);

  return now - seit >= frist;
}
