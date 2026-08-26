import { asc, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { listItems, templateItems, templates } from '@/db/schema';

import {
  buildTemplateItems,
  buildTemplateOverview,
  planTemplateApply,
  type TemplateOverviewRow,
} from './logic';

/**
 * Datenzugriff fuer Vorlagen (FR-5.3 bis FR-5.5).
 *
 * Die Regeln stehen in logic.ts und sind dort getestet; hier stehen nur die
 * Lese- und Schreibvorgaenge.
 */

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Bauplaene fuer die Uebersicht (ADR-027). */
export function templatesQuery() {
  return db
    .select({ id: templates.id, name: templates.name, createdAt: templates.createdAt })
    .from(templates);
}

export function templateCountsQuery() {
  return db
    .select({ templateId: templateItems.templateId, itemCount: sql<number>`count(*)` })
    .from(templateItems)
    .groupBy(templateItems.templateId);
}

/**
 * Sichert die aktuelle Liste als Vorlage (FR-5.3, T-11.1).
 *
 * In einer Transaktion (CLAUDE.md): Eine Vorlage ohne ihre Artikel saehe wie
 * eine leere Vorlage aus - der Nutzer wuerde den Fehler erst bemerken, wenn er
 * sie das naechste Mal anwendet und nichts passiert.
 *
 * Rueckgabe: Anzahl der uebernommenen Artikel.
 */
export async function saveListAsTemplate(listId: string, name: string): Promise<number> {
  const rows = await db
    .select()
    .from(listItems)
    .where(eq(listItems.listId, listId))
    .orderBy(asc(listItems.position));

  const items = buildTemplateItems(rows);
  const id = newId('t');

  await db.transaction(async (tx) => {
    await tx.insert(templates).values({ id, name });

    if (items.length > 0) {
      await tx.insert(templateItems).values(
        items.map((item, index) => ({
          id: `${id}-i${index}`,
          templateId: id,
          productId: item.productId,
          name: item.name,
          categoryId: item.categoryId,
          quantity: item.quantity,
          unit: item.unit,
          note: item.note,
          position: item.position,
        })),
      );
    }
  });

  return items.length;
}

export type TemplateApplyResult = {
  added: number;
  skipped: number;
};

/**
 * Wendet eine Vorlage auf eine Liste an (FR-5.4, T-11.4).
 *
 * Was uebersprungen wird, entscheidet planTemplateApply nach der Regel aus
 * architecture.md 4.4. Hier wird nur geschrieben - und gezaehlt, damit die
 * Oberflaeche "7 Artikel hinzugefuegt" melden kann.
 *
 * In einer Transaktion: Eine halb angewendete Vorlage waere fuer den Nutzer
 * nicht von einer vollstaendigen zu unterscheiden.
 */
export async function applyTemplate(
  templateId: string,
  listId: string,
): Promise<TemplateApplyResult> {
  const source = await db
    .select()
    .from(templateItems)
    .where(eq(templateItems.templateId, templateId))
    .orderBy(asc(templateItems.position));

  const target = await db
    .select({
      productId: listItems.productId,
      name: listItems.name,
      isChecked: listItems.isChecked,
    })
    .from(listItems)
    .where(eq(listItems.listId, listId));

  const { add, skipped } = planTemplateApply(source, target);

  if (add.length === 0) {
    return { added: 0, skipped: skipped.length };
  }

  const [{ value: count } = { value: 0 }] = await db
    .select({ value: sql<number>`count(*)` })
    .from(listItems)
    .where(eq(listItems.listId, listId));

  const stamp = Date.now().toString(36);

  await db.transaction(async (tx) => {
    await tx.insert(listItems).values(
      add.map((item, index) => ({
        id: `i-${stamp}-${index}`,
        listId,
        productId: item.productId,
        name: item.name,
        categoryId: item.categoryId,
        quantity: item.quantity,
        unit: item.unit,
        note: item.note,
        position: count + index,
      })),
    );
  });

  return { added: add.length, skipped: skipped.length };
}

export async function renameTemplate(id: string, name: string): Promise<void> {
  await db.update(templates).set({ name }).where(eq(templates.id, id));
}

/**
 * Loescht eine Vorlage (FR-5.5).
 *
 * Ihre Artikel gehen per Fremdschluessel-Kaskade mit (schema.ts, geprueft in
 * db/schema.test.ts). Listen, auf die die Vorlage einmal angewendet wurde,
 * bleiben unberuehrt - deren Artikel sind eigene Zeilen und tragen den Namen
 * als Kopie (ADR-007).
 */
export async function deleteTemplate(id: string): Promise<void> {
  await db.delete(templates).where(eq(templates.id, id));
}

/**
 * Die Uebersicht auf Abruf, nicht als Live-Abfrage.
 *
 * Der Listen-Screen braucht sie nur, wenn der Nutzer "Vorlage anwenden"
 * oeffnet. Eine dauerhafte Live-Abfrage waere die siebte auf diesem Screen -
 * fuer Daten, die in neun von zehn Sitzungen niemand ansieht.
 */
export async function getTemplateOverview(): Promise<TemplateOverviewRow[]> {
  const [rows, counts] = await Promise.all([templatesQuery(), templateCountsQuery()]);
  return buildTemplateOverview(rows, counts);
}
