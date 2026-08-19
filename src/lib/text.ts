/**
 * Normalisiert Text fuer die Suche im Produktkatalog.
 *
 * Bewusst nachsichtiger als slugify(): Wer "apfel" tippt, soll "Äpfel" finden,
 * und wer "muesli" tippt, soll "Müsli" finden. Deshalb werden Umlaute hier auf
 * den Grundvokal abgebildet (ä -> a), waehrend slugify() sie ausschreibt
 * (ä -> ae), weil dort Eindeutigkeit zaehlt und nicht Nachsicht.
 *
 * Beide Schreibweisen zu finden ist wichtiger als beide zu unterscheiden:
 * Der Nutzer tippt im Laden mit einer Hand.
 */
const FOLDINGS: Record<string, string> = {
  ä: 'a',
  ö: 'o',
  ü: 'u',
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

export function normalizeForSearch(value: string): string {
  const lowered = value.toLowerCase().trim();

  let folded = '';
  for (const char of lowered) {
    folded += FOLDINGS[char] ?? char;
  }

  // Mehrfache Leerzeichen zusammenfassen, damit "Wiener  Wuerstchen" trifft.
  return folded.replace(/\s+/g, ' ');
}

/**
 * Zweite Schreibweise eines Namens: Umlaute ausgeschrieben (ü -> ue).
 *
 * Die Suche vergleicht die Eingabe gegen beide Formen des Produktnamens,
 * damit sowohl "musli" als auch "muesli" das Produkt "Müsli" findet.
 *
 * Bewusst wird der Produktname umgeformt und nicht die Eingabe: Wer "ue" in
 * der Eingabe zu "u" zusammenzieht, macht aus "Steuer" ein "Stur" und
 * erzeugt Treffer, die niemand gesucht hat.
 */
const EXPANSIONS: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
};

export function expandForSearch(value: string): string {
  const lowered = value.toLowerCase().trim();

  let expanded = '';
  for (const char of lowered) {
    expanded += EXPANSIONS[char] ?? FOLDINGS[char] ?? char;
  }

  return expanded.replace(/\s+/g, ' ');
}
