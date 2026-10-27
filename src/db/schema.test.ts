import { getTableConfig } from 'drizzle-orm/sqlite-core';

import {
  listCategoryOrder,
  listItems,
  pantry,
  products,
  purchaseHistory,
  recipeItems,
  recipes,
  templateItems,
  weeklyPlan,
} from './schema';

/**
 * Waechter fuer die Fremdschluessel-Regeln (ADR-007).
 *
 * Diese Regeln sind keine Feinheit des Schemas, sondern eine Zusage an den
 * Nutzer: Ein geloeschtes Produkt reisst keinen Listeneintrag mit, eine
 * geloeschte Liste nimmt ihre Artikel mit. Beides laesst sich nur auf dem
 * Geraet vorfuehren - aber die Regel selbst laesst sich hier festnageln.
 * Wer sie versehentlich auf "cascade" umstellt, faellt hier auf und nicht
 * erst beim Nutzer, dem die halbe Einkaufsliste fehlt.
 */

function onDeleteOf(table: Parameters<typeof getTableConfig>[0], column: string) {
  const config = getTableConfig(table);
  const key = config.foreignKeys.find((entry) =>
    entry.reference().columns.some((reference) => reference.name === column),
  );
  return key?.onDelete;
}

describe('Fremdschluessel-Regeln', () => {
  it('loest die Produktverknuepfung, statt den Listeneintrag zu loeschen (T-7.3)', () => {
    // Der Name steht als Kopie in der Zeile. Faellt das Produkt weg, bleibt
    // der Eintrag als Text stehen - der Nutzer kauft trotzdem, was er
    // aufgeschrieben hat.
    expect(onDeleteOf(listItems, 'product_id')).toBe('set null');
  });

  it('nimmt beim Loeschen einer Liste ihre Artikel mit', () => {
    expect(onDeleteOf(listItems, 'list_id')).toBe('cascade');
  });

  it('nimmt beim Loeschen einer Liste ihr Ladenlayout mit', () => {
    expect(onDeleteOf(listCategoryOrder, 'list_id')).toBe('cascade');
  });

  it('haelt die Historie auch ohne Produkt', () => {
    // Sonst verschwaende mit einem geloeschten Produkt die halbe
    // Kaufhistorie - und damit die Grundlage der Vorschlaege (FR-5.1).
    expect(onDeleteOf(purchaseHistory, 'product_id')).toBe('set null');
  });

  it('haelt Vorlagen auch ohne Produkt', () => {
    expect(onDeleteOf(templateItems, 'product_id')).toBe('set null');
  });

  it('nimmt beim Loeschen einer Vorlage ihre Artikel mit (FR-5.5)', () => {
    expect(onDeleteOf(templateItems, 'template_id')).toBe('cascade');
  });

  it('nimmt beim Loeschen einer Kategorie das Produkt nicht mit', () => {
    expect(onDeleteOf(products, 'category_id')).toBe('set null');
  });

  it('Vorrat haengt am Produkt: geloeschtes Produkt verlaesst den Vorrat (T-13.1)', () => {
    expect(onDeleteOf(pantry, 'product_id')).toBe('cascade');
  });

  it('Vorrat kennt jedes Produkt hoechstens einmal: product_id ist Primaerschluessel (T-13.1)', () => {
    const column = getTableConfig(pantry).columns.find((entry) => entry.name === 'product_id');
    expect(column?.primary).toBe(true);
  });

  it('nimmt beim Loeschen eines Rezepts seine Zutaten mit (T-14.1)', () => {
    expect(onDeleteOf(recipeItems, 'recipe_id')).toBe('cascade');
  });

  it('haelt Zutaten auch ohne Produkt (T-14.1)', () => {
    expect(onDeleteOf(recipeItems, 'product_id')).toBe('set null');
  });

  it('nimmt beim Loeschen eines Rezepts seinen Wochenplan-Eintrag mit (T-14.1)', () => {
    expect(onDeleteOf(weeklyPlan, 'recipe_id')).toBe('cascade');
  });

  it('erlaubt zwei Rezepte mit gleichem Namen: kein Unique-Index (T-14.1)', () => {
    const config = getTableConfig(recipes);
    expect(config.indexes.some((entry) => entry.config.unique)).toBe(false);
    expect(config.uniqueConstraints).toHaveLength(0);
    // Gegenprobe: bei products greift dieselbe Abfrage.
    expect(getTableConfig(products).indexes.some((entry) => entry.config.unique)).toBe(true);
  });
});
