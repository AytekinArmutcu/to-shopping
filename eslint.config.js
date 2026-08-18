// ESLint flat config. Basis: eslint-config-expo, danach prettier zum Abschalten
// aller Formatierungsregeln – Formatierung macht ausschliesslich Prettier.
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  ...expoConfig,
  prettierConfig,
  {
    ignores: ['node_modules/**', '.expo/**', 'android/**', 'ios/**', 'src/db/migrations/**'],
  },
  {
    rules: {
      // Sichtbare Texte gehoeren nach src/i18n/locales/de.json (CLAUDE.md).
      // Kein automatischer Check moeglich, deshalb nur als Konvention dokumentiert.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
