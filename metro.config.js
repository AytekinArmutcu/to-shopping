const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Testdateien gehoeren nie ins App-Bundle. Ohne diese Sperre wuerde eine
// Testdatei unter app/ als Route mitgebuendelt und zoege die Testbibliothek
// samt Node-Modulen ins Bundle - Metro bricht dann zur Laufzeit ab.
//
// Bewusst ergaenzend statt ersetzend: Die Standardliste von Expo schliesst
// unter anderem .expo/types und Build-Ordner aus. Wer sie ueberschreibt,
// nimmt diese Ausschluesse still zurueck.
const defaultBlockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(defaultBlockList) ? defaultBlockList : [defaultBlockList]).filter(Boolean),
  /.*\.test\.(ts|tsx|js|jsx)$/,
];

// .sql gehoert zu den Quelldateien, damit die Drizzle-Migrationen aufgeloest
// werden koennen (zusammen mit babel-plugin-inline-import).
config.resolver.sourceExts.push('sql');

module.exports = config;
