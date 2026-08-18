import HomePlaceholder from '@/components/HomePlaceholder';

/**
 * Route "/". Bewusst duenn: Routen unter app/ halten kein Aussehen und keine
 * Fachlogik, sie setzen nur zusammen. Siehe CLAUDE.md, Schichtenregeln.
 */
export default function Index() {
  return <HomePlaceholder />;
}
