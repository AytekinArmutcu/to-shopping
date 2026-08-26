/**
 * Der Zeitpunkt, zu dem die App gestartet ist.
 *
 * Das Ranking braucht ein "jetzt", um die Aktualitaet eines Kaufs zu bewerten
 * (architecture.md 4.2). Dieses "jetzt" muss ueber alle Neuzeichnungen hinweg
 * **derselbe Wert** sein: Sonst bekaeme jeder Tastendruck eine minimal andere
 * Bewertung, und an einer Gleichstandsgrenze wuerde die Vorschlagsliste
 * springen, ohne dass sich etwas geaendert hat.
 *
 * Einmal beim Laden bestimmt und nicht bei jedem Rendern - das ist zugleich
 * die Regel, die React fuer reine Komponenten verlangt.
 *
 * Dass der Wert waehrend einer Sitzung altert, ist ohne Bedeutung: Die
 * Halbwertszeit der Aktualitaet betraegt 30 Tage, eine Sitzung ein paar
 * Minuten.
 */
export const SESSION_START = Date.now();
