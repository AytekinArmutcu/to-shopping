import type { PantrySection } from '@/features/pantry/logic';
import type { TargetItem } from '@/features/templates/logic';

import {
  buildRecipeIngredients,
  buildRecipeOverview,
  cleanRecipeName,
  cleanRecipeNote,
  cleanRecipeSteps,
  detachMissingProducts,
  filterRecipeOverview,
  formatWithParam,
  isRecipeFilter,
  MAX_RECIPE_NOTE_LENGTH,
  MAX_STEP_LENGTH,
  moveStep,
  parseWithParam,
  planRecipeReset,
  planRecipeShopping,
  planWeeklyShopping,
  presentPantrySections,
  rankRecipesByIngredients,
  RECIPE_FILTERS,
  type RecipeIngredient,
  type RecipeLike,
  type RecipeOverviewRow,
} from './logic';

const zutat = (
  name: string,
  productId: string | null = `p-${name.toLowerCase()}`,
  position = 0,
): RecipeIngredient => ({
  productId,
  name,
  quantity: 1,
  unit: 'stueck',
  position,
});

/** Zutaten mit fortlaufenden Positionen, wie sie aus der Datenbank kommen. */
const zutaten = (...items: RecipeIngredient[]): RecipeIngredient[] =>
  items.map((item, index) => ({ ...item, position: index }));

const eintrag = (name: string, productId: string | null, isChecked = false): TargetItem => ({
  productId,
  name,
  isChecked,
});

const rezept = (name: string, id = `r-${name.toLowerCase()}`, isBuiltin = true): RecipeLike => ({
  id,
  name,
  isBuiltin,
  note: null,
});

const namen = (items: { name: string }[]) => items.map((item) => item.name);

describe('planRecipeShopping', () => {
  it('Vorrat schlaegt Liste: im Vorrat und auf der Liste heisst da (T-14.3)', () => {
    const plan = planRecipeShopping([zutat('Milch')], ['p-milch'], [eintrag('Milch', 'p-milch')]);

    expect(namen(plan.have)).toEqual(['Milch']);
    expect(plan.onList).toEqual([]);
    expect(plan.missing).toEqual([]);
  });

  it('auf der Liste, nicht im Vorrat heisst onList (T-14.3)', () => {
    const plan = planRecipeShopping([zutat('Milch')], [], [eintrag('Milch', 'p-milch')]);

    expect(namen(plan.onList)).toEqual(['Milch']);
    expect(plan.have).toEqual([]);
    expect(plan.missing).toEqual([]);
  });

  it('weder im Vorrat noch auf der Liste heisst missing (T-14.3)', () => {
    const plan = planRecipeShopping([zutat('Milch')], ['p-butter'], [eintrag('Brot', 'p-brot')]);

    expect(namen(plan.missing)).toEqual(['Milch']);
  });

  it('erkennt eine Zutat ohne Produkt am Namen auf der Liste (T-14.3)', () => {
    const plan = planRecipeShopping(
      [zutat('Hackfleisch', null)],
      [],
      [eintrag('hackfleisch', null)],
    );

    expect(namen(plan.onList)).toEqual(['Hackfleisch']);
  });

  it('eine Zutat ohne Produkt ist nie da, sonst fehlt sie (T-14.3)', () => {
    // Auch ein Vorratseintrag mit gleichem Namen hilft nicht - der Vorrat kennt
    // nur Produkt-IDs (ADR-043).
    const plan = planRecipeShopping([zutat('Hackfleisch', null)], ['p-hackfleisch'], []);

    expect(plan.have).toEqual([]);
    expect(namen(plan.missing)).toEqual(['Hackfleisch']);
  });

  it('ein abgehakter Listeneintrag zaehlt nicht als auf der Liste (T-14.3)', () => {
    const plan = planRecipeShopping([zutat('Milch')], [], [eintrag('Milch', 'p-milch', true)]);

    expect(namen(plan.missing)).toEqual(['Milch']);
    expect(plan.onList).toEqual([]);
  });

  it('erkennt einen Listeneintrag an der Produkt-ID, auch bei anderem Namen (T-14.3)', () => {
    const plan = planRecipeShopping(
      [zutat('Hackfleisch', 'p-hack')],
      [],
      [eintrag('Rinderhack', 'p-hack')],
    );

    expect(namen(plan.onList)).toEqual(['Hackfleisch']);
  });

  it('behaelt in jeder Gruppe die Reihenfolge der Eingabe (T-14.3)', () => {
    const plan = planRecipeShopping(
      [
        zutat('Zwiebel'),
        zutat('Butter'),
        zutat('Nudeln'),
        zutat('Ei'),
        zutat('Apfel'),
        zutat('Mehl'),
      ],
      ['p-zwiebel', 'p-apfel'],
      [eintrag('Mehl', 'p-mehl'), eintrag('Butter', 'p-butter')],
    );

    expect(namen(plan.have)).toEqual(['Zwiebel', 'Apfel']);
    expect(namen(plan.onList)).toEqual(['Butter', 'Mehl']);
    expect(namen(plan.missing)).toEqual(['Nudeln', 'Ei']);
  });

  it('legt das zweite Vorkommen derselben Zutat zu onList, wie planTemplateApply (T-14.3)', () => {
    const plan = planRecipeShopping([zutat('Milch'), zutat('Milch')], [], []);

    expect(plan.missing).toHaveLength(1);
    expect(plan.onList).toHaveLength(1);
  });

  it('gibt die Objekte der Eingabe unveraendert zurueck (T-14.3)', () => {
    const milch = zutat('Milch');
    const plan = planRecipeShopping([milch], [], []);

    expect(plan.missing[0]).toBe(milch);
  });

  it('kommt mit einem leeren Rezept zurecht (T-14.3)', () => {
    expect(planRecipeShopping([], ['p-milch'], [])).toEqual({
      staple: [],
      have: [],
      onList: [],
      missing: [],
    });
  });
});

describe('buildRecipeOverview', () => {
  it('stellt "Alles da" zuerst (T-14.3)', () => {
    const rows = buildRecipeOverview(
      [rezept('Bolognese'), rezept('Pfannkuchen')],
      {
        'r-bolognese': zutaten(zutat('Nudeln'), zutat('Hackfleisch')),
        'r-pfannkuchen': zutaten(zutat('Mehl'), zutat('Ei')),
      },
      ['p-mehl', 'p-ei', 'p-nudeln'],
      [],
    );

    expect(rows.map((row) => row.name)).toEqual(['Pfannkuchen', 'Bolognese']);
    expect(rows.map((row) => row.missingCount)).toEqual([0, 1]);
    expect(rows.map((row) => row.totalCount)).toEqual([2, 2]);
  });

  it('sortiert bei Gleichstand nach deutschem Alphabet, dann nach ID (T-14.3)', () => {
    const rows = buildRecipeOverview(
      [
        rezept('Zucchini-Pfanne'),
        rezept('Äpfel im Ofen'),
        rezept('Brot', 'r-b'),
        rezept('Brot', 'r-a'),
      ],
      new Map(),
      [],
      [],
    );

    expect(rows.map((row) => row.id)).toEqual([
      'r-äpfel im ofen',
      'r-a',
      'r-b',
      'r-zucchini-pfanne',
    ]);
  });

  it('nennt hoechstens zwei fehlende Namen, in Rezeptreihenfolge (T-14.3)', () => {
    const rows = buildRecipeOverview(
      [rezept('Lasagne')],
      new Map([
        [
          'r-lasagne',
          [
            zutat('Tomaten', 'p-tomaten', 3),
            zutat('Nudelplatten', 'p-nudelplatten', 0),
            zutat('Hackfleisch', 'p-hackfleisch', 2),
            zutat('Zwiebel', 'p-zwiebel', 1),
          ],
        ],
      ]),
      ['p-zwiebel'],
      [],
    );

    expect(rows[0]?.missingCount).toBe(3);
    expect(rows[0]?.missingNames).toEqual(['Nudelplatten', 'Hackfleisch']);
  });

  it('markiert Rezepte aus dem Wochenplan (T-14.3)', () => {
    const rows = buildRecipeOverview([rezept('Bolognese'), rezept('Suppe')], {}, [], ['r-suppe']);

    expect(rows.find((row) => row.id === 'r-suppe')?.inPlan).toBe(true);
    expect(rows.find((row) => row.id === 'r-bolognese')?.inPlan).toBe(false);
  });

  it('zaehlt eine Zutat auf der Liste trotzdem als fehlend (T-14.3)', () => {
    // Die Uebersicht bekommt die Liste gar nicht - "Alles da" heisst
    // "ich kann heute kochen" (FR-10.3).
    const rows = buildRecipeOverview(
      [rezept('Pfannkuchen')],
      { 'r-pfannkuchen': zutaten(zutat('Mehl'), zutat('Ei')) },
      ['p-mehl'],
      [],
    );

    expect(rows[0]?.missingCount).toBe(1);
    expect(rows[0]?.missingNames).toEqual(['Ei']);
  });

  it('zaehlt eine Zutat ohne Produkt als fehlend (T-14.3)', () => {
    const rows = buildRecipeOverview(
      [rezept('Bolognese')],
      { 'r-bolognese': zutaten(zutat('Hackfleisch', null)) },
      ['p-hackfleisch'],
      [],
    );

    expect(rows[0]?.missingCount).toBe(1);
  });

  it('stellt ein leeres Rezept zu "Alles da" (T-14.3)', () => {
    const rows = buildRecipeOverview(
      [rezept('Bolognese'), rezept('Neu', 'r-neu', false)],
      { 'r-bolognese': zutaten(zutat('Nudeln')) },
      [],
      [],
    );

    expect(rows[0]).toEqual({
      id: 'r-neu',
      name: 'Neu',
      isBuiltin: false,
      totalCount: 0,
      missingCount: 0,
      missingNames: [],
      inPlan: false,
    });
  });

  it('liest bei einem Objekt nur eigene Schluessel (T-14.3)', () => {
    const rows = buildRecipeOverview([rezept('Konstrukt', 'constructor')], {}, [], []);

    expect(rows[0]?.totalCount).toBe(0);
  });
});

describe('planWeeklyShopping', () => {
  it('vereinigt fehlende Zutaten ueber zwei Rezepte ohne Dopplung (T-14.3)', () => {
    const plan = planWeeklyShopping(
      [
        zutaten(zutat('Nudeln'), zutat('Hackfleisch'), zutat('Tomaten')),
        zutaten(zutat('Hackfleisch'), zutat('Nudelplatten'), zutat('Tomaten')),
      ],
      [],
      [],
    );

    expect(plan.productIds).toEqual(['p-nudeln', 'p-hackfleisch', 'p-tomaten', 'p-nudelplatten']);
    expect(plan.skipped).toBe(0);
  });

  it('ueberspringt Vorrat und Liste und zaehlt das in skipped (T-14.3)', () => {
    const plan = planWeeklyShopping(
      [
        zutaten(zutat('Nudeln'), zutat('Hackfleisch'), zutat('Zwiebel')),
        zutaten(zutat('Zwiebel'), zutat('Kartoffeln')),
      ],
      ['p-zwiebel'],
      [eintrag('Nudeln', 'p-nudeln')],
    );

    expect(plan.productIds).toEqual(['p-hackfleisch', 'p-kartoffeln']);
    // Zwiebel zweimal im Vorrat, Nudeln einmal auf der Liste - vor der Vereinigung gezaehlt.
    expect(plan.skipped).toBe(3);
  });

  it('meldet Zutaten ohne Produkt gesondert und je Name einmal (T-14.3)', () => {
    const plan = planWeeklyShopping(
      [
        zutaten(zutat('Hackfleisch', null), zutat('Nudeln')),
        zutaten(zutat('hackfleisch', null), zutat('Kraeuter', null)),
      ],
      [],
      [],
    );

    expect(plan.unresolvedNames).toEqual(['Hackfleisch', 'Kraeuter']);
    expect(plan.productIds).toEqual(['p-nudeln']);
  });

  it('kommt mit einem leeren Wochenplan zurecht (T-14.3)', () => {
    expect(planWeeklyShopping([], ['p-milch'], [eintrag('Milch', 'p-milch')])).toEqual({
      productIds: [],
      unresolvedNames: [],
      skipped: 0,
      staples: 0,
    });
    expect(planWeeklyShopping([[]], [], [])).toEqual({
      productIds: [],
      unresolvedNames: [],
      skipped: 0,
      staples: 0,
    });
  });
});

describe('planRecipeReset', () => {
  it('stellt ein geloeschtes mitgeliefertes Rezept wieder her (T-14.3)', () => {
    const plan = planRecipeReset(['r-bolognese', 'r-suppe'], [{ id: 'r-suppe', isBuiltin: true }]);

    expect(plan.restore).toEqual(['r-bolognese', 'r-suppe']);
  });

  it('setzt ein vorhandenes mitgeliefertes Rezept zurueck (T-14.3)', () => {
    const plan = planRecipeReset(['r-suppe'], [{ id: 'r-suppe', isBuiltin: true }]);

    expect(plan.restore).toEqual(['r-suppe']);
    expect(plan.untouched).toEqual([]);
  });

  it('laesst eigene Rezepte unangetastet (T-14.3)', () => {
    const plan = planRecipeReset(
      ['r-suppe'],
      [
        { id: 'r-suppe', isBuiltin: true },
        { id: 'r-omas-kuchen', isBuiltin: false },
      ],
    );

    expect(plan.restore).toEqual(['r-suppe']);
    expect(plan.untouched).toEqual(['r-omas-kuchen']);
  });

  it('ein eigenes Rezept mit Seed-ID gewinnt (T-14.3)', () => {
    const plan = planRecipeReset(
      ['r-bolognese', 'r-suppe'],
      [{ id: 'r-bolognese', isBuiltin: false }],
    );

    expect(plan.restore).toEqual(['r-suppe']);
    expect(plan.untouched).toEqual(['r-bolognese']);
  });
});

describe('cleanRecipeName', () => {
  it('raeumt Leerzeichen auf wie bei Vorlagen (T-14.3)', () => {
    expect(cleanRecipeName('  Spaghetti   Bolognese ')).toBe('Spaghetti Bolognese');
  });

  it('macht aus leerer Eingabe null und kuerzt auf 60 Zeichen (T-14.3)', () => {
    expect(cleanRecipeName('   ')).toBeNull();
    expect(cleanRecipeName('x'.repeat(200))).toHaveLength(60);
  });
});

describe('cleanRecipeNote', () => {
  it('schneidet Raender ab und macht aus leerer Notiz null (T-14.3)', () => {
    expect(cleanRecipeNote('  scharf anbraten \n')).toBe('scharf anbraten');
    expect(cleanRecipeNote(' \n ')).toBeNull();
  });

  it('kuerzt zu lange Notizen und laesst Zeilenumbrueche im Inneren stehen (T-14.3)', () => {
    expect(cleanRecipeNote('y'.repeat(500))).toHaveLength(MAX_RECIPE_NOTE_LENGTH);
    expect(cleanRecipeNote('Zeile 1\nZeile 2')).toBe('Zeile 1\nZeile 2');
  });
});

describe('buildRecipeIngredients', () => {
  it('zaehlt die Positionen lueckenlos neu durch (T-14.3)', () => {
    const items = buildRecipeIngredients([
      { productId: 'p-nudeln', name: 'Nudeln', quantity: 500, unit: 'g' },
      { productId: null, name: '  Basilikum  ', quantity: 1, unit: 'bund' },
    ]);

    expect(items).toEqual([
      { productId: 'p-nudeln', name: 'Nudeln', quantity: 500, unit: 'g', position: 0 },
      { productId: null, name: 'Basilikum', quantity: 1, unit: 'bund', position: 1 },
    ]);
  });

  it('verwirft Zutaten ohne Namen (T-14.3)', () => {
    const items = buildRecipeIngredients([
      { productId: null, name: '   ', quantity: 1, unit: 'stueck' },
      { productId: 'p-ei', name: 'Ei', quantity: 2, unit: 'stueck' },
      { productId: null, name: '', quantity: 1, unit: 'stueck' },
    ]);

    expect(items.map((item) => [item.name, item.position])).toEqual([['Ei', 0]]);
  });
});

describe('detachMissingProducts', () => {
  it('loest den Produktbezug, wenn das Produkt nicht mehr existiert (T-14.4)', () => {
    const items = [
      { id: 'r-x-i0', productId: 'p-hackfleisch', name: 'Hackfleisch', position: 0 },
      { id: 'r-x-i1', productId: 'p-nudeln', name: 'Nudeln', position: 1 },
    ];

    expect(detachMissingProducts(items, ['p-nudeln'])).toEqual([
      { id: 'r-x-i0', productId: null, name: 'Hackfleisch', position: 0 },
      { id: 'r-x-i1', productId: 'p-nudeln', name: 'Nudeln', position: 1 },
    ]);
  });

  it('laesst vorhandene Produkte und Zutaten ohne Produkt unveraendert (T-14.4)', () => {
    const items = [
      { productId: 'p-ei', name: 'Ei' },
      { productId: null, name: 'Basilikum' },
    ];

    expect(detachMissingProducts(items, ['p-ei'])).toEqual(items);
  });
});

describe('Grundvorrat', () => {
  it('eine Grundvorrat-Zutat landet in staple, nie in missing, auch ohne Vorrat (T-16.3)', () => {
    const plan = planRecipeShopping([zutat('Salz'), zutat('Nudeln')], [], [], ['p-salz']);

    expect(namen(plan.staple)).toEqual(['Salz']);
    expect(namen(plan.missing)).toEqual(['Nudeln']);
    expect(plan.have).toEqual([]);
    expect(plan.onList).toEqual([]);
  });

  it('Grundvorrat gewinnt ueber Vorrat (T-16.3)', () => {
    const plan = planRecipeShopping([zutat('Salz')], ['p-salz'], [], ['p-salz']);

    expect(namen(plan.staple)).toEqual(['Salz']);
    expect(plan.have).toEqual([]);
  });

  it('Grundvorrat gewinnt ueber "auf der Liste" (T-16.3)', () => {
    const plan = planRecipeShopping([zutat('Salz')], [], [eintrag('Salz', 'p-salz')], ['p-salz']);

    expect(namen(plan.staple)).toEqual(['Salz']);
    expect(plan.onList).toEqual([]);
    expect(plan.missing).toEqual([]);
  });

  it('eine Zutat ohne productId ist nie Grundvorrat (T-16.3)', () => {
    // Das Kennzeichen haengt am Produkt (ADR-047) - ohne Produkt kein Grundvorrat,
    // auch nicht ueber einen gleichlautenden Namen.
    const plan = planRecipeShopping([zutat('Salz', null)], [], [], ['p-salz']);

    expect(plan.staple).toEqual([]);
    expect(namen(plan.missing)).toEqual(['Salz']);
  });

  it('behaelt in staple die Reihenfolge der Eingabe (T-16.3)', () => {
    const plan = planRecipeShopping(
      [zutat('Pfeffer'), zutat('Nudeln'), zutat('Salz'), zutat('Oel')],
      ['p-nudeln'],
      [],
      ['p-oel', 'p-salz', 'p-pfeffer'],
    );

    expect(namen(plan.staple)).toEqual(['Pfeffer', 'Salz', 'Oel']);
    expect(namen(plan.have)).toEqual(['Nudeln']);
  });

  it('Uebersicht: missingCount ohne Grundvorrat, totalCount mit (T-16.3)', () => {
    const rows = buildRecipeOverview(
      [rezept('Bolognese')],
      { 'r-bolognese': zutaten(zutat('Salz'), zutat('Nudeln'), zutat('Pfeffer'), zutat('Hack')) },
      ['p-nudeln'],
      [],
      ['p-salz', 'p-pfeffer'],
    );

    expect(rows[0]?.totalCount).toBe(4);
    expect(rows[0]?.missingCount).toBe(1);
  });

  it('Uebersicht: nur Grundvorrat und Vorrat heisst "Alles da" (T-16.3)', () => {
    const rows = buildRecipeOverview(
      [rezept('Bolognese'), rezept('Pfannkuchen')],
      {
        'r-bolognese': zutaten(zutat('Nudeln'), zutat('Hack')),
        'r-pfannkuchen': zutaten(zutat('Salz'), zutat('Ei'), zutat('Mehl')),
      },
      ['p-ei'],
      [],
      ['p-salz', 'p-mehl'],
    );

    expect(rows.map((row) => [row.name, row.missingCount])).toEqual([
      ['Pfannkuchen', 0],
      ['Bolognese', 2],
    ]);
  });

  it('Uebersicht: missingNames nennt keinen Grundvorrat (T-16.3)', () => {
    const rows = buildRecipeOverview(
      [rezept('Bolognese')],
      { 'r-bolognese': zutaten(zutat('Salz'), zutat('Pfeffer'), zutat('Nudeln'), zutat('Hack')) },
      [],
      [],
      ['p-salz', 'p-pfeffer'],
    );

    expect(rows[0]?.missingNames).toEqual(['Nudeln', 'Hack']);
  });

  it('Wochenplan: Grundvorrat nicht in productIds, nicht in skipped, gezaehlt in staples (T-16.3)', () => {
    const plan = planWeeklyShopping(
      [
        zutaten(zutat('Salz'), zutat('Nudeln'), zutat('Zwiebel')),
        zutaten(zutat('Salz'), zutat('Pfeffer'), zutat('Kartoffeln')),
      ],
      ['p-zwiebel', 'p-salz'],
      [eintrag('Pfeffer', 'p-pfeffer')],
      ['p-salz', 'p-pfeffer'],
    );

    expect(plan.productIds).toEqual(['p-nudeln', 'p-kartoffeln']);
    // Nur die Zwiebel war da - Salz und Pfeffer waren nie gefragt.
    expect(plan.skipped).toBe(1);
    // Vor der Vereinigung: Salz zweimal, Pfeffer einmal.
    expect(plan.staples).toBe(3);
  });

  it('Wochenplan: Zutat ohne Produkt bleibt unaufgeloest, auch bei Grundvorrat-Namen (T-16.3)', () => {
    const plan = planWeeklyShopping([zutaten(zutat('Salz', null))], [], [], ['p-salz']);

    expect(plan.unresolvedNames).toEqual(['Salz']);
    expect(plan.staples).toBe(0);
  });

  it('ohne Grundvorrat verhaelt sich alles wie bisher (T-16.3)', () => {
    const items = zutaten(zutat('Salz'), zutat('Nudeln'), zutat('Hack'));
    const targets = [eintrag('Hack', 'p-hack')];

    expect(planRecipeShopping(items, ['p-salz'], targets, [])).toEqual(
      planRecipeShopping(items, ['p-salz'], targets),
    );
    expect(planRecipeShopping(items, ['p-salz'], targets).staple).toEqual([]);
    expect(planWeeklyShopping([items], [], targets).staples).toBe(0);
    expect(
      buildRecipeOverview([rezept('Bolognese')], { 'r-bolognese': items }, [], [])[0]?.missingCount,
    ).toBe(3);
  });
});

describe('cleanRecipeSteps', () => {
  it('verwirft leere Schritte und zaehlt die Positionen 0..n durch (T-16.3)', () => {
    expect(cleanRecipeSteps(['', 'Wasser kochen', '   ', ' \n\t ', 'Nudeln rein'])).toEqual([
      { position: 0, text: 'Wasser kochen' },
      { position: 1, text: 'Nudeln rein' },
    ]);
  });

  it('kollabiert Leerraum innerhalb einer Zeile, Zeilenumbrueche bleiben (T-16.3)', () => {
    expect(cleanRecipeSteps(['  Zwiebel   wuerfeln\t und \n  glasig   anbraten  '])).toEqual([
      { position: 0, text: 'Zwiebel wuerfeln und\nglasig anbraten' },
    ]);
  });

  it('kuerzt auf 500 Zeichen (T-16.3)', () => {
    const [step] = cleanRecipeSteps(['x'.repeat(800)]);

    expect(MAX_STEP_LENGTH).toBe(500);
    expect(step?.text).toHaveLength(MAX_STEP_LENGTH);
  });

  it('behaelt die Reihenfolge der Eingabe (T-16.3)', () => {
    expect(cleanRecipeSteps(['c', 'a', 'b']).map((step) => step.text)).toEqual(['c', 'a', 'b']);
    expect(cleanRecipeSteps([])).toEqual([]);
  });
});

describe('moveStep', () => {
  it('verschiebt einen Schritt nach vorn (T-16.3)', () => {
    expect(moveStep(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
    expect(moveStep(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('verschiebt einen Schritt nach hinten (T-16.3)', () => {
    expect(moveStep(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveStep(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });

  it('laesst die Reihenfolge bei ungueltigem Index unveraendert (T-16.3)', () => {
    const steps = ['a', 'b', 'c'];

    expect(moveStep(steps, -1, 0)).toEqual(steps);
    expect(moveStep(steps, 0, 3)).toEqual(steps);
    expect(moveStep(steps, 3, 0)).toEqual(steps);
    expect(moveStep(steps, 0.5, 1)).toEqual(steps);
    expect(moveStep([], 0, 0)).toEqual([]);
  });

  it('veraendert die Eingabe nicht und gibt ein neues Array zurueck (T-16.3)', () => {
    const steps = ['a', 'b', 'c'];
    const moved = moveStep(steps, 0, 2);

    expect(steps).toEqual(['a', 'b', 'c']);
    expect(moved).not.toBe(steps);
  });
});

/* ------------------------------------------------------------------ *
 * Filter der Uebersicht (T-17.1)
 * ------------------------------------------------------------------ */

const zeile = (
  name: string,
  missingCount = 0,
  id = `r-${name.toLowerCase()}`,
): RecipeOverviewRow => ({
  id,
  name,
  isBuiltin: true,
  totalCount: 5,
  missingCount,
  missingNames: [],
  inPlan: false,
});

const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

describe('filterRecipeOverview', () => {
  const rows = [zeile('A', 0), zeile('B', 1), zeile('C', 2), zeile('D', 5)];

  it('"all" laesst alle Zeilen stehen (T-17.1)', () => {
    expect(ids(filterRecipeOverview(rows, 'all'))).toEqual(['r-a', 'r-b', 'r-c', 'r-d']);
  });

  it('"allThere" zeigt nur Gerichte, bei denen nichts fehlt (T-17.1)', () => {
    expect(ids(filterRecipeOverview(rows, 'allThere'))).toEqual(['r-a']);
  });

  it('"almost" schliesst 0 und 1 fehlende ein, 2 nicht (T-17.1)', () => {
    expect(ids(filterRecipeOverview(rows, 'almost'))).toEqual(['r-a', 'r-b']);
  });

  it('behaelt die Reihenfolge der Eingabe (T-17.1)', () => {
    const unsortiert = [zeile('Z', 1), zeile('A', 0), zeile('M', 1)];

    expect(ids(filterRecipeOverview(unsortiert, 'almost'))).toEqual(['r-z', 'r-a', 'r-m']);
  });

  it('gibt ein neues Array zurueck, auch bei "all" (T-17.1)', () => {
    expect(filterRecipeOverview(rows, 'all')).not.toBe(rows);
  });
});

describe('isRecipeFilter', () => {
  it('erkennt die drei gueltigen Filter (T-17.1)', () => {
    expect(RECIPE_FILTERS).toEqual(['all', 'allThere', 'almost']);
    expect(RECIPE_FILTERS.every((filter) => isRecipeFilter(filter))).toBe(true);
  });

  it('lehnt Unbekanntes, andere Schreibweisen und Nicht-Strings ab (T-17.1)', () => {
    expect(isRecipeFilter('none')).toBe(false);
    expect(isRecipeFilter('ALL')).toBe(false);
    expect(isRecipeFilter('')).toBe(false);
    expect(isRecipeFilter(null)).toBe(false);
    expect(isRecipeFilter(undefined)).toBe(false);
    expect(isRecipeFilter(1)).toBe(false);
  });
});

describe('rankRecipesByIngredients', () => {
  const zutatenJeRezept = new Map<string, RecipeIngredient[]>([
    ['r-auflauf', zutaten(zutat('Nudeln'), zutat('Zucchini'), zutat('Kaese'))],
    ['r-pfanne', zutaten(zutat('Zucchini'), zutat('Paprika'))],
    ['r-suppe', zutaten(zutat('Kartoffel'), zutat('Lauch'))],
  ]);
  const rows = [zeile('Auflauf', 2), zeile('Pfanne', 0), zeile('Suppe', 1)];

  it('leere Auswahl zeigt alle Zeilen in ihrer Reihenfolge, matchCount 0 (T-17.1)', () => {
    const result = rankRecipesByIngredients(rows, zutatenJeRezept, []);

    expect(ids(result)).toEqual(['r-auflauf', 'r-pfanne', 'r-suppe']);
    expect(result.every((row) => row.matchCount === 0 && row.matchNames.length === 0)).toBe(true);
  });

  it('eine Zutat zeigt nur die Gerichte, die sie verwenden (T-17.1)', () => {
    const result = rankRecipesByIngredients(rows, zutatenJeRezept, ['p-lauch']);

    expect(ids(result)).toEqual(['r-suppe']);
    expect(result[0]?.matchCount).toBe(1);
    expect(result[0]?.matchNames).toEqual(['Lauch']);
  });

  it('zwei Zutaten: Gericht mit beiden vor Gericht mit einer (T-17.1)', () => {
    // Der Pfanne fehlt nichts, dem Auflauf fehlen zwei - die Trefferzahl entscheidet trotzdem zuerst.
    const result = rankRecipesByIngredients(rows, zutatenJeRezept, ['p-zucchini', 'p-kaese']);

    expect(ids(result)).toEqual(['r-auflauf', 'r-pfanne']);
    expect(result.map((row) => row.matchCount)).toEqual([2, 1]);
  });

  it('bei gleicher Trefferzahl zuerst weniger fehlende, dann deutsches Alphabet (T-17.1)', () => {
    const items = {
      'r-oel': zutaten(zutat('Zucchini')),
      'r-aepfel': zutaten(zutat('Zucchini')),
      'r-zebra': zutaten(zutat('Zucchini')),
      'r-wenig': zutaten(zutat('Zucchini')),
    };
    const kandidaten = [
      zeile('Zebra', 1),
      zeile('Öl', 1, 'r-oel'),
      zeile('Äpfel', 1, 'r-aepfel'),
      zeile('Wenig', 0),
    ];

    const result = rankRecipesByIngredients(kandidaten, items, ['p-zucchini']);

    expect(ids(result)).toEqual(['r-wenig', 'r-aepfel', 'r-oel', 'r-zebra']);
  });

  it('bei gleichem Namen entscheidet die ID (T-17.1)', () => {
    const items = { 'r-2': zutaten(zutat('Zucchini')), 'r-1': zutaten(zutat('Zucchini')) };

    const result = rankRecipesByIngredients(
      [zeile('Pfanne', 0, 'r-2'), zeile('Pfanne', 0, 'r-1')],
      items,
      ['p-zucchini'],
    );

    expect(ids(result)).toEqual(['r-1', 'r-2']);
  });

  it('dieselbe Zutat zweimal im Rezept zaehlt einmal (T-17.1)', () => {
    const items = { 'r-doppelt': zutaten(zutat('Zucchini'), zutat('Zucchini')) };

    const result = rankRecipesByIngredients([zeile('Doppelt')], items, ['p-zucchini']);

    expect(result[0]?.matchCount).toBe(1);
    expect(result[0]?.matchNames).toEqual(['Zucchini']);
  });

  it('matchNames stehen in Rezeptreihenfolge, nicht in Auswahlreihenfolge (T-17.1)', () => {
    const items = {
      'r-mix': [
        zutat('Paprika', 'p-paprika', 2),
        zutat('Zwiebel', 'p-zwiebel', 0),
        zutat('Reis', 'p-reis', 1),
      ],
    };

    const result = rankRecipesByIngredients([zeile('Mix')], items, ['p-paprika', 'p-zwiebel']);

    expect(result[0]?.matchNames).toEqual(['Zwiebel', 'Paprika']);
  });

  it('eine Zutat ohne productId matcht nie (T-17.1)', () => {
    const items = { 'r-frei': zutaten(zutat('Zucchini', null)) };

    expect(rankRecipesByIngredients([zeile('Frei')], items, ['p-zucchini'])).toEqual([]);
  });

  it('ein Gericht ohne Zutaten erscheint nicht (T-17.1)', () => {
    const result = rankRecipesByIngredients(
      [zeile('Leer'), zeile('Pfanne')],
      { 'r-pfanne': zutaten(zutat('Zucchini')) },
      ['p-zucchini'],
    );

    expect(ids(result)).toEqual(['r-pfanne']);
  });

  it('behaelt die Felder der Uebersichtszeile (T-17.1)', () => {
    const row = { ...zeile('Pfanne', 0), inPlan: true, missingNames: ['Salz'] };

    const [result] = rankRecipesByIngredients([row], zutatenJeRezept, ['p-paprika']);

    expect(result).toEqual({ ...row, matchCount: 1, matchNames: ['Paprika'] });
  });
});

describe('presentPantrySections', () => {
  const sections: PantrySection[] = [
    {
      key: 'gemuese',
      title: 'Gemüse',
      items: [
        { productId: 'p-zucchini', name: 'Zucchini', inPantry: true },
        { productId: 'p-lauch', name: 'Lauch', inPantry: false },
      ],
    },
    {
      key: 'milch',
      title: 'Milchprodukte',
      items: [{ productId: 'p-milch', name: 'Milch', inPantry: false }],
    },
  ];

  it('zeigt nur Vorhandene und laesst leere Abschnitte weg (T-17.1)', () => {
    const result = presentPantrySections(sections);

    expect(result).toHaveLength(1);
    expect(namen(result[0]?.items ?? [])).toEqual(['Zucchini']);
  });

  it('behaelt key und title des Abschnitts (T-17.1)', () => {
    const [result] = presentPantrySections(sections);

    expect(result?.key).toBe('gemuese');
    expect(result?.title).toBe('Gemüse');
  });

  it('ohne Vorhandenes bleibt nichts uebrig (T-17.1)', () => {
    expect(presentPantrySections(sections.slice(1))).toEqual([]);
  });
});

describe('parseWithParam / formatWithParam', () => {
  it('Roundtrip ergibt die IDs (T-17.1)', () => {
    const auswahl = ['p-zucchini', 'p-kaese', 'p-lauch'];

    expect(formatWithParam(auswahl)).toBe('p-zucchini,p-kaese,p-lauch');
    expect(parseWithParam(formatWithParam(auswahl))).toEqual(auswahl);
  });

  it('nimmt bei einem Array das erste Element (T-17.1)', () => {
    expect(parseWithParam(['p-a,p-b', 'p-c'])).toEqual(['p-a', 'p-b']);
    expect(parseWithParam([])).toEqual([]);
  });

  it('trimmt und verwirft Leeres (T-17.1)', () => {
    expect(parseWithParam(' p-a , ,p-b,, ')).toEqual(['p-a', 'p-b']);
    expect(parseWithParam('')).toEqual([]);
    expect(parseWithParam(undefined)).toEqual([]);
  });

  it('dedupliziert beim Lesen und beim Schreiben (T-17.1)', () => {
    expect(parseWithParam('p-a,p-b,p-a')).toEqual(['p-a', 'p-b']);
    expect(formatWithParam(['p-a', 'p-a', 'p-b'])).toBe('p-a,p-b');
    expect(parseWithParam(formatWithParam(['p-b', 'p-a', 'p-b']))).toEqual(['p-b', 'p-a']);
  });

  it('leere Auswahl wird zum leeren Parameter (T-17.1)', () => {
    expect(formatWithParam([])).toBe('');
  });
});
