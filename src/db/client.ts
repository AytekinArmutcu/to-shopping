import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export const DATABASE_NAME = 'to-shopping.db';

/**
 * Eine einzige Datenbankverbindung fuer die gesamte App.
 *
 * enableChangeListener sorgt dafuer, dass Live-Abfragen sich nach jedem
 * Schreibvorgang von selbst aktualisieren - deshalb muss der Zustand-Store
 * keine Daten spiegeln (ADR-020).
 *
 * Fremdschluessel sind in SQLite standardmaessig AUS. Ohne das PRAGMA wuerden
 * die Kaskaden im Schema stillschweigend nicht greifen: Beim Loeschen einer
 * Liste blieben ihre Artikel als Waisen zurueck.
 */
const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
sqlite.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });

export type Database = typeof db;
