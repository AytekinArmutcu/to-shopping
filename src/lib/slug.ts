/**
 * Erzeugt aus einem Produktnamen einen stabilen Bezeichner.
 *
 * Warum ueberhaupt: Die IDs der mitgelieferten Produkte muessen bei jeder
 * Neuinstallation dieselben sein. Nur so kann "Katalog zuruecksetzen" (FR-4.4)
 * erkennen, welche mitgelieferten Produkte fehlen, und nur so bleiben
 * Verweise nach einer Wiederherstellung gueltig. Zufaellige UUIDs koennten
 * das nicht leisten.
 *
 * Deutsche Umlaute werden ausgeschrieben statt entfernt, damit "Müsli" und
 * "Musli" nicht auf denselben Bezeichner fallen.
 */
const REPLACEMENTS: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
  à: 'a',
  á: 'a',
  â: 'a',
  è: 'e',
  é: 'e',
  ê: 'e',
  î: 'i',
  ï: 'i',
  ô: 'o',
  ù: 'u',
  û: 'u',
  ç: 'c',
};

export function slugify(value: string): string {
  const lowered = value.toLowerCase();

  let replaced = '';
  for (const char of lowered) {
    replaced += REPLACEMENTS[char] ?? char;
  }

  return replaced
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}
