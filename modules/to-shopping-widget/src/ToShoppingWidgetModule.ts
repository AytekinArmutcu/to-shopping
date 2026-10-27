import { requireOptionalNativeModule } from 'expo';

/**
 * Bruecke zum nativen Widget-Modul (Kotlin unter android/, ADR-045).
 * Der Name muss zu Name("ToShoppingWidget") in ToShoppingWidgetModule.kt passen.
 */
type ToShoppingWidgetNativeModule = {
  refreshWidget(): void;
};

// "optional" statt requireNativeModule: In Jest, im Web und auf iOS gibt es
// das Modul nicht. requireNativeModule wuerde schon beim Import werfen und
// jede Datei mitreissen, die refreshWidget importiert. So wird der Aufruf
// dort zu einem stillen Nichts - richtig, denn dort gibt es kein Widget.
const nativeModule = requireOptionalNativeModule<ToShoppingWidgetNativeModule>('ToShoppingWidget');

/**
 * Zeichnet alle platzierten Widgets neu. Nach jedem Schreibvorgang an Listen
 * oder Artikeln aufzurufen (FR-11.3). Kehrt sofort zurueck - gelesen wird
 * nativ und spaeter - und wirft nie: Ein Widget, das nicht nachzieht, darf
 * keinen Schreibvorgang der App scheitern lassen.
 */
export function refreshWidget(): void {
  nativeModule?.refreshWidget();
}
