const {
  AndroidConfig,
  withAndroidColors,
  withAndroidColorsNight,
  withAppBuildGradle,
  withGradleProperties,
} = require('expo/config-plugins');

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
 *
 * 3. Startbildschirm im Dark Mode: Ohne diesen Eingriff steht der Hintergrund
 *    fest auf Weiss, und zwar in beiden Modi. Auf einem Telefon im Dark Mode
 *    blitzt beim Start eine weisse Flaeche auf, bevor die dunkle App
 *    erscheint - unangenehm hell und genau die Sorte Detail, die man erst im
 *    Bett bemerkt. Die Farben entsprechen "background" aus src/theme.
 *
 * 4. Signierung fuer die Auslieferung: Ein Release-Build wird von Expo mit dem
 *    mitgelieferten Debug-Schluessel signiert (ADR-025). Fuer den Play Store
 *    braucht es einen eigenen. Der Schluessel selbst gehoert **nicht** ins
 *    Repository (CLAUDE.md: keine Secrets im Repo) - deshalb liest der Build
 *    ihn aus Gradle-Eigenschaften, die ausserhalb des Projekts liegen. Fehlen
 *    sie, bleibt alles wie bisher: Debug-Signierung, damit E2E und die
 *    manuelle Abnahme unveraendert laufen.
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

/** Hintergrund des Startbildschirms - entspricht "background" aus src/theme. */
const SPLASH_LIGHT = '#FCFDF6';
const SPLASH_DARK = '#1A1C19';

const withSplashColors = (config) => {
  const light = withAndroidColors(config, (cfg) => {
    cfg.modResults = AndroidConfig.Colors.assignColorValue(cfg.modResults, {
      name: 'splashscreen_background',
      value: SPLASH_LIGHT,
    });
    return cfg;
  });

  return withAndroidColorsNight(light, (cfg) => {
    cfg.modResults = AndroidConfig.Colors.assignColorValue(cfg.modResults, {
      name: 'splashscreen_background',
      value: SPLASH_DARK,
    });
    return cfg;
  });
};

/**
 * Name der Gradle-Eigenschaft, an der der Build den eigenen Schluessel
 * erkennt. Sie und die drei zugehoerigen Werte gehoeren in
 * ~/.gradle/gradle.properties, nicht in das Projekt - siehe README.
 */
const SIGN_PROPERTY = 'TOSHOPPING_UPLOAD_STORE_FILE';

const RELEASE_SIGNING_BLOCK = [
  '        release {',
  `            if (project.hasProperty('${SIGN_PROPERTY}')) {`,
  `                storeFile file(${SIGN_PROPERTY})`,
  '                storePassword TOSHOPPING_UPLOAD_STORE_PASSWORD',
  '                keyAlias TOSHOPPING_UPLOAD_KEY_ALIAS',
  '                keyPassword TOSHOPPING_UPLOAD_KEY_PASSWORD',
  '            }',
  '        }',
  '',
].join('\n');

const withUploadSigning = (config) =>
  withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(SIGN_PROPERTY)) {
      return cfg;
    }

    cfg.modResults.contents = cfg.modResults.contents.replace(
      'signingConfigs {\n',
      `signingConfigs {\n${RELEASE_SIGNING_BLOCK}`,
    );

    // Nur der Release-Zweig wird umgestellt. Der Debug-Zweig behaelt seinen
    // Schluessel, damit "expo run:android" unveraendert laeuft.
    cfg.modResults.contents = cfg.modResults.contents.replace(
      '            // see https://reactnative.dev/docs/signed-apk-android.\n            signingConfig signingConfigs.debug',
      '            // see https://reactnative.dev/docs/signed-apk-android.\n' +
        `            signingConfig project.hasProperty('${SIGN_PROPERTY}') ? signingConfigs.release : signingConfigs.debug`,
    );

    return cfg;
  });

module.exports = (config) =>
  withUploadSigning(withSplashColors(withCmakeVersion(withArchitectures(config))));
