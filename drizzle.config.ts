import type { Config } from 'drizzle-kit';

/**
 * Erzeugt Migrationen aus src/db/schema.ts nach src/db/migrations.
 *
 * Regel aus CLAUDE.md: Einmal erzeugte Migrationen werden nie nachtraeglich
 * geaendert - auch nicht waehrend der Entwicklung. Nur neue ergaenzen.
 */
export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
