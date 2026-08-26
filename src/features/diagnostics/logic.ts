/**
 * Fehlerspeicher und Fehlerbericht (FR-8.1, FR-8.2, architecture.md 9).
 *
 * Reine Funktionen ohne Datenbankzugriff (ADR-008) - hier aus einem zweiten
 * Grund: Der Fehlerspeicher darf nicht von dem abhaengen, was gerade kaputt
 * sein koennte. Deshalb liegt er in einer Datei und nicht in der Datenbank,
 * und deshalb kommt alles Rechnende ohne Umgebung aus.
 */

export type DeviceInfo = {
  appVersion: string;
  osVersion: string;
  device: string;
};

export type ErrorEntry = {
  /** Zeitpunkt als ISO-Zeichenkette. */
  at: string;
  message: string;
  stack: string | null;
  appVersion: string;
  osVersion: string;
  device: string;
};

/** Mehr als das braucht niemand, und mehr passt in keine Nachricht. */
export const MAX_ERROR_ENTRIES = 20;

/**
 * Obergrenzen fuer Meldung und Aufrufkette.
 *
 * Nicht nur wegen der Groesse: Je laenger der Text, desto groesser die Gefahr,
 * dass versehentlich Inhalte des Nutzers darin landen - ein Produktname in
 * einer Fehlermeldung etwa. Der Bericht soll die App beschreiben, nicht den
 * Einkauf (compliance.md, Datensparsamkeit).
 */
export const MAX_MESSAGE_LENGTH = 300;
export const MAX_STACK_LENGTH = 2000;

export function toErrorEntry(
  error: unknown,
  device: DeviceInfo,
  at: Date = new Date(),
): ErrorEntry {
  const asError = error instanceof Error ? error : null;

  return {
    at: at.toISOString(),
    message: cut(asError?.message ?? String(error), MAX_MESSAGE_LENGTH),
    stack: asError?.stack === undefined ? null : cut(asError.stack, MAX_STACK_LENGTH),
    appVersion: device.appVersion,
    osVersion: device.osVersion,
    device: device.device,
  };
}

function cut(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

/**
 * Haengt einen Eintrag an - der neueste zuerst, aeltere fallen hinten heraus.
 *
 * Neueste zuerst, weil im Diagnose-Screen der letzte Absturz der interessante
 * ist und niemand erst scrollen soll.
 */
export function appendError(
  entries: ErrorEntry[],
  entry: ErrorEntry,
  max: number = MAX_ERROR_ENTRIES,
): ErrorEntry[] {
  return [entry, ...entries].slice(0, max);
}

export function serializeErrorLog(entries: ErrorEntry[]): string {
  return JSON.stringify(entries);
}

/**
 * Liest den Fehlerspeicher.
 *
 * Gibt bei allem Unlesbaren eine leere Liste zurueck statt eines Fehlers: Ein
 * kaputter Fehlerspeicher darf nicht der Grund fuer den naechsten Absturz
 * sein. Das waere die peinlichste aller Fehlerquellen.
 */
export function parseErrorLog(raw: string): ErrorEntry[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter(isEntry).slice(0, MAX_ERROR_ENTRIES);
}

function isEntry(value: unknown): value is ErrorEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return typeof entry.at === 'string' && typeof entry.message === 'string';
}

export type ReportLabels = {
  /** Kopfzeile, z. B. 'Fehlerbericht To-Shopping'. */
  header: string;
  /** Zeile, wenn es nichts zu berichten gibt. */
  empty: string;
  /** Hinweis, dass keine Listeninhalte enthalten sind. */
  privacy: string;
};

/**
 * Baut den Text, den der Nutzer an den Entwickler schicken **kann** (FR-8.2).
 *
 * Kein Drittanbieter, keine automatische Uebertragung (architecture.md 9): Der
 * Bericht landet im Teilen-Menue, und der Nutzer entscheidet, ob und an wen er
 * ihn schickt. Deshalb steht der Datenschutzhinweis auch im Text selbst und
 * nicht nur auf dem Bildschirm - er reist mit und ist noch da, wenn jemand die
 * Nachricht spaeter weiterleitet.
 */
export function buildReport(entries: ErrorEntry[], labels: ReportLabels): string {
  if (entries.length === 0) {
    return [labels.header, '', labels.empty].join('\n');
  }

  const first = entries[0];
  const kopf = [
    labels.header,
    '',
    `App: ${first?.appVersion ?? '?'}`,
    `Android: ${first?.osVersion ?? '?'}`,
    `Gerät: ${first?.device ?? '?'}`,
    '',
    labels.privacy,
  ];

  const bloecke = entries.map((entry, index) =>
    [
      '',
      `--- ${index + 1}/${entries.length} · ${entry.at} ---`,
      entry.message,
      entry.stack ?? '',
    ].join('\n'),
  );

  return [...kopf, ...bloecke].join('\n');
}
