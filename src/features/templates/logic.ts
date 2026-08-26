/**
 * Vorlagen: aus einer Liste eine machen und sie wieder anwenden
 * (FR-5.3 bis FR-5.5, architecture.md 4.4).
 *
 * Reine Funktionen ohne Datenbankzugriff (ADR-008). Die Abgleichsregel ist der
 * ganze Kern dieses Meilensteins - und genau die Sorte Regel, die man ohne
 * Test nur glaubt.
 */

export type TemplateSourceItem = {
  productId: string | null;
  name: string;
  categoryId: string | null;
  quantity: number;
  unit: string;
  note: string | null;
  position: number;
};

export type TemplateItemLike = {
  productId: string | null;
  name: string;
  categoryId: string | null;
  quantity: number;
  unit: string;
  note: string | null;
  position: number;
};

export type TargetItem = {
  productId: string | null;
  name: string;
  isChecked: boolean;
};

/** Laenge eines Vorlagennamens - wie bei Listen. */
export const MAX_TEMPLATE_NAME_LENGTH = 60;

export function cleanTemplateName(value: string): string | null {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, MAX_TEMPLATE_NAME_LENGTH);
}

/**
 * Macht aus den Artikeln einer Liste die Zeilen einer Vorlage (FR-5.3).
 *
 * Menge, Einheit und Notiz reisen mit: Wer "2 l Milch" jede Woche kauft, will
 * beim naechsten Anwenden nicht wieder die Menge einstellen. Der Haken reist
 * **nicht** mit - eine Vorlage beschreibt, was man braucht, nicht was man
 * schon hat.
 *
 * Abgehakte Artikel kommen trotzdem in die Vorlage: Sie gehoeren zum Einkauf,
 * den man festhalten will. Wer die Liste nach dem Einkauf als Vorlage sichert,
 * haette sonst eine leere Vorlage.
 */
export function buildTemplateItems(items: TemplateSourceItem[]): TemplateItemLike[] {
  return [...items]
    .sort((a, b) => a.position - b.position)
    .map((item, index) => ({
      productId: item.productId,
      name: item.name,
      categoryId: item.categoryId,
      quantity: item.quantity,
      unit: item.unit,
      note: item.note,
      position: index,
    }));
}

export type TemplateApplyPlan<T> = {
  /** Wird auf die Liste gesetzt. */
  add: T[];
  /** Steht schon offen auf der Liste und wird uebersprungen. */
  skipped: T[];
};

/**
 * Entscheidet, was von einer Vorlage tatsaechlich auf die Liste kommt
 * (FR-5.4, architecture.md 4.4).
 *
 * Uebersprungen wird, was **offen** schon draufsteht - erkannt an der
 * Produkt-ID, ersatzweise am Namen ohne Ruecksicht auf Gross- und
 * Kleinschreibung. Der Name als zweiter Weg ist noetig, weil ein Artikel seine
 * Produktverknuepfung verlieren kann: Wird ein Produkt aus dem Katalog
 * geloescht, bleibt der Listeneintrag als Text stehen (ADR-007). Ohne den
 * Namensvergleich stuende er nach dem Anwenden doppelt da.
 *
 * **Abgehakte Artikel zaehlen nicht.** Wer Milch schon im Wagen hat und
 * mitten im Einkauf eine Vorlage anwendet, bekommt sie nicht ein zweites Mal
 * auf die Liste - aber wer den Einkauf abgeschlossen hat, sehr wohl: Dann ist
 * der abgehakte Artikel ohnehin verschwunden.
 *
 * Warum ueberspringen und nicht die Menge zusammenzaehlen: Zwei Quellen fuer
 * dieselbe Menge sind eine Rechnung, die niemand nachvollziehen kann. "Steht
 * schon da, bleibt wie es ist" ist die Regel, die man im Laden im Kopf hat.
 */
export function planTemplateApply<T extends { productId: string | null; name: string }>(
  templateItems: T[],
  targetItems: TargetItem[],
): TemplateApplyPlan<T> {
  const openProductIds = new Set(
    targetItems
      .filter((item) => !item.isChecked)
      .map((item) => item.productId)
      .filter((id): id is string => id !== null),
  );

  const openNames = new Set(
    targetItems.filter((item) => !item.isChecked).map((item) => item.name.toLowerCase()),
  );

  const add: T[] = [];
  const skipped: T[] = [];

  for (const item of templateItems) {
    const alreadyThere =
      (item.productId !== null && openProductIds.has(item.productId)) ||
      openNames.has(item.name.toLowerCase());

    if (alreadyThere) {
      skipped.push(item);
      continue;
    }

    // Auch innerhalb der Vorlage selbst nicht doppelt: Eine Vorlage kann
    // denselben Artikel zweimal enthalten, wenn sie aus einer Liste stammt,
    // auf der er zweimal stand.
    if (item.productId !== null) {
      openProductIds.add(item.productId);
    }
    openNames.add(item.name.toLowerCase());

    add.push(item);
  }

  return { add, skipped };
}

export type TemplateLike = {
  id: string;
  name: string;
  createdAt: number;
};

export type TemplateCount = {
  templateId: string;
  itemCount: number;
};

export type TemplateOverviewRow = {
  id: string;
  name: string;
  itemCount: number;
};

/**
 * Die Vorlagenuebersicht (FR-5.5).
 *
 * Sortiert nach Namen und nicht nach Alter: Eine Vorlage sucht man ueber
 * ihren Namen ("Wocheneinkauf"), nicht ueber den Zeitpunkt, an dem man sie
 * angelegt hat. Bei Listen ist das anders - die haben eine gewachsene
 * Reihenfolge, Vorlagen sind ein Nachschlagewerk.
 */
export function buildTemplateOverview(
  templates: TemplateLike[],
  counts: TemplateCount[],
): TemplateOverviewRow[] {
  const byTemplate = new Map(counts.map((entry) => [entry.templateId, entry.itemCount]));

  return [...templates]
    .sort((a, b) => {
      const byName = a.name.localeCompare(b.name, 'de');
      return byName !== 0 ? byName : a.id.localeCompare(b.id);
    })
    .map((template) => ({
      id: template.id,
      name: template.name,
      itemCount: byTemplate.get(template.id) ?? 0,
    }));
}
