import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect } from 'react';

/**
 * Faengt Dateien ab, mit denen die App von aussen geoeffnet wird (FR-6.2).
 *
 * Der Intent liefert eine content://-Adresse. Die passt zu keiner Route, also
 * wuerde Expo Router sie als unbekannten Pfad behandeln - deshalb wird sie
 * hier abgefangen und als Parameter an /import weitergereicht.
 *
 * Eine eigene Komponente statt ein paar Zeilen im Wurzel-Layout: Der Effekt
 * darf erst laufen, wenn der Navigator steht. So haengt er sichtbar an der
 * Stelle, an der das der Fall ist.
 */
export function IncomingFileWatcher() {
  const url = Linking.useURL();

  useEffect(() => {
    if (url === null) {
      return;
    }

    if (url.startsWith('content://') || url.startsWith('file://')) {
      router.push({ pathname: '/import', params: { uri: url } });
    }
  }, [url]);

  return null;
}
