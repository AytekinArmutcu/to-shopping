import { getTableName } from 'drizzle-orm';
import { addDatabaseChangeListener } from 'expo-sqlite';

import { listItems, lists } from '@/db/schema';

import { refreshWidget } from '../../modules/to-shopping-widget';
import { Debouncer } from './debounce';

/**
 * Haelt das Homescreen-Widget nach Schreibvorgaengen der App aktuell
 * (FR-11.3, ADR-045).
 *
 * Warum ein Listener auf die Datenbank und nicht ein refreshWidget() in jeder
 * Schreibfunktion: Es gibt Dutzende Stellen, die an Listen oder Artikeln
 * schreiben, verteilt ueber mehrere Repositories - abhaken, umbenennen,
 * Einkauf abschliessen, Vorlage anwenden, Rezept einplanen, Import,
 * Wiederherstellung. Gerade die seltenen wie Import und Wiederherstellung
 * vergisst man beim naechsten Umbau leicht, und das Widget zeigt dann still
 * etwas Altes. Der Listener ist die eine Stelle, die JEDEN Schreibvorgang
 * sieht, auch kuenftige: Wer eine neue Schreibfunktion baut, muss an das
 * Widget nicht denken. Voraussetzung ist enableChangeListener in
 * src/db/client.ts - das ist dort ohnehin an (Live-Abfragen, ADR-020).
 */

/** Nur diese Tabellen liest das Widget (ListReader.kt). */
const WIDGET_TABLES: ReadonlySet<string> = new Set([getTableName(lists), getTableName(listItems)]);

/**
 * Wartezeit nach der letzten Aenderung. SQLite meldet jede Zeile einzeln -
 * "Einkauf abschliessen" mit zwanzig Artikeln waeren sonst zwanzig
 * Neuzeichnungen. 500 ms sind kurz genug, dass das Widget beim Blick auf den
 * Startbildschirm schon stimmt, und lang genug fuer eine ganze Transaktion.
 */
export const WIDGET_REFRESH_DELAY_MS = 500;

/**
 * Startet die Beobachtung. Gibt die Funktion zum Beenden zurueck - passend
 * als Rueckgabewert eines useEffect.
 *
 * Erst NACH den Migrationen starten: Die Migration selbst schreibt keine
 * Listen, und vorher gibt es fuer das Widget nichts Lesbares.
 */
export function startWidgetRefresh(): () => void {
  const debouncer = new Debouncer(refreshWidget, WIDGET_REFRESH_DELAY_MS);

  const subscription = addDatabaseChangeListener(({ tableName }) => {
    if (WIDGET_TABLES.has(tableName)) {
      debouncer.trigger();
      return;
    }

    // Andere Tabellen loesen nichts aus - aber sie verschieben ein schon
    // geplantes Update. SQLite meldet Zeilen sofort, nicht erst beim Commit.
    // Die Wiederherstellung schreibt list_items mitten in ihrer Transaktion,
    // danach noch Vorlagen, Historie und Rezepte. Liefe das Update dazwischen
    // los, laese das Widget den Stand VOR dem Commit und bliebe bis zum
    // naechsten 30-Minuten-Takt dabei. So kommt es erst, wenn die Datenbank
    // insgesamt 500 ms Ruhe hat.
    debouncer.postpone();
  });

  return () => {
    subscription.remove();
    // Ein offener Timer wuerde sonst nach dem Abbau noch feuern.
    debouncer.cancel();
  };
}
