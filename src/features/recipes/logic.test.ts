import type { TargetItem } from '@/features/templates/logic';

import {
  buildRecipeIngredients,
  buildRecipeOverview,
  cleanRecipeName,
  cleanRecipeNote,
  cleanRecipeSteps,
  detachMissingProducts,
  MAX_RECIPE_NOTE_LENGTH,
  MAX_STEP_LENGTH,
  moveStep,
  planRecipeReset,
  planRecipeShopping,
  planWeeklyShopping,
  type RecipeIngredient,
  type RecipeLike,
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
