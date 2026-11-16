/**
 * Umrechnung und Absicherung der gemeldeten Tastaturhoehe.
 *
 * Reine Funktion, damit sich der Fall pruefen laesst, der auf dem Geraet nur
 * sporadisch auftritt - und der die App unbedienbar macht, wenn er auftritt.
 */

/**
 * Groesster Anteil des Bildschirms, den eine Tastatur einnehmen kann.
 *
 * Uebliche Tastaturen liegen bei 30 bis 40 Prozent. 60 Prozent ist grosszuegig
 * und gilt nur, weil die App auf Hochformat festgelegt ist (app.json).
 */
export const MAX_KEYBOARD_SHARE = 0.6;

/**
 * Rechnet die gemeldete Tastaturhoehe in dp um und begrenzt sie.
 *
 * Hintergrund: React Native gibt `endCoordinates.height` als dp an. Auf
 * einzelnen Android-Fassungen kam der Wert jedoch in **Pixeln** an - auf einem
 * Geraet mit Pixeldichte 2,625 also 883 statt 336. Als Abstand aufgetragen
 * schob das die Eingabeleiste unter den unteren Bildschirmrand: Das
 * Eingabefeld war weg, sobald die Tastatur aufging.
 *
 * Der Fehler trat nur gelegentlich auf, und die Ursache liegt ausserhalb
 * dieser App. Deshalb wird hier nicht geraten, sondern gerechnet: Ein Wert,
 * der mehr als 60 Prozent des Bildschirms beansprucht, kann keine dp-Angabe
 * sein - dann sind es Pixel, und die Pixeldichte macht daraus wieder dp. Die
 * anschliessende Begrenzung ist der Gurt zum Hosentraeger: Was auch immer
 * hereinkommt, die Leiste bleibt sichtbar.
 */
export function keyboardHeightInDp(
  reported: number,
  windowHeight: number,
  pixelRatio: number,
): number {
  if (!Number.isFinite(reported) || reported <= 0 || windowHeight <= 0) {
    return 0;
  }

  const limit = windowHeight * MAX_KEYBOARD_SHARE;
  const asDp = reported > limit && pixelRatio > 1 ? reported / pixelRatio : reported;

  return Math.min(asDp, limit);
}

/**
 * Abstand, den ein am unteren Bildschirmrand verankerter Bereich freihalten
 * muss, damit er ueber Tastatur und Systemleiste steht.
 *
 * React Native meldet die Tastaturhoehe **ohne** die Systemleiste darunter
 * (`ime.bottom - systemBars.bottom`). Die App zeichnet aber randlos bis zur
 * Bildschirmkante (seit Android 15 Pflicht, ADR-026) - die Tastatur verdeckt
 * also die gemeldete Hoehe **plus** den unteren Systemrand. Auf dem Emulator
 * gemessen: gemeldet 312 dp, verdeckt 336 dp (883 px), Systemrand 24 dp.
 *
 * Bis M18 fehlten diese 24 dp. Beim flachen Eingabefeld fiel es nicht auf,
 * weil die Schrift noch oberhalb lag; die Pillenform aus ADR-049 wurde davon
 * sichtbar angeschnitten (ADR-050).
 *
 * Ist die Tastatur zu, bleibt nur der Systemrand frei.
 */
export function bottomInsetWithKeyboard(keyboardHeight: number, bottomInset: number): number {
  const inset = Number.isFinite(bottomInset) && bottomInset > 0 ? bottomInset : 0;

  if (!Number.isFinite(keyboardHeight) || keyboardHeight <= 0) {
    return inset;
  }

  return keyboardHeight + inset;
}
