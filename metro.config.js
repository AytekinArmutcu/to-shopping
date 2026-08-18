const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Testdateien gehoeren nie ins App-Bundle. Ohne diese Sperre wuerde eine
// Testdatei unter app/ als Route mitgebuendelt und zoege die Testbibliothek
// samt Node-Modulen ins Bundle - Metro bricht dann zur Laufzeit ab.
config.resolver.blockList = [/.*\.test\.(ts|tsx|js|jsx)$/];

module.exports = config;
