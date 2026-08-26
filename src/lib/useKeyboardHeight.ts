import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Hoehe der Tastatur in dp, 0 wenn sie geschlossen ist.
 *
 * Warum es das neben `useAnimatedKeyboard` gibt: Die Reanimated-Variante
 * liefert einen Wert fuer den Animations-Thread und wirkt nur ueber
 * `useAnimatedStyle` auf `Animated`-Komponenten. Der Dialog von React Native
 * Paper ist keine solche Komponente - er nimmt ein gewoehnliches Style-Objekt
 * entgegen. Fuer ihn braucht es die Hoehe als React-Zustand.
 *
 * Noetig ist das, weil der Dialog im Portal desselben Fensters haengt: Seit
 * Android 15 wird das Fenster beim Oeffnen der Tastatur nicht mehr
 * verkleinert, also liegt sie sonst ueber dem Eingabefeld (siehe ADR-026).
 *
 * Der Sprung ist nicht animiert. Ein Dialog erscheint ohnehin schlagartig;
 * eine Animation waere hier Aufwand ohne sichtbaren Gewinn.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      setHeight(event.endCoordinates.height);
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      setHeight(0);
    });

    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return height;
}
