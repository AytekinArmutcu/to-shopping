import { eq } from 'drizzle-orm';

import { db } from './client';
import { appState } from './schema';

/**
 * Schluessel-Wert-Ablage fuer alles, was kein eigenes Schema verdient
 * (architecture.md 3): zuletzt genutzte Route, gesehene Hinweise, Zeitpunkt
 * der letzten Sicherung.
 *
 * Bewusst hier und nicht im Zustand-Store: Der haelt nur UI-Zustand und
 * ueberlebt das Beenden der App nicht (ADR-020) - genau das ist bei diesen
 * Werten aber der Sinn.
 */

export async function getAppState(key: string): Promise<string | null> {
  const found = await db.select().from(appState).where(eq(appState.key, key)).limit(1);
  return found[0]?.value ?? null;
}

export async function setAppState(key: string, value: string): Promise<void> {
  await db
    .insert(appState)
    .values({ key, value })
    .onConflictDoUpdate({ target: appState.key, set: { value } });
}

/** Ja/Nein-Merker, etwa fuer einen Hinweis, der nur einmal erscheinen soll. */
export async function getFlag(key: string): Promise<boolean> {
  return (await getAppState(key)) === 'true';
}

export async function setFlag(key: string, value: boolean): Promise<void> {
  await setAppState(key, value ? 'true' : 'false');
}

export const FIRST_START_KEY = 'first_start_at';

/**
 * Zeitpunkt des allerersten Starts, in Millisekunden.
 *
 * Die Erinnerung an die Sicherung (FR-6.6) braucht einen Anfangspunkt: Ohne
 * ihn muesste sie entweder sofort erscheinen - in einer App, in der es noch
 * nichts zu sichern gibt - oder nie, solange nie gesichert wurde.
 */
export async function ensureFirstStart(now: number = Date.now()): Promise<number> {
  const stored = await getAppState(FIRST_START_KEY);
  const parsed = stored === null ? Number.NaN : Number(stored);

  if (Number.isFinite(parsed)) {
    return parsed;
  }

  await setAppState(FIRST_START_KEY, String(now));
  return now;
}
