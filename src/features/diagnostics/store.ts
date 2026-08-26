import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import {
  appendError,
  parseErrorLog,
  serializeErrorLog,
  toErrorEntry,
  type DeviceInfo,
  type ErrorEntry,
} from './logic';

/**
 * Der Fehlerspeicher liegt in einer **Datei**, nicht in der Datenbank
 * (architecture.md 9).
 *
 * Das ist der Kern der Sache: Ein Fehlerspeicher darf nicht von dem abhaengen,
 * was gerade kaputt sein koennte. Waere er eine Tabelle, wuerde ausgerechnet
 * ein Datenbankfehler nicht aufgezeichnet - also genau der Fall, den man am
 * dringendsten sehen will.
 *
 * Im Dokumentenordner und nicht im Zwischenspeicher: Android raeumt den
 * Zwischenspeicher weg, wenn der Platz knapp wird, und dann waere der Bericht
 * verschwunden, bevor jemand ihn ansieht.
 */
const LOG_FILE_NAME = 'fehler.json';

function logFile(): File {
  return new File(Paths.document, LOG_FILE_NAME);
}

export function deviceInfo(): DeviceInfo {
  return {
    appVersion: Constants.expoConfig?.version ?? '?',
    osVersion: String(Platform.Version),
    device: Constants.deviceName ?? '?',
  };
}

/**
 * Liest den Fehlerspeicher.
 *
 * Jeder Fehler beim Lesen endet in einer leeren Liste. Eine fehlende Datei ist
 * der Normalfall - die meisten Nutzer werden nie einen Eintrag haben.
 */
export function readErrorLog(): ErrorEntry[] {
  try {
    const file = logFile();
    return file.exists ? parseErrorLog(file.textSync()) : [];
  } catch {
    return [];
  }
}

/**
 * Schreibt einen Fehler in den Speicher.
 *
 * Bewusst ohne await: Die Aufrufer sind eine Error Boundary und ein globaler
 * Fehler-Haken; beide laufen in einem Moment, in dem die App vielleicht keine
 * Sekunde mehr hat. Die neue Datei-API von Expo schreibt ohnehin synchron.
 *
 * Und dieser Aufruf darf unter keinen Umstaenden selbst werfen: Ein Fehler
 * beim Aufzeichnen eines Fehlers waere eine Schleife, aus der die App nicht
 * mehr herausfindet.
 */
export function recordError(error: unknown): void {
  try {
    const entry = toErrorEntry(error, deviceInfo());
    const next = appendError(readErrorLog(), entry);

    const file = logFile();
    if (!file.exists) {
      file.create();
    }
    file.write(serializeErrorLog(next));
  } catch {
    // Bewusst still.
  }
}

export function clearErrorLog(): void {
  try {
    const file = logFile();
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Bewusst still - siehe recordError.
  }
}
