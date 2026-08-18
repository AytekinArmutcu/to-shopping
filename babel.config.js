module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Drizzle liefert Migrationen als .sql-Dateien aus. inline-import bettet
    // ihren Inhalt zur Bauzeit als String ein, damit sie im App-Bundle landen.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
