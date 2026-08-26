import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { serializeSharedList, shareFileName, type SharedListFile } from './logic';

/**
 * Der Weg nach draussen: Datei schreiben und das Android-Teilen-Menue oeffnen
 * (FR-6.1, PRD Flow 3).
 *
 * Bewusst getrennt von logic.ts: Hier steckt alles, was ein Geraet braucht,
 * und nichts davon laesst sich im Unit-Test pruefen. Was pruefbar ist - Format,
 * Text, Dateiname - liegt nebenan und ist dort getestet.
 */

/**
 * Die Datei landet im Zwischenspeicher, nicht im Dokumentenordner.
 *
 * Sie wird nur weitergereicht; nach dem Teilen hat sie keinen Zweck mehr. Im
 * Zwischenspeicher raeumt Android sie selbst weg, wenn der Platz knapp wird -
 * im Dokumentenordner wuerde sich mit jedem Teilen eine Datei ansammeln, die
 * niemand je wieder oeffnet.
 */
function writeSharedFile(file: SharedListFile, fallbackName: string): File {
  const target = new File(Paths.cache, shareFileName(file.list.name, fallbackName));

  // Ueberschreiben statt anhaengen: Wer dieselbe Liste zweimal teilt, soll
  // nicht die alte Fassung verschicken.
  if (target.exists) {
    target.delete();
  }

  target.create();
  target.write(serializeSharedList(file));

  return target;
}

export type ShareOutcome = 'geteilt' | 'nichtVerfuegbar';

/**
 * Verschickt Datei und lesbaren Text zusammen (PRD Flow 3.3).
 *
 * Android reicht beim Teilen einer Datei je nach Empfaenger-App auch einen
 * Text mit durch; wo das nicht geht, bleibt wenigstens die Datei. Der Text ist
 * fuer Empfaenger ohne App gedacht, die Datei fuer Empfaenger mit App.
 */
export async function shareList(
  file: SharedListFile,
  text: string,
  fallbackName: string,
  dialogTitle: string,
): Promise<ShareOutcome> {
  if (!(await Sharing.isAvailableAsync())) {
    return 'nichtVerfuegbar';
  }

  const target = writeSharedFile(file, fallbackName);

  await Sharing.shareAsync(target.uri, {
    // application/json und nicht octet-stream: Messenger zeigen die Datei
    // dann als Dokument an, statt sie als unbekannten Anhang zu behandeln.
    mimeType: 'application/json',
    dialogTitle,
    UTI: 'public.json',
  });

  return 'geteilt';
}

/**
 * Liest eine empfangene Datei ein.
 *
 * Der Pfad kommt als content://-Adresse aus dem Teilen-Menue des Absenders und
 * gehoert nicht uns - deshalb nur lesen, und Fehler abfangen: Die Freigabe
 * kann abgelaufen sein, wenn der Nutzer die App zwischendurch geschlossen hat.
 */
export async function readSharedFile(uri: string): Promise<string | null> {
  try {
    return await new File(uri).text();
  } catch {
    return null;
  }
}

/**
 * Laesst den Nutzer selbst eine Datei aussuchen.
 *
 * Der zweite Weg neben dem Antippen im Messenger - und der verlaesslichere:
 * Ob eine fremde App unsere Datei ueberhaupt an uns weiterreicht, haengt an
 * ihrem Umgang mit Dateitypen. Der Dateiauswaehler haengt an nichts.
 */
export async function pickSharedFile(): Promise<string | null> {
  const result = await File.pickFileAsync({
    // Unbekannte Endungen reicht Android haeufig als octet-stream durch;
    // ohne diesen Eintrag waere die eigene Datei im Auswaehler ausgegraut.
    mimeTypes: ['application/json', 'application/octet-stream'],
  });

  if (result.canceled) {
    return null;
  }

  try {
    return await result.result.text();
  } catch {
    return null;
  }
}
