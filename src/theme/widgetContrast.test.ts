import { contrastRatio, WCAG_AA_TEXT } from './contrast';

/**
 * Lesbarkeit des Homescreen-Widgets in hell und dunkel (FR-11.4).
 *
 * Die Werte SPIEGELN die Farbressourcen des Widgets:
 *   modules/to-shopping-widget/android/src/main/res/values/colors.xml
 *   modules/to-shopping-widget/android/src/main/res/values-night/colors.xml
 * Das Widget zeichnet der Launcher ohne JavaScript, die Farben stehen deshalb
 * nur dort. Wer sie dort aendert, traegt sie hier nach - dann sagt dieser
 * Test, ob Titel und Zeilen auf dem Grund noch lesbar sind.
 *
 * Gemessen wird gegen 4,5 (normaler Text), nicht gegen 3,0 fuer grosse
 * Schrift: Der Titel ist mit 16sp fett nicht "gross" im Sinne von WCAG
 * (ab 14pt fett, also etwa 18,7sp), und "+ n weitere" steht in der
 * Akzentfarbe mit 14sp.
 */
const WIDGET_COLORS = {
  hell: { background: '#FCFDF6', text: '#1A1C19', accent: '#1E6C33' },
  dunkel: { background: '#1A1C19', text: '#E2E3DC', accent: '#8CD892' },
} as const;

describe('Widget-Farben', () => {
  describe.each(Object.entries(WIDGET_COLORS))('%s', (_mode, colors) => {
    it('Titel (Akzent) auf Grund erreicht WCAG AA fuer Text', () => {
      expect(contrastRatio(colors.accent, colors.background)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });

    it('Artikelzeilen auf Grund erreichen WCAG AA fuer Text', () => {
      expect(contrastRatio(colors.text, colors.background)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
  });
});
