import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { DEFAULT_UNIT } from './units';

/**
 * Datenmodell laut docs/architecture.md, Abschnitt 3.
 *
 * Grundregel (ADR-007): Listeneintraege, Historie und Vorlagen tragen den
 * Produktnamen als Kopie. Ein geloeschtes Produkt reisst dadurch keinen
 * Listeneintrag mit, und eine geteilte Liste funktioniert auch bei einem
 * Empfaenger mit voellig anderem Katalog.
 */

const now = sql`(unixepoch() * 1000)`;

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** Reihenfolge, wenn eine Liste keine eigene definiert. */
  defaultPosition: integer('default_position').notNull(),
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull().default(now),
});

export const products = sqliteTable(
  'products',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    defaultUnit: text('default_unit').notNull().default(DEFAULT_UNIT),
    isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(false),
    /** Grundvorrat (ADR-047): Salz, Pfeffer, Oel - steht im Rezept, zaehlt aber nicht als fehlend. */
    isStaple: integer('is_staple', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull().default(now),
  },
  (table) => [
    // Eindeutig ohne Ruecksicht auf Gross-/Kleinschreibung: Der Import ordnet
    // Produkte ueber den Namen zu. Ohne das entstehen "Milch" und "milch" als
    // zwei Produkte und die Haeufigkeitsstatistik zerfaellt.
    uniqueIndex('products_name_unique').on(sql`lower(${table.name})`),
  ],
);

export const lists = sqliteTable('lists', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
  lastOpenedAt: integer('last_opened_at'),
  createdAt: integer('created_at').notNull().default(now),
});

/** Das Ladenlayout: Kategorie-Reihenfolge pro Liste (ADR-017). */
export const listCategoryOrder = sqliteTable(
  'list_category_order',
  {
    listId: text('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
  },
  (table) => [primaryKey({ columns: [table.listId, table.categoryId] })],
);

export const listItems = sqliteTable(
  'list_items',
  {
    id: text('id').primaryKey(),
    listId: text('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
    /** Kopie zum Zeitpunkt des Hinzufuegens, siehe ADR-007. */
    name: text('name').notNull(),
    categoryId: text('category_id'),
    quantity: real('quantity').notNull().default(1),
    unit: text('unit').notNull().default(DEFAULT_UNIT),
    note: text('note'),
    isChecked: integer('is_checked', { mode: 'boolean' }).notNull().default(false),
    checkedAt: integer('checked_at'),
    position: integer('position').notNull().default(0),
    createdAt: integer('created_at').notNull().default(now),
  },
  // Mit Abstand haeufigste Abfrage: offene Artikel einer Liste.
  (table) => [index('list_items_list_checked').on(table.listId, table.isChecked)],
);

/** Grundlage der Vorschlaege (FR-5.1). Wird beim Einkauf-Abschliessen befuellt. */
export const purchaseHistory = sqliteTable(
  'purchase_history',
  {
    id: text('id').primaryKey(),
    productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    quantity: real('quantity').notNull().default(1),
    unit: text('unit').notNull().default(DEFAULT_UNIT),
    listId: text('list_id'),
    purchasedAt: integer('purchased_at').notNull(),
  },
  (table) => [index('purchase_history_product_time').on(table.productId, table.purchasedAt)],
);

export const templates = sqliteTable('templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull().default(now),
});

export const templateItems = sqliteTable('template_items', {
  id: text('id').primaryKey(),
  templateId: text('template_id')
    .notNull()
    .references(() => templates.id, { onDelete: 'cascade' }),
  productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  categoryId: text('category_id'),
  quantity: real('quantity').notNull().default(1),
  unit: text('unit').notNull().default(DEFAULT_UNIT),
  note: text('note'),
  position: integer('position').notNull().default(0),
});

/**
 * Vorrat: ein Eintrag pro Produkt, das gerade zu Hause ist - kein Zaehler,
 * keine Menge. CASCADE, weil der Vorrat eine Eigenschaft des Katalogprodukts
 * ist: Wird das Produkt geloescht, ist der Vorratseintrag gegenstandslos (ADR-043).
 */
export const pantry = sqliteTable('pantry', {
  productId: text('product_id')
    .primaryKey()
    .references(() => products.id, { onDelete: 'cascade' }),
  addedAt: integer('added_at').notNull().default(now),
});

/**
 * Rezepte: Name, optionale Notiz, mitgeliefert-Kennzeichen wie bei products
 * (ADR-031). Kein Unique-Index auf dem Namen: zwei Gerichte duerfen gleich
 * heissen (ADR-044).
 */
export const recipes = sqliteTable('recipes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  note: text('note'),
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull().default(now),
});

/** Zutaten: wie template_items. Name als Kopie (ADR-007), Produktbezug SET NULL (ADR-044). */
export const recipeItems = sqliteTable('recipe_items', {
  id: text('id').primaryKey(),
  recipeId: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  quantity: real('quantity').notNull().default(1),
  unit: text('unit').notNull().default(DEFAULT_UNIT),
  position: integer('position').notNull().default(0),
});

/** Wochenplan: nur die gewaehlten Rezepte, keine Wochentage (ADR-044). */
export const weeklyPlan = sqliteTable('weekly_plan', {
  recipeId: text('recipe_id')
    .primaryKey()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  addedAt: integer('added_at').notNull().default(now),
});

/**
 * Zubereitungsschritte eines Rezepts (ADR-047): bewusst nur Text, keine
 * Zeiten, Bilder oder Zutatenbezuege. Reihenfolge ueber position.
 */
export const recipeSteps = sqliteTable('recipe_steps', {
  id: text('id').primaryKey(),
  recipeId: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  text: text('text').notNull(),
});

/** Schluessel-Wert-Ablage fuer alles, was kein eigenes Schema verdient. */
export const appState = sqliteTable('app_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type List = typeof lists.$inferSelect;
export type ListItem = typeof listItems.$inferSelect;
export type PurchaseHistoryEntry = typeof purchaseHistory.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type TemplateItem = typeof templateItems.$inferSelect;
export type PantryEntry = typeof pantry.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type RecipeItem = typeof recipeItems.$inferSelect;
export type WeeklyPlanEntry = typeof weeklyPlan.$inferSelect;
export type RecipeStep = typeof recipeSteps.$inferSelect;
