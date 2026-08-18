const { withGradleProperties, withAppBuildGradle } = require('expo/config-plugins');

/**
 * Config-Plugin fuer zwei Android-Build-Einstellungen, die ohne dieses Plugin
 * bei jedem "expo prebuild" verloren gingen - der Ordner android/ wird dabei
 * neu erzeugt und ist bewusst nicht versioniert.
 *
 * 1. CMake-Version: Das SDK liefert standardmaessig CMake 3.22.1 mit ninja
 *    1.10.2 aus. Dieses ninja bricht bei Pfaden ueber 260 Zeichen ab, was der
 *    C++-Build von react-native-gesture-handler unter Windows zuverlaessig
 *    ausloest. Behoben in ninja 1.12 (ninja-build/ninja#1900), das CMake
 *    3.31.6 mitbringt. Bewusst nicht CMake 4.x: Dort ist die Kompatibilitaet
 *    zu cmake_minimum_required < 3.5 entfallen, woran mehrere native
 *    React-Native-Abhaengigkeiten scheitern.
 *
 * 2. Architekturen: Standard sind vier ABIs, jede bedeutet einen kompletten
 *    C++-Durchlauf. Benoetigt werden nur arm64-v8a (Zielgeraet Galaxy S24)
 *    und x86_64 (Emulator). Das senkte die Bauzeit von 2 h 48 min auf Minuten.
 *    Vor einer Store-Veroeffentlichung pruefen, ob armeabi-v7a fuer aeltere
 *    Geraete wieder aufzunehmen ist.
 */
const CMAKE_VERSION = '3.31.6';
const ARCHITECTURES = 'arm64-v8a,x86_64';

const withArchitectures = (config) =>
  withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === 'property' && item.key === 'reactNativeArchitectures'),
    );
    cfg.modResults.push({
      type: 'property',
      key: 'reactNativeArchitectures',
      value: ARCHITECTURES,
    });
    return cfg;
  });

const withCmakeVersion = (config) =>
  withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes('cmake { version')) {
      return cfg;
    }
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /^android \{$/m,
      `android {\n    externalNativeBuild { cmake { version = "${CMAKE_VERSION}" } }`,
    );
    return cfg;
  });

module.exports = (config) => withCmakeVersion(withArchitectures(config));
