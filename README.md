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
| Android Studio | SDK Platform 35 **und 36**, Build-Tools 35, **CMake 3.31.6** | – |
| Android-Gerät oder Emulator | Android 8.0 oder neuer | `adb devices` |

Die Umgebungsvariable `ANDROID_HOME` muss auf das SDK zeigen, unter Windows üblicherweise
`%LOCALAPPDATA%\Android\Sdk`.

> **JDK-Version beachten.** Gradle und das Android Gradle Plugin unterstützen aktuell JDK 17 und 21.
> Mit einem neueren JDK (z. B. 24) bricht der native Build ab. Android Studio bringt ein passendes
> JDK 21 mit. Auf diesem Rechner liegt es unter `%LOCALAPPDATA%\Programs\Android Studio\jbr`,
> je nach Installationsart auch unter `C:\Program Files\Android\Android Studio\jbr`.
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
| `npm run android` | Nativer Build und Installation auf Gerät/Emulator (Entwicklung) |
| `npm run android:release` | Release-Build mit eingebettetem JavaScript – **Voraussetzung für `npm run e2e`** |
| `npm run typecheck` | TypeScript ohne Ausgabe prüfen |
| `npm run lint` | ESLint und Prettier prüfen |
| `npm run format` | Formatierung automatisch korrigieren |
| `npm test` | Unit- und Komponententests |
| `npm run test:watch` | Tests im Beobachtungsmodus |
| `npm run e2e` | Maestro-Smoke-Test auf dem Gerät |

### Maestro für die E2E-Tests

Maestro ist nicht Teil der npm-Abhängigkeiten, sondern wird einmalig separat installiert.
Es liegt weder bei winget noch als vertrauenswürdiges npm-Paket vor; bezogen wird es als ZIP
aus dem offiziellen Release-Bereich von `mobile-dev-inc/Maestro`.

Auf diesem Rechner ist **Maestro 2.8.0** benutzerweit entpackt nach:

```
%USERPROFILE%\maestro
```

Damit `npm run e2e` funktioniert, muss `%USERPROFILE%\maestro\bin` in der PATH-Variable liegen.
Einmalig in einer normalen PowerShell (keine Administratorrechte nötig, danach Terminal neu öffnen):

```powershell
[Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path","User") + ";$env:USERPROFILE\maestro\bin", "User")
```

> **Nicht `setx PATH "$env:PATH;…"` verwenden.** `$env:PATH` ist die zusammengesetzte Variable aus
> System- und Benutzer-PATH; `setx` schreibt sie komplett in den Benutzer-PATH, dupliziert damit
> den System-PATH und **kappt bei 1024 Zeichen ohne Warnung**. Der Befehl oben fasst ausschließlich
> den Benutzer-PATH an.

Ebenfalls einmalig, damit Gradle das richtige JDK nimmt (siehe JDK-Hinweis oben):

```powershell
setx JAVA_HOME "$env:LOCALAPPDATA\Programs\Android Studio\jbr"
```

Maestro braucht ein JDK. Wegen der JDK-Anmerkung oben sollte `JAVA_HOME` dabei auf das
JDK 21 von Android Studio zeigen. Die Flows liegen in [`e2e/`](e2e/).

**Wichtig: E2E-Tests brauchen einen Release-Build**, keinen Entwicklungs-Build (ADR-025):

```bash
npm run android:release
npm run e2e
```

Der Grund: Ein Entwicklungs-Build lädt sein JavaScript bei jedem Start vom Metro-Server – gemessen
83 Sekunden für 7,8 MB. Maestro startet die App zu Beginn jedes Flows neu und läuft dadurch in
Zeitgrenzen. Der Release-Build hat das JavaScript eingebettet und startet in Sekunden. Nach jeder
Codeänderung ist vor dem E2E-Lauf also ein neuer Release-Build nötig.

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
- **Windows-Pfadgrenze (MAX_PATH) – gelöst, aber wissenswert.** Der native C++-Build erzeugt
  Objektdateipfade, in denen der Projektpfad zweimal steckt; bei `react-native-gesture-handler`
  sind das rund 380 Zeichen. Das mit dem SDK ausgelieferte **ninja 1.10.2** bricht dabei mit
  `Filename longer than 260 characters` ab – und zwar unabhängig davon, ob Windows lange Pfade
  erlaubt, weil ninja die Grenze selbst prüft. Behoben in **ninja 1.12**
  ([ninja-build/ninja#1900](https://github.com/ninja-build/ninja/issues/1900)), das mit
  **CMake 3.31.6** ausgeliefert wird. Diese Version wird deshalb vom Config-Plugin erzwungen.

  Das Projekt in einen kürzeren Ordner zu verschieben hätte **nicht** gereicht: Selbst unter
  `C:\ts` bliebe der Pfad bei 299 Zeichen, weil CMake den Quellpfad im Objektdateinamen
  nachbildet. Nachgerechnet, nicht geschätzt.

  Ergänzend sinnvoll, einmalig in einer **PowerShell mit Administratorrechten**, danach neu starten:

  ```powershell
  New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force
  git config --system core.longpaths true
  ```

- **Nicht auf CMake 4.x wechseln.** Dort ist die Kompatibilität zu
  `cmake_minimum_required(VERSION < 3.5)` entfallen, woran mehrere native
  React-Native-Abhängigkeiten scheitern. 3.31.6 ist die getestete Version.

- **`plugins/withAndroidBuildConfig.js`** setzt die CMake-Version und beschränkt die
  Prozessorarchitekturen auf `arm64-v8a` (Galaxy S24) und `x86_64` (Emulator). Ohne dieses
  Plugin wären beide Einstellungen nach dem nächsten `expo prebuild` weg, weil `android/`
  neu erzeugt und nicht versioniert wird. Die Beschränkung senkte die Bauzeit von
  **2 h 48 min auf unter 2 Minuten**. Vor einer Store-Veröffentlichung prüfen, ob
  `armeabi-v7a` für ältere Geräte wieder aufzunehmen ist.

- **Keine Testdateien unter `app/`.** Alles dort ist eine Route und landet im App-Bundle –
  eine Testdatei zöge die Testbibliothek mitsamt Node-Modulen hinein, und die App startet
  nicht mehr. Typecheck, Lint und Unit-Tests bemerken das nicht, nur der E2E-Test.
  `metro.config.js` sperrt Testdateien zusätzlich aus dem Bundle aus.

- **Android SDK Platform 36 wird benötigt**, nicht nur 35 – React Native 0.86 kompiliert dagegen.
  Gradle installiert sie beim ersten Build selbst nach; schlägt das mit
  `FileAlreadyExistsException` fehl, liegt eine Dateileiche in `%LOCALAPPDATA%\Android\Sdk\.temp`.
  Ordner löschen und Build wiederholen, oder die Plattform in Android Studio unter
  **Settings → Languages & Frameworks → Android SDK** installieren.

- **CMake installiert Gradle nicht automatisch nach** – anders als SDK-Plattformen. Fehlt die
  Version, bricht der Build mit `[CXX1300] CMake '3.31.6' was not found in SDK` ab. Installation
  in Android Studio unter **Settings → Languages & Frameworks → Android SDK → SDK Tools**,
  dort **„Show Package Details"** anhaken, sonst sind die Versionen nicht sichtbar.

## Manuelle Abnahme auf einem echten Gerät

Punkt 5 der Quality Gates lässt sich weder automatisieren noch auf dem Emulator erledigen:
Haptik und Wischgefühl gibt es nur auf echter Hardware.

### Handy einmalig vorbereiten

1. **Einstellungen → Telefoninfo → Softwareinformationen** → siebenmal auf **Buildnummer** tippen.
   Android meldet „Sie sind jetzt ein Entwickler".
2. **Einstellungen → Entwickleroptionen** → **USB-Debugging** einschalten.
3. Handy per USB anschließen, am Handy **„USB-Debugging zulassen"** bestätigen
   (Häkchen bei „Von diesem Computer immer zulassen" setzen).
4. Prüfen: `adb devices` muss das Gerät mit dem Status `device` zeigen – nicht `unauthorized`.

### App installieren

```bash
npm run android:release
```

Baut den Release-Build und installiert ihn auf dem angeschlossenen Gerät. Danach kann das Kabel ab:
Der Release-Build hat sein JavaScript eingebettet und braucht weder Metro noch den Rechner.
Die App liegt im App-Menü und lässt sich zum echten Einkauf mitnehmen.

Für die tägliche Entwicklung stattdessen `npm run android` – dieser Build lädt Änderungen sofort
nach, braucht dafür aber einen laufenden `npm start` im selben WLAN.

## Auslieferung in den Play Store

Bis hierher wurde jeder Release-Build mit dem **Debug-Schlüssel** signiert, den
Expo mitliefert (ADR-025). Für den Play Store braucht es einen eigenen. Diesen
Schlüssel erzeugst du selbst – er darf niemanden sonst erreichen, und er darf
**nicht ins Repository**.

### 1. Schlüssel erzeugen (einmalig)

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore to-shopping-upload.keystore -alias to-shopping -keyalg RSA -keysize 2048 -validity 10000
```

`keytool` liegt im JDK von Android Studio, unter Windows hier:
`%LOCALAPPDATA%\Programs\Android Studio\jbr\bin\keytool.exe`

Der Befehl fragt nach einem Passwort und ein paar Angaben zur Person. Lege die
entstandene Datei **außerhalb des Projektordners** ab und sichere sie – geht sie
verloren, lässt sich die App im Play Store nicht mehr aktualisieren.

### 2. Dem Build sagen, wo der Schlüssel liegt

Trage die vier Werte in deine persönliche Gradle-Datei ein – **nicht** in das
Projekt:

`%USERPROFILE%\.gradle\gradle.properties`

```properties
TOSHOPPING_UPLOAD_STORE_FILE=C:/Pfad/ausserhalb/des/Projekts/to-shopping-upload.keystore
TOSHOPPING_UPLOAD_STORE_PASSWORD=dein-passwort
TOSHOPPING_UPLOAD_KEY_ALIAS=to-shopping
TOSHOPPING_UPLOAD_KEY_PASSWORD=dein-passwort
```

Der Build prüft, ob diese Eigenschaften existieren. Fehlen sie, signiert er
weiter mit dem Debug-Schlüssel – E2E-Läufe und die manuelle Abnahme laufen also
unverändert, auch ohne eingerichteten Schlüssel.

### 3. Das Bundle bauen

Der Play Store nimmt kein APK, sondern ein **Android App Bundle**:

```bash
cd android && ./gradlew bundleRelease
```

Das Ergebnis liegt in `android/app/build/outputs/bundle/release/app-release.aab`.

### 4. Vor dem ersten Upload

Diese Punkte stehen in `docs/compliance.md` und sind **nicht** vom Code
abgedeckt:

| Aufgabe | Was zu tun ist |
|---|---|
| C-1 | Name, Anschrift, Kontakt-E-Mail für die Datenschutzerklärung festlegen |
| C-2 | `docs/datenschutz.md` ausfüllen – die Lücken sind mit `[…]` markiert |
| C-3 | Datenschutzerklärung veröffentlichen, URL in der Play Console eintragen |
| C-4 | Data-Safety-Formular ausfüllen (hängt davon ab, ob OTA eingerichtet wird) |
| C-5 | IARC-Fragebogen zur Altersfreigabe |
| C-6 | Manifest auf Berechtigungen prüfen – siehe unten |
| C-7 | Händlerstatus als Nicht-Händler erklären |

**C-6 nachprüfen** – nach jedem neuen Paket zu wiederholen:

```bash
grep -o 'uses-permission android:name="[^"]*"' android/app/build/intermediates/merged_manifest/release/*/AndroidManifest.xml | sort -u
```

Erwartet werden genau drei Einträge: `INTERNET`, `VIBRATE` und die app-interne
`DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. Alles andere gehört geprüft und in
`app.json` unter `android.blockedPermissions` entfernt.

### 5. Architekturen prüfen

Der Build erzeugt derzeit nur `arm64-v8a` und `x86_64` (siehe
`plugins/withAndroidBuildConfig.js`). Das deckt alle Telefone der letzten Jahre
ab. Sollen sehr alte Geräte unterstützt werden, ist `armeabi-v7a` wieder
aufzunehmen – zum Preis einer deutlich längeren Bauzeit.
