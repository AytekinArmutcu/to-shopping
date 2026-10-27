import { router, type Href } from 'expo-router';

/**
 * Zurueck zu einem benannten Ziel (ADR-036).
 *
 * Liegt das Ziel schon im Verlauf, geht es bis dorthin zurueck - alle Screens
 * darueber werden geschlossen. Liegt es nicht darin, tritt es an die Stelle
 * des aktuellen Screens. In beiden Faellen waechst der Verlauf nicht.
 *
 * Warum nicht router.navigate: In expo-router 57 (React Navigation 7) kehrt
 * navigate nur zu einem Screen zurueck, der ganz oben liegt. Liegt das Ziel
 * weiter unten, legt navigate einen neuen Screen obendrauf. Jeder Tipp auf
 * Zurueck liess so einen Screen gemountet zurueck, samt seiner
 * Live-Abfragen (ADR-027) - und jede Schreiboperation wurde mit jeder Runde
 * langsamer.
 *
 * Nur fuer Zurueck. Vorwaerts zu einem Detailscreen bleibt router.push.
 */
export function goTo(href: Href): void {
  router.dismissTo(href);
}
