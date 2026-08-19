import { ListScreen } from '@/features/lists/components/ListScreen';

/**
 * Route "/". Bewusst duenn: Routen unter app/ setzen zusammen, sie halten
 * weder Aussehen noch Fachlogik (CLAUDE.md).
 *
 * In M6 kommt hier die Weiterleitung auf die zuletzt genutzte Liste dazu;
 * solange es nur eine Liste gibt, ist das ueberfluessig.
 */
export default function Index() {
  return <ListScreen />;
}
