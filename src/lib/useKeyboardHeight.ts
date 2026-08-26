import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Hoehe der Tastatur in dp, 0 wenn sie geschlossen ist.
 *
 * **Die einzige Stelle in der App, an der die Tastaturhoehe herkommt**
 * (ADR-035). Vorher benutzten die Screens `useAnimatedKeyboard` von
 * Reanimated und die Dialoge diesen Haken - zwei Wege fuer dieselbe Frage.
 * Auf einem Geraet mit anderer Pixeldichte lieferte der Reanimated-Weg einen
 * Wert, der als dp verwendet wurde, aber Pixel enthielt: Das Eingabefeld
 * verschwand unter dem unteren Bildschirmrand.
 *
 * `endCoordinates.height` aus dem Keyboard-Ereignis ist dagegen von React
 * Native als dp dokumentiert und verhaelt sich auf allen Android-Fassungen
 * gleich.
 *
 * Noetig ist das Ganze, weil das Fenster seit Android 15 beim Oeffnen der
 * Tastatur nicht mehr verkleinert wird - die Tastatur liegt sonst einfach
 * ueber dem Eingabefeld (siehe ADR-026).
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
