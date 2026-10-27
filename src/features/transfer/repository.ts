import { and, asc, eq, getTableColumns } from 'drizzle-orm';

import { getAppState, setAppState, setFlag } from '@/db/appState';
import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import {
  categories,
  listCategoryOrder,
  listItems,
  lists,
  pantry,
  products,
  purchaseHistory,
  recipeItems,
  recipes,
  templateItems,
  templates,
  weeklyPlan,
} from '@/db/schema';
import { RECIPES_SEEDED_KEY } from '@/db/seed';

import {
  BACKUP_TABLES,
  buildBackup,
  type BackupData,
  type BackupFile,
  type BackupTable,
} from './backup';
import { buildSharedList, planImport, type SharedItem, type SharedListFile } from './logic';

/**
 * Datenzugriff fuers Teilen und Empfangen.
 *
 * Alles Entscheidende steckt in logic.ts und ist dort getestet; hier stehen
 * nur die Lese- und Schreibvorgaenge.
 */

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Packt eine Liste in das Teilen-Format (FR-6.1).
 *
 * Nur **offene** Artikel wandern mit: Was abgehakt ist, liegt bereits im
 * Wagen. Wer eine Liste weitergibt, meint das, was noch zu holen ist - eine
 * Kopie inklusive erledigter Posten waere fuer den Empfaenger irrefuehrend.
 *
 * Kategorien reisen als Name, nicht als ID (architecture.md 5.1).
 */
export async function buildSharedListForList(listId: string): Promise<SharedListFile | null> {
  const found = await db.select().from(lists).where(eq(lists.id, listId)).limit(1);
  const list = found[0];

  if (!list) {
    return null;
  }

  const categoryRows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories);
  const nameById = new Map(categoryRows.map((category) => [category.id, category.name]));

  const rows = await db
    .select()
    .from(listItems)
    .where(and(eq(listItems.listId, listId), eq(listItems.isChecked, false)))
    .orderBy(asc(listItems.position));

  const items: SharedItem[] = rows.map((row) => ({
    name: row.name,
    category: row.categoryId === null ? null : (nameById.get(row.categoryId) ?? null),
    quantity: row.quantity,
    unit: row.unit,
    note: row.note,
  }));

  const order = await db
    .select({ categoryId: listCategoryOrder.categoryId })
    .from(listCategoryOrder)
    .where(eq(listCategoryOrder.listId, listId))
    .orderBy(asc(listCategoryOrder.position));

  const categoryOrder = order
    .map((entry) => nameById.get(entry.categoryId))
    .filter((name): name is string => name !== undefined);

  return buildSharedList(list.name, items, categoryOrder);
}

export type ImportResult = {
  listId: string;
  itemCount: number;
  newProductCount: number;
};

/**
 * Uebernimmt eine empfangene Liste (FR-6.2, FR-6.3, architecture.md 4.5).
 *
 * Es entsteht **immer eine neue Liste**. Eine bestehende zu ergaenzen waere
 * die gefaehrlichere Voreinstellung: Der Empfaenger koennte seine eigene Liste
 * nicht mehr von der fremden trennen, und ein Import liesse sich nicht
 * rueckgaengig machen, ohne die eigene Arbeit mitzureissen. Eine ueberfluessige
 * Liste ist dagegen mit einem Tipp geloescht.
 *
 * Alles in einer Transaktion (CLAUDE.md): Eine Liste ohne ihre Artikel oder
 * Artikel ohne ihre neu angelegten Produkte waeren ein Zustand, den der
 * Nutzer nicht als Fehler erkennt.
 */
export async function importSharedList(
  file: SharedListFile,
  listName: string,
  fallbackCategoryId: string,
): Promise<ImportResult> {
  const knownProducts = await db.select({ id: products.id, name: products.name }).from(products);
  const knownCategories = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories);

  const plan = planImport(file, knownProducts, knownCategories, fallbackCategoryId);

  const listId = newId('l');
  const existing = await db.select({ id: lists.id }).from(lists);

  await db.transaction(async (tx) => {
    await tx.insert(lists).values({
      id: listId,
      name: listName,
      position: existing.length,
      lastOpenedAt: Date.now(),
    });

    if (plan.newProducts.length > 0) {
      await tx.insert(products).values(
        plan.newProducts.map((product) => ({
          id: product.id,
          name: product.name,
          categoryId: product.categoryId,
          isBuiltin: false,
        })),
      );
    }

    if (plan.items.length > 0) {
      await tx.insert(listItems).values(
        plan.items.map((entry, index) => ({
          id: `${listId}-i${index}`,
          listId,
          productId: entry.productId,
          name: entry.name,
          categoryId: entry.categoryId,
          quantity: entry.quantity,
          unit: entry.unit,
          note: entry.note,
          position: entry.position,
        })),
      );
    }

    if (plan.categoryOrder.length > 0) {
      await tx.insert(listCategoryOrder).values(
        plan.categoryOrder.map((categoryId, position) => ({
          listId,
          categoryId,
          position,
        })),
      );
    }
  });

  return {
    listId,
    itemCount: plan.items.length,
    newProductCount: plan.newProducts.length,
  };
}

/* ------------------------------------------------------------------ *
 * M9: Vollsicherung (FR-6.4, FR-6.5)
 * ------------------------------------------------------------------ */

/**
 * Der Datenbankstand, wie ihn die Migrationen zaehlen.
 *
 * Aus dem Journal gelesen statt als Zahl gepflegt: Eine handgepflegte Konstante
 * waere genau die Sorte Angabe, die man beim naechsten Schemawechsel vergisst.
 */
export function currentSchemaVersion(): number {
  return migrations.journal.entries.length;
}

const BACKUP_SOURCES = {
  categories,
  products,
  lists,
  listCategoryOrder,
  listItems,
  templates,
  templateItems,
  purchaseHistory,
  pantry,
  recipes,
  recipeItems,
  weeklyPlan,
} as const;

/**
 * Reihenfolge zum Loeschen: erst das, was auf anderes zeigt.
 *
 * `pantry` steht vorn, weil es auf `products` zeigt. Ebenso die Rezepte:
 * `weeklyPlan` und `recipeItems` zeigen auf `recipes`, die Zutaten ausserdem
 * auf `products` - also alle drei vor `products`, und `recipes` zuletzt.
 * Eingefuegt wird in der Reihenfolge von BACKUP_TABLES, dort stehen sie
 * hinter `products`.
 */
const DELETE_ORDER = [
  'weeklyPlan',
  'recipeItems',
  'recipes',
  'pantry',
  'purchaseHistory',
  'templateItems',
  'templates',
  'listItems',
  'listCategoryOrder',
  'lists',
  'products',
  'categories',
] as const satisfies readonly BackupTable[];

/** Liest den gesamten Datenbestand fuer die Vollsicherung (FR-6.4). */
export async function collectBackup(): Promise<BackupFile> {
  const data = {} as BackupData;

  for (const table of BACKUP_TABLES) {
    data[table] = await db.select().from(BACKUP_SOURCES[table]);
  }

  return buildBackup(data, currentSchemaVersion());
}

/**
 * Spielt eine Vollsicherung zurueck (FR-6.5).
 *
 * **Ersetzt** den Bestand, ergaenzt ihn nicht (architecture.md 5.2). Ergaenzen
 * waere unmoeglich: Die Sicherung enthaelt echte IDs, und dieselbe Liste zweimal
 * mit derselben Kennung gibt es nicht. Deshalb steht davor eine ausdrueckliche
 * Warnung - das ist der einzige Vorgang in dieser App, der Daten des Nutzers
 * unwiederbringlich loescht.
 *
 * Alles in einer Transaktion (CLAUDE.md). Hier ist sie nicht Kuer, sondern
 * Pflicht: Ein Abbruch zwischen Loeschen und Schreiben liesse eine leere App
 * zurueck, und die Sicherung ist dann womoeglich die einzige Kopie.
 *
 * Nur bekannte Spalten werden uebernommen. Eine Sicherung aus einem aelteren
 * Stand hat weniger, eine handbearbeitete koennte mehr haben - beides darf den
 * Vorgang nicht sprengen.
 */
export async function restoreBackup(file: BackupFile): Promise<number> {
  let written = 0;

  await db.transaction(async (tx) => {
    for (const table of DELETE_ORDER) {
      await tx.delete(BACKUP_SOURCES[table]);
    }

    for (const table of BACKUP_TABLES) {
      const rows = pickKnownColumns(BACKUP_SOURCES[table], file.data[table]);

      if (rows.length > 0) {
        // Der Typ der Zeilen steht erst zur Laufzeit fest: Sie stammen aus
        // einer Datei, und welche Spalten es gibt, entscheidet die Tabelle.
        // Deshalb hier ein Cast statt einer Typangabe, die nur so tut.
        await tx.insert(BACKUP_SOURCES[table]).values(rows as never);
        written += rows.length;
      }
    }
  });

  // Eine Sicherung ohne `recipes`-Tabelle (V1) hinterlaesst nach dem Ersetzen
  // eine leere Rezepttabelle - der Merker RECIPES_SEEDED_KEY in app_state
  // steht aber noch, also kaeme der Grundstock nie zurueck (ADR-046,
  // Konsequenz). Darum den Merker loeschen: Beim naechsten Start saet
  // seedRecipesOnce. app_state selbst bleibt aus der Sicherung ausgeschlossen.
  // Eine Datei mit leerer, aber vorhandener `recipes`-Tabelle laesst den
  // Merker stehen - dort hat der Nutzer seine Gerichte bewusst geloescht.
  // Nach der Transaktion, weil setFlag ueber die gemeinsame Verbindung
  // schreibt und keine Transaktion annimmt (wie in seedRecipesOnce).
  if (file.missingOptional?.includes('recipes')) {
    await setFlag(RECIPES_SEEDED_KEY, false);
  }

  return written;
}

function pickKnownColumns(
  table: (typeof BACKUP_SOURCES)[BackupTable],
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  const keys = Object.keys(getTableColumns(table));

  return rows.map((row) =>
    Object.fromEntries(keys.filter((key) => key in row).map((key) => [key, row[key]])),
  );
}

export const LAST_BACKUP_KEY = 'last_backup_at';
export const BACKUP_REMINDER_DISMISSED_KEY = 'backup_reminder_dismissed_at';

export async function getTimestamp(key: string): Promise<number | null> {
  const stored = await getAppState(key);
  const parsed = stored === null ? Number.NaN : Number(stored);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function setTimestamp(key: string, at: number = Date.now()): Promise<void> {
  await setAppState(key, String(at));
}
