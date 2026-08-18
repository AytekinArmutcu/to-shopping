import { slugify } from '@/lib/slug';

import { DEFAULT_UNIT, isUnit, type Unit } from '../units';

/** Rohform, wie sie in categories.json und products.json steht. */
export type SeedCategory = {
  id: string;
  name: string;
  defaultPosition: number;
};

export type SeedProduct = {
  name: string;
  category: string;
  unit: string;
};

/** Fertige Zeile, wie sie in die Tabelle products geschrieben wird. */
export type ProductRow = {
  id: string;
  name: string;
  categoryId: string;
  defaultUnit: Unit;
  isBuiltin: true;
};

/**
 * Wandelt die Rohdaten des Startkatalogs in Datenbankzeilen um.
 *
 * Reine Funktion ohne Datenbankzugriff (ADR-008): Eingabe rein, Zeilen raus.
 * Dadurch laesst sich der komplette Katalog pruefen, ohne die App zu starten.
 *
 * Unbekannte Kategorien landen in "sonstiges" statt zu einem Fehler zu fuehren -
 * ein einzelner Tippfehler in der Datei soll nicht die Erstinstallation
 * verhindern. Unbekannte Einheiten fallen auf "stueck" zurueck.
 */
export function buildProductRows(
  products: SeedProduct[],
  categories: SeedCategory[],
  fallbackCategoryId = 'sonstiges',
): ProductRow[] {
  const knownCategories = new Set(categories.map((category) => category.id));

  return products.map((product) => ({
    id: `p-${slugify(product.name)}`,
    name: product.name,
    categoryId: knownCategories.has(product.category) ? product.category : fallbackCategoryId,
    defaultUnit: isUnit(product.unit) ? product.unit : DEFAULT_UNIT,
    isBuiltin: true,
  }));
}

/**
 * Findet Namen, die sich nur in der Gross-/Kleinschreibung unterscheiden.
 *
 * Solche Paare wuerden am eindeutigen Index auf lower(name) scheitern und die
 * Erstinstallation abbrechen lassen. Der Test prueft das vor der Auslieferung.
 */
export function findDuplicateNames(products: SeedProduct[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const product of products) {
    const key = product.name.toLowerCase();
    if (seen.has(key)) {
      duplicates.push(product.name);
    }
    seen.add(key);
  }

  return duplicates;
}

/** Findet Produkte, deren erzeugte ID mit einer anderen kollidiert. */
export function findDuplicateIds(rows: ProductRow[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const row of rows) {
    if (seen.has(row.id)) {
      duplicates.push(row.id);
    }
    seen.add(row.id);
  }

  return duplicates;
}
