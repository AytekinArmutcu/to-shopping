import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
} from 'expo-router';
import type { ColorSchemeName } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

/**
 * Material-3-Farbwelt in Gruen (ADR-009).
 *
 * Die Werte stammen aus einem Material-3-Farbschema mit Gruen als Grundfarbe.
 * Sie werden vollstaendig gesetzt statt einzelne Rollen zu ueberschreiben:
 * Material 3 leitet Kontraste zwischen zusammengehoerigen Rollen ab
 * ("primary" / "onPrimary"), und ein einzeln geaenderter Wert zerstoert diese
 * Beziehung - deshalb die Regel in CLAUDE.md, Farbrollen nicht anzufassen.
 *
 * Dark Mode folgt der Systemeinstellung, es gibt keinen Schalter (ADR-010).
 */
const lightColors = {
  primary: 'rgb(30, 108, 51)',
  onPrimary: 'rgb(255, 255, 255)',
  primaryContainer: 'rgb(167, 245, 172)',
  onPrimaryContainer: 'rgb(0, 33, 8)',
  secondary: 'rgb(82, 99, 81)',
  onSecondary: 'rgb(255, 255, 255)',
  secondaryContainer: 'rgb(213, 232, 208)',
  onSecondaryContainer: 'rgb(16, 31, 17)',
  tertiary: 'rgb(56, 101, 110)',
  onTertiary: 'rgb(255, 255, 255)',
  tertiaryContainer: 'rgb(188, 235, 246)',
  onTertiaryContainer: 'rgb(0, 31, 36)',
  error: 'rgb(186, 26, 26)',
  onError: 'rgb(255, 255, 255)',
  errorContainer: 'rgb(255, 218, 214)',
  onErrorContainer: 'rgb(65, 0, 2)',
  background: 'rgb(252, 253, 246)',
  onBackground: 'rgb(26, 28, 25)',
  surface: 'rgb(252, 253, 246)',
  onSurface: 'rgb(26, 28, 25)',
  surfaceVariant: 'rgb(222, 229, 216)',
  onSurfaceVariant: 'rgb(66, 73, 64)',
  outline: 'rgb(114, 121, 111)',
  outlineVariant: 'rgb(194, 201, 189)',
  shadow: 'rgb(0, 0, 0)',
  scrim: 'rgb(0, 0, 0)',
  inverseSurface: 'rgb(47, 49, 45)',
  inverseOnSurface: 'rgb(240, 241, 234)',
  inversePrimary: 'rgb(140, 216, 146)',
  elevation: {
    level0: 'transparent',
    level1: 'rgb(240, 246, 234)',
    level2: 'rgb(233, 242, 227)',
    level3: 'rgb(226, 237, 220)',
    level4: 'rgb(224, 236, 218)',
    level5: 'rgb(219, 233, 213)',
  },
  surfaceDisabled: 'rgba(26, 28, 25, 0.12)',
  onSurfaceDisabled: 'rgba(26, 28, 25, 0.38)',
  backdrop: 'rgba(44, 50, 42, 0.4)',
};

const darkColors = {
  primary: 'rgb(140, 216, 146)',
  onPrimary: 'rgb(0, 57, 19)',
  primaryContainer: 'rgb(0, 82, 30)',
  onPrimaryContainer: 'rgb(167, 245, 172)',
  secondary: 'rgb(185, 204, 181)',
  onSecondary: 'rgb(37, 52, 37)',
  secondaryContainer: 'rgb(59, 75, 58)',
  onSecondaryContainer: 'rgb(213, 232, 208)',
  tertiary: 'rgb(160, 207, 217)',
  onTertiary: 'rgb(0, 54, 61)',
  tertiaryContainer: 'rgb(30, 77, 85)',
  onTertiaryContainer: 'rgb(188, 235, 246)',
  error: 'rgb(255, 180, 171)',
  onError: 'rgb(105, 0, 5)',
  errorContainer: 'rgb(147, 0, 10)',
  onErrorContainer: 'rgb(255, 218, 214)',
  background: 'rgb(26, 28, 25)',
  onBackground: 'rgb(226, 227, 220)',
  surface: 'rgb(26, 28, 25)',
  onSurface: 'rgb(226, 227, 220)',
  surfaceVariant: 'rgb(66, 73, 64)',
  onSurfaceVariant: 'rgb(194, 201, 189)',
  outline: 'rgb(140, 147, 136)',
  outlineVariant: 'rgb(66, 73, 64)',
  shadow: 'rgb(0, 0, 0)',
  scrim: 'rgb(0, 0, 0)',
  inverseSurface: 'rgb(226, 227, 220)',
  inverseOnSurface: 'rgb(47, 49, 45)',
  inversePrimary: 'rgb(30, 108, 51)',
  elevation: {
    level0: 'transparent',
    level1: 'rgb(30, 38, 30)',
    level2: 'rgb(33, 43, 33)',
    level3: 'rgb(35, 49, 36)',
    level4: 'rgb(36, 51, 37)',
    level5: 'rgb(38, 55, 39)',
  },
  surfaceDisabled: 'rgba(226, 227, 220, 0.12)',
  onSurfaceDisabled: 'rgba(226, 227, 220, 0.38)',
  backdrop: 'rgba(44, 50, 42, 0.4)',
};

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: { ...MD3LightTheme.colors, ...lightColors },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: { ...MD3DarkTheme.colors, ...darkColors },
};

export function themeFor(scheme: ColorSchemeName): MD3Theme {
  return scheme === 'dark' ? darkTheme : lightTheme;
}

/**
 * React Navigation bringt ein zweites, eigenes Theme mit - davon kommt der
 * Hintergrund der Screens. Wird nur Paper eingefaerbt, entsteht im Dark Mode
 * heller Hintergrund mit heller Schrift. Deshalb werden beide aus derselben
 * Farbquelle versorgt.
 */
export const navigationLightTheme = {
  ...NavigationDefaultTheme,
  colors: {
    ...NavigationDefaultTheme.colors,
    primary: lightTheme.colors.primary,
    background: lightTheme.colors.background,
    card: lightTheme.colors.surface,
    text: lightTheme.colors.onSurface,
    border: lightTheme.colors.outlineVariant,
    notification: lightTheme.colors.error,
  },
};

export const navigationDarkTheme = {
  ...NavigationDarkTheme,
  colors: {
    ...NavigationDarkTheme.colors,
    primary: darkTheme.colors.primary,
    background: darkTheme.colors.background,
    card: darkTheme.colors.surface,
    text: darkTheme.colors.onSurface,
    border: darkTheme.colors.outlineVariant,
    notification: darkTheme.colors.error,
  },
};

export function navigationThemeFor(scheme: ColorSchemeName) {
  return scheme === 'dark' ? navigationDarkTheme : navigationLightTheme;
}
