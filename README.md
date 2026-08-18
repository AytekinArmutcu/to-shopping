# To-Shopping

Einkaufslisten-App für Android. Alle Daten bleiben lokal auf dem Gerät – kein Backend, keine Konten, kein Tracking.

Diese Datei richtet sich an jemanden, der das Projekt zum ersten Mal öffnet. Die inhaltliche Dokumentation liegt in [`docs/`](docs/).

---

## Voraussetzungen

| Werkzeug | Version | Prüfen mit |
|---|---|---|
| Node.js | ≥ 20 (entwickelt mit 22.13) | `node --version` |
| npm | ≥ 10 | `npm --version` |
| Git | beliebig | `git --version` |
| JDK | **17 oder 21** – nicht neuer (siehe unten) | `java -version` |
| Android Studio | mit Android SDK Platform 35 und Build-Tools 35 | – |
| Android-Gerät oder Emulator | Android 8.0 oder neuer | `adb devices` |

Die Umgebungsvariable `ANDROID_HOME` muss auf das SDK zeigen, unter Windows üblicherweise
`%LOCALAPPDATA%\Android\Sdk`.

> **JDK-Version beachten.** Gradle und das Android Gradle Plugin unterstützen aktuell JDK 17 und 21.
> Mit einem neueren JDK (z. B. 24) bricht der native Build ab. Android Studio bringt ein passendes
> JDK mit; der Pfad dorthin lautet üblicherweise `C:\Program Files\Android\Android Studio\jbr`.
> Entweder `JAVA_HOME` darauf setzen oder in `android/gradle.properties` `org.gradle.java.home` eintragen.

## Einrichten

```bash
git clone <repo-url>
cd To-Shopping
npm install
cp .env.example .env
```

`.env` wird nicht versioniert. Nur Variablen mit dem Präfix `EXPO_PUBLIC_` landen im App-Bundle –
dort gehören **keine Secrets** hinein, sie sind im Bundle lesbar.

## Starten

```bash
npm run android
```

Baut die App und installiert sie auf dem angeschlossenen Gerät oder dem laufenden Emulator.
Der erste Durchlauf dauert einige Minuten, weil das native Android-Projekt erzeugt und Gradle
alle Abhängigkeiten lädt.

Danach genügt für den Alltag:

```bash
npm start
```

Der Ordner `android/` wird dabei erzeugt und ist bewusst **nicht** versioniert – er entsteht aus
`app.json` und den Expo-Plugins neu.

## Kommandos

| Kommando | Zweck |
|---|---|
| `npm start` | Expo-Entwicklungsserver |
| `npm run android` | Nativer Build und Installation auf Gerät/Emulator |
| `npm run typecheck` | TypeScript ohne Ausgabe prüfen |
| `npm run lint` | ESLint und Prettier prüfen |
| `npm run format` | Formatierung automatisch korrigieren |
| `npm test` | Unit- und Komponententests |
| `npm run test:watch` | Tests im Beobachtungsmodus |
| `npm run e2e` | Maestro-Smoke-Test auf dem Gerät |

### Maestro für die E2E-Tests

Maestro ist nicht Teil der npm-Abhängigkeiten und wird einmalig separat installiert –
siehe die offizielle Installationsanleitung von Maestro. Danach muss `maestro` im `PATH` liegen.
Die Flows liegen in [`e2e/`](e2e/).

## Qualitätssicherung

Eine Aufgabe gilt erst als fertig, wenn **alle fünf** Punkte erfüllt sind:

1. `npm run typecheck` grün
2. `npm run lint` grün
3. `npm test` grün
4. `npm run e2e` grün
5. Manuelle Abnahme auf einem echten Gerät, **hell und dunkel**

## Projektstruktur

```
app/          Expo Router – eine Datei = eine Route
src/db/       Schema, Migrationen, Startkatalog
src/features/ Fachlichkeit je Domäne: repository.ts (DB) + logic.ts (rein, getestet)
src/theme/    Material-3-Farbschema
src/i18n/     alle sichtbaren Texte
src/lib/      Hilfsfunktionen
src/store/    UI-Zustand (keine Daten)
e2e/          Maestro-Flows
docs/         Produkt- und Architekturdokumentation
```

**Zwei Regeln, die den Aufbau tragen** (vollständig in [`CLAUDE.md`](CLAUDE.md)):

- Screens greifen nie direkt auf die Datenbank zu, sondern nur über Repository-Funktionen.
- Fachlogik kennt die Datenbank nicht – Sortierung, Ranking und Formatprüfung sind reine
  Funktionen und deshalb ohne laufende App testbar.

## Dokumentation

| Datei | Inhalt |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Problem, Zielgruppe, User-Flows, Anforderungen, Nicht-Ziele |
| [`docs/architecture.md`](docs/architecture.md) | Stack, Datenmodell, Algorithmen, Dateiformate |
| [`docs/decisions.md`](docs/decisions.md) | Architekturentscheidungen mit verworfenen Alternativen |
| [`docs/compliance.md`](docs/compliance.md) | Datenschutz und Store-Pflichten |
| [`docs/roadmap.md`](docs/roadmap.md) | Meilensteine und Tasks |

## Bekannte Besonderheiten

- **`overrides` in `package.json`:** `react-dom` und `react-test-renderer` sind auf `19.2.3`
  festgenagelt. Ihre neuesten Versionen verlangen React `^19.2.8`, Expo SDK 57 liefert aber
  React `19.2.3`. Ohne die Overrides bricht `npm install` mit einem Peer-Dependency-Konflikt ab.
  Beim nächsten SDK-Wechsel prüfen, ob sie noch nötig sind.
- **Markdown ist von Prettier ausgenommen**, damit die Tabellen in `docs/` unverändert bleiben.
