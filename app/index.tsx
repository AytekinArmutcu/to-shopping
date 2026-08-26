import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { StartupScreen } from '@/components/StartupScreen';
import { resolveStartTarget, type StartTarget } from '@/features/lists/repository';

/**
 * Route "/": entscheidet, womit die App startet (FR-1.5).
 *
 * Die Route selbst zeigt nichts an. Sie fragt, wo zuletzt gearbeitet wurde,
 * und leitet weiter - beim allerersten Start auf die frisch angelegte
 * Standardliste, sonst auf den gemerkten Screen (PRD Flow 1.1).
 *
 * Warum eine Weiterleitung und nicht einfach die Liste hier anzeigen: Damit es
 * die Uebersicht und die Liste als eigene Adressen gibt. Sonst haetten beide
 * denselben Platz im Verlauf, und "zurueck" waere nicht zu beantworten.
 */
export default function Index() {
  const [target, setTarget] = useState<StartTarget | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveStartTarget().then((next) => {
      if (!cancelled) {
        setTarget(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (target === null) {
    return <StartupScreen error={null} />;
  }

  if (target.listId === null) {
    return <Redirect href="/listen" />;
  }

  return <Redirect href={{ pathname: '/liste', params: { listId: target.listId } }} />;
}
