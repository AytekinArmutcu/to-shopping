import { router, Stack } from 'expo-router';
import { act, renderRouter } from 'expo-router/testing-library';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { goTo } from './navigation';

/*
 * Diese Tests fahren den echten Router von expo-router - mit Attrappen statt
 * der App-Screens. Sie halten fest, was auf dem Emulator gemessen wurde
 * (ADR-036): router.navigate laesst bei jeder Runde einen Screen gemountet
 * zurueck, goTo nicht. Aendert ein Update von expo-router dieses Verhalten,
 * schlaegt der erste Test fehl - dann ADR-036 neu pruefen.
 */

/** Wie viele Instanzen je Route gerade gemountet sind. */
const mounted = new Map<string, number>();

function screenFor(name: string) {
  return function MockScreen() {
    useEffect(() => {
      mounted.set(name, (mounted.get(name) ?? 0) + 1);
      return () => {
        mounted.set(name, (mounted.get(name) ?? 0) - 1);
      };
    }, []);
    return <Text>{name}</Text>;
  };
}

function renderApp(initialUrl: string) {
  mounted.clear();
  return renderRouter(
    {
      _layout: () => <Stack />,
      listen: screenFor('listen'),
      liste: screenFor('liste'),
      vorrat: screenFor('vorrat'),
      rezepte: screenFor('rezepte'),
      rezept: screenFor('rezept'),
      'rezepte-zutaten': screenFor('rezepte-zutaten'),
    },
    { initialUrl },
  );
}

type App = ReturnType<typeof renderApp>;

/** Die Routen des Stapels, unten zuerst. */
function stackOf(app: App): string[] {
  const root = app.getRouterState();
  const stack = root?.routes[root.index ?? 0]?.state;
  return (stack?.routes ?? []).map((route) => route.name);
}

/** Der Schluessel des Stapeleintrags einer Route - bleibt gleich, solange es derselbe Screen ist. */
function routeKeyOf(app: App, name: string): string | undefined {
  const root = app.getRouterState();
  const stack = root?.routes[root.index ?? 0]?.state;
  return stack?.routes.find((route) => route.name === name)?.key;
}

/** Viermal ein Rezept oeffnen und mit `back` zur Uebersicht zurueck. */
function fourRounds(back: () => void) {
  for (let round = 0; round < 4; round += 1) {
    act(() => router.push({ pathname: '/rezept', params: { recipeId: 'r-pfannkuchen' } }));
    act(back);
  }
}

describe('Zurueck zu einem benannten Ziel', () => {
  it('router.navigate legt die Uebersicht jedes Mal neu obendrauf (die Ursache)', () => {
    const app = renderApp('/listen');
    act(() => router.push('/rezepte'));

    fourRounds(() => router.navigate('/rezepte'));

    expect(stackOf(app)).toEqual([
      'listen',
      'rezepte',
      'rezept',
      'rezepte',
      'rezept',
      'rezepte',
      'rezept',
      'rezepte',
      'rezept',
      'rezepte',
    ]);
    expect(mounted.get('rezepte')).toBe(5);
    expect(mounted.get('rezept')).toBe(4);
  });

  it('goTo geht zur vorhandenen Uebersicht zurueck und schliesst, was darueber lag', () => {
    const app = renderApp('/listen');
    act(() => router.push('/rezepte'));

    fourRounds(() => goTo('/rezepte'));

    expect(stackOf(app)).toEqual(['listen', 'rezepte']);
    expect(mounted.get('rezepte')).toBe(1);
    expect(mounted.get('rezept')).toBe(0);
    expect(app.getPathname()).toBe('/rezepte');
  });

  it('goTo ersetzt den Screen, wenn das Ziel nicht im Verlauf liegt', () => {
    // Der Start auf einer Liste (FR-1.5): Darunter liegt keine Uebersicht.
    const app = renderApp('/liste?listId=l-1');

    act(() => goTo('/listen'));

    expect(stackOf(app)).toEqual(['listen']);
    expect(mounted.get('liste')).toBe(0);
  });

  it('goTo kehrt mit Parametern zur Liste zurueck, von der der Vorrat kam', () => {
    const app = renderApp('/listen');
    act(() => router.push({ pathname: '/liste', params: { listId: 'l-1' } }));
    act(() => router.push({ pathname: '/vorrat', params: { listId: 'l-1' } }));

    act(() => goTo({ pathname: '/liste', params: { listId: 'l-1' } }));

    expect(stackOf(app)).toEqual(['listen', 'liste']);
    expect(app.getPathnameWithParams()).toBe('/liste?listId=l-1');
    expect(mounted.get('liste')).toBe(1);
    expect(mounted.get('vorrat')).toBe(0);
  });

  it('goTo mit Parametern setzt sie an der vorhandenen Uebersicht, statt eine zweite anzulegen', () => {
    // Die Zutaten-Auswahl gibt ihr Ergebnis so zurueck (ADR-048, T-17.2).
    const app = renderApp('/listen');
    act(() => router.push('/rezepte'));
    const overviewKey = routeKeyOf(app, 'rezepte');
    act(() => router.push({ pathname: '/rezepte-zutaten', params: { with: '' } }));

    act(() => goTo({ pathname: '/rezepte', params: { with: 'p-zucchini,p-ei' } }));

    expect(stackOf(app)).toEqual(['listen', 'rezepte']);
    // Derselbe Eintrag im Stapel, nicht ein ersetzter mit neuem Schluessel.
    expect(routeKeyOf(app, 'rezepte')).toBe(overviewKey);
    expect(app.getPathnameWithParams()).toBe('/rezepte?with=p-zucchini%2Cp-ei');
    expect(mounted.get('rezepte')).toBe(1);
    expect(mounted.get('rezepte-zutaten')).toBe(0);
  });
});
