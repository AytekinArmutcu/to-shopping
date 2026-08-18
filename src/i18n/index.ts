import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './locales/de.json';

/**
 * Uebersetzung nach ADR-019: Die Struktur ist von Anfang an vorhanden,
 * ausgeliefert wird aber ausschliesslich Deutsch. Eine spaetere Sprache ist
 * dann eine zusaetzliche JSON-Datei und keine Umbauaktion im Code.
 *
 * Bewusst ohne Spracherkennung: Es gibt nur eine Sprache. Sobald eine zweite
 * dazukommt, kommt expo-localization hier hinein.
 */
export const DEFAULT_LANGUAGE = 'de';

export const resources = {
  de: { translation: de },
} as const;

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    // React maskiert selbst. Doppelte Maskierung wuerde Umlaute zerstoeren.
    escapeValue: false,
  },
});

export default i18n;
