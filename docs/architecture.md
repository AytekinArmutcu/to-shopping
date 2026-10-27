# Architektur – To-Shopping

**Version:** 1.0
**Stand:** 2026-08-18
**Bezug:** [`PRD.md`](PRD.md) · Begründungen einzelner Entscheidungen in [`decisions.md`](decisions.md)

---

## 1. Leitgedanke

Die gesamte Architektur folgt einem Satz:

> **Die App ist eine lokale Datenbank mit einer Oberfläche davor. Es gibt kein Netzwerk.**

Daraus folgt fast alles Weitere: kein Backend, keine Authentifizierung, kein Ladezustand, keine Fehlerbehandlung für Netzwerkausfälle, keine Synchronisationskonflikte. Datenaustausch findet ausschließlich über **Dateien** statt, die der Nutzer selbst verschickt.

Zweiter Leitgedanke, der eine Reihe von Entscheidungen erklärt:

> **Der Code wird KI-gestützt erzeugt und in großen Blöcken abgenommen.** Deshalb hat alles Vorrang, was Fehler automatisch sichtbar macht: strikte Typisierung, testbare reine Funktionen, ein schmaler Datenzugriffspfad.

---

## 2. Stack

| Ebene | Technologie | Zweck |
|---|---|---|
| Framework | **React Native mit Expo** (aktuelle stabile SDK-Version, beim Setup festgeschrieben) | Cross-Platform-Basis, hält iOS offen |
| Sprache | **TypeScript, `strict: true`** | Sicherheitsnetz statt manuellem Code-Review |
| Navigation | **Expo Router** (dateibasiert) | Routen sind am Dateibaum ablesbar |
| UI-Bibliothek | **React Native Paper** (Material 3) | Material 3 inkl. Dark Mode und Barrierefreiheit ohne Eigenbau |
| Datenbank | **SQLite** via `expo-sqlite` | Relationale lokale Persistenz, transaktionssicher |
| Datenzugriff | **Drizzle ORM** | Typisiertes Schema, versionierte Migrationen |
| Zustand (UI) | **Zustand** | Minimaler globaler Zustand; Daten kommen aus der DB, nicht aus dem Store |
| Übersetzung | **i18next** + `expo-localization` | Texte ausgelagert, V1 nur `de` |
| Dateien & Teilen | `expo-sharing`, `expo-file-system`, `expo-document-picker`, `expo-intent-launcher` | Teilen-Menü, Export, Import |
| Haptik | `expo-haptics` | Rückmeldung beim Abhaken |
| Gesten & Animation | `react-native-gesture-handler`, `react-native-reanimated` | Wischgeste, Durchstreich-Animation |
| Unit-Tests | **Jest** + React Native Testing Library | Logik und Komponenten |
| E2E-Tests | **Maestro** | Smoke-Flow auf echtem Gerät/Emulator |
| Build | **lokal über Gradle** (`expo run:android`, `gradlew bundleRelease`) | Android-Builds unter Windows, kostenlos |
| Auslieferung | **Play Console, interner Test** | Verteilung an die Tester |

**Nicht im Stack und bewusst nicht:** kein Backend, kein GraphQL/REST-Client, kein Redux, kein Analytics-SDK, kein Crash-Reporting-SDK, keine Werbe-SDKs, **kein EAS Build und kein EAS Update** (ADR-040) – und damit kein Expo-Konto.

Begründung der Stack-Wahl und die verworfenen Alternativen (Flutter, natives Kotlin, PWA, Bare React Native): siehe [`decisions.md`](decisions.md), ADR-001.

---

## 3. Datenmodell

### 3.1 Überblick

```
categories ──┬── products ──┬── list_items ── lists ── list_category_order
             │              ├── template_items ── templates
             │              ├── purchase_history
             │              ├── pantry
             │              └── recipe_items ── recipes ── weekly_plan
             └── list_category_order
```

Grundregel: **Listeneinträge sind vom Katalog entkoppelt.** Jeder Eintrag trägt den Produktnamen als Kopie mit sich (`name`), zusätzlich optional die Produkt-Referenz (`product_id`). Wird ein Produkt gelöscht, bleibt der Listeneintrag als Text bestehen (PRD Flow 6.3). Dasselbe Prinzip gilt für Historie und Vorlagen.

### 3.2 Tabellen

#### `categories`
| Spalte | Typ | Bemerkung |
|---|---|---|
| `id` | TEXT, PK | UUID |
| `name` | TEXT, NOT NULL | z. B. „Obst & Gemüse" |
| `default_position` | INTEGER, NOT NULL | Standardreihenfolge, wenn eine Liste keine eigene definiert |
| `is_builtin` | INTEGER (0/1) | mitgeliefert oder selbst angelegt |
| `created_at` | INTEGER | Unix-Millisekunden |

#### `products`
| Spalte | Typ | Bemerkung |
|---|---|---|
| `id` | TEXT, PK | UUID |
| `name` | TEXT, NOT NULL | eindeutig pro Katalog (`UNIQUE COLLATE NOCASE`) |
| `category_id` | TEXT, FK → `categories.id` | `ON DELETE SET NULL` → fällt auf „Sonstiges" |
| `default_unit` | TEXT | eine der festen Einheiten, Standard `stueck` |
| `is_builtin` | INTEGER (0/1) | für „Katalog zurücksetzen" |
| `created_at` | INTEGER | |

> **Warum `UNIQUE COLLATE NOCASE` auf dem Namen:** Der Import geteilter Listen ordnet Produkte über den Namen zu (PRD FR-6.3). Ohne diese Einschränkung entstehen „Milch" und „milch" als zwei Produkte, und die Häufigkeitsstatistik zerfällt.

#### `lists`
| Spalte | Typ | Bemerkung |
|---|---|---|
| `id` | TEXT, PK | |
| `name` | TEXT, NOT NULL | „Rewe", „Drogerie", „Nächste Woche" |
| `position` | INTEGER | Reihenfolge in der Übersicht |
| `last_opened_at` | INTEGER | Grundlage für „aktive Liste" (FR-1.5) |
| `created_at` | INTEGER | |

#### `list_category_order`
Das Ladenlayout. Eigene Tabelle, weil die Reihenfolge **pro Liste** gilt.

| Spalte | Typ | Bemerkung |
|---|---|---|
| `list_id` | TEXT, FK → `lists.id` | `ON DELETE CASCADE` |
| `category_id` | TEXT, FK → `categories.id` | `ON DELETE CASCADE` |
| `position` | INTEGER, NOT NULL | |
| | | PK: (`list_id`, `category_id`) |

Fehlt zu einer Liste ein Eintrag für eine Kategorie, gilt `categories.default_position`.

#### `list_items`
| Spalte | Typ | Bemerkung |
|---|---|---|
| `id` | TEXT, PK | |
| `list_id` | TEXT, FK → `lists.id` | `ON DELETE CASCADE` |
| `product_id` | TEXT, FK → `products.id`, NULL erlaubt | `ON DELETE SET NULL` |
| `name` | TEXT, NOT NULL | Kopie zum Zeitpunkt des Hinzufügens |
| `category_id` | TEXT, NULL erlaubt | Kopie, damit die Sortierung stabil bleibt |
| `quantity` | REAL, NOT NULL, Standard 1 | |
| `unit` | TEXT, NOT NULL, Standard `stueck` | |
| `note` | TEXT, NULL erlaubt | |
| `is_checked` | INTEGER (0/1), Standard 0 | |
| `checked_at` | INTEGER, NULL | |
| `position` | INTEGER | Reihenfolge innerhalb der Kategorie |
| `created_at` | INTEGER | |

Index: `(list_id, is_checked)` – die mit Abstand häufigste Abfrage.

#### `purchase_history`
Grundlage der Vorschläge (FR-5.1/5.2). Wird beim „Einkauf abschließen" befüllt.

| Spalte | Typ | Bemerkung |
|---|---|---|
| `id` | TEXT, PK | |
| `product_id` | TEXT, NULL erlaubt | |
| `name` | TEXT, NOT NULL | |
| `quantity` | REAL | |
| `unit` | TEXT | |
| `list_id` | TEXT, NULL erlaubt | nur informativ |
| `purchased_at` | INTEGER, NOT NULL | |

Index: `(product_id, purchased_at)`.

#### `templates` / `template_items`
`templates`: `id`, `name`, `created_at`.
`template_items`: `id`, `template_id` (CASCADE), `product_id` (NULL erlaubt), `name`, `category_id`, `quantity`, `unit`, `note`, `position`.

#### `pantry`
Der Vorrat (FR-9, ADR-043): Ein Produkt ist zu Hause, wenn es hier eine Zeile hat – keine Mengen, keine Stufen.

| Spalte | Typ | Bemerkung |
|---|---|---|
| `product_id` | TEXT, PK, FK → `products.id` | `ON DELETE CASCADE` – der Vorrat ist eine Eigenschaft des Katalogprodukts |
| `added_at` | INTEGER, NOT NULL | Zeitpunkt, seit dem das Produkt im Vorrat steht |

#### `recipes`
Gerichte (FR-10, ADR-044) – mitgelieferter Grundstock und eigene.

| Spalte | Typ | Bemerkung |
|---|---|---|
| `id` | TEXT, PK | beim Grundstock aus dem Namen abgeleitet |
| `name` | TEXT, NOT NULL | |
| `note` | TEXT, NULL erlaubt | höchstens 200 Zeichen |
| `is_builtin` | INTEGER (0/1), Standard 0 | für „Rezepte zurücksetzen" |
| `created_at` | INTEGER, NOT NULL | |

#### `recipe_items`
Zutaten, gebaut wie `template_items`: Name als Kopie (ADR-007), Produktbezug optional.

| Spalte | Typ | Bemerkung |
|---|---|---|
| `id` | TEXT, PK | |
| `recipe_id` | TEXT, FK → `recipes.id`, NOT NULL | `ON DELETE CASCADE` |
| `product_id` | TEXT, FK → `products.id`, NULL erlaubt | `ON DELETE SET NULL` – die Zutat bleibt als Text |
| `name` | TEXT, NOT NULL | Kopie |
| `quantity` | REAL, NOT NULL, Standard 1 | |
| `unit` | TEXT, NOT NULL, Standard `stueck` | |
| `position` | INTEGER, NOT NULL, Standard 0 | Reihenfolge im Rezept |

#### `weekly_plan`
Die Gerichte dieser Woche – nur die Auswahl, keine Wochentage (ADR-044).

| Spalte | Typ | Bemerkung |
|---|---|---|
| `recipe_id` | TEXT, PK, FK → `recipes.id` | `ON DELETE CASCADE` |
| `added_at` | INTEGER, NOT NULL | |

#### `app_state`
Schlüssel-Wert-Ablage für alles, was kein eigenes Schema verdient.

| Schlüssel | Inhalt |
|---|---|
| `last_route` | zuletzt genutzter Screen (FR-1.5) |
| `last_backup_at` | Zeitstempel der letzten Sicherung (FR-6.6) |
| `hint_share_copy_seen` | Hinweis „Teilen erzeugt eine Kopie" gezeigt (FR-6.7) |
| `schema_version` | von Drizzle verwaltet |

### 3.3 Feste Einheiten

Als TypeScript-Union, nicht als Datenbanktabelle – sie ändern sich nicht zur Laufzeit:

```ts
type Unit = 'stueck' | 'g' | 'kg' | 'ml' | 'l' | 'packung' | 'bund' | 'dose';
```

Die Anzeigetexte liegen in den Übersetzungsdateien, nicht im Code.

### 3.4 Migrationen

Drizzle erzeugt versionierte SQL-Migrationen in `src/db/migrations/`. Sie laufen beim App-Start automatisch. **Regel: Migrationen werden nie nachträglich verändert**, auch nicht während der Entwicklung – sobald eine Migration einmal auf dem Testgerät gelaufen ist, wird sie nur durch eine neue ergänzt.

**Pflichtpunkt Widget:** Das Widget liest `lists` und `list_items` nativ (`modules/to-shopping-widget/.../ListReader.kt`) mit eigenen SQL-Abfragen. **Jede Schemaänderung an diesen zwei Tabellen ist dort mitzuprüfen** – es ist die einzige zweite Stelle im Projekt, die Spaltennamen kennt.

---

## 4. Fachlogik

Die folgenden Algorithmen sind der Kern der App und liegen bewusst als **reine Funktionen ohne Datenbankzugriff** vor (`src/features/*/logic.ts`). Das ist die Voraussetzung dafür, dass sie ohne laufende App getestet werden können – siehe Risiko R2 im PRD.

### 4.1 Listensortierung (FR-1.3)

Eingabe: Artikel + Kategorie-Reihenfolge der Liste.
Ausgabe: gruppierte, sortierte Abschnitte.

1. Nur nicht abgehakte Artikel, sofern „erledigte anzeigen" aus ist.
2. Gruppieren nach `category_id`; Artikel ohne Kategorie kommen in „Sonstiges".
3. Abschnitte sortieren nach `list_category_order.position`, ersatzweise `categories.default_position`.
4. Innerhalb eines Abschnitts nach `position`, bei Gleichstand nach `created_at`.
5. Leere Abschnitte werden nicht angezeigt.

### 4.2 Vorschlagsranking (FR-5.2)

Eingabe: Suchtext, Katalog, Historie, aktuelle Liste, Zeitpunkt.
Ausgabe: sortierte Vorschlagsliste.

1. **Filtern:** Produkte, deren Name den Suchtext enthält (ohne Groß-/Kleinschreibung, diakritik-unempfindlich). Leerer Suchtext = ganzer Katalog.
2. **Ausschließen:** Produkte, die bereits unabgehakt auf der Liste stehen.
3. **Bewerten:** `score = 0.6 · häufigkeit + 0.3 · aktualität + 0.1 · trefferqualität`
   - `häufigkeit`: Anzahl Käufe der letzten 180 Tage, normiert auf den Höchstwert im Katalog
   - `aktualität`: `0.5 ^ (tage_seit_letztem_kauf / 30)` – halbiert sich alle 30 Tage
   - `trefferqualität`: 1,0 bei Treffer am Wortanfang, 0,5 bei Treffer in der Wortmitte
4. **Sortieren:** absteigend nach Score, bei Gleichstand alphabetisch (stabil und damit testbar).
5. **Begrenzen:** die ersten 8 Treffer in der Sofortliste.
6. Gibt es keinen exakten Namenstreffer, wird als letzter Eintrag die Aktion „‚<Eingabe>' anlegen" angehängt.

> Die Gewichte sind bewusst als benannte Konstanten in einer Datei abgelegt, damit sie ohne Suche im Code nachjustiert werden können.

### 4.3 Einkauf abschließen (FR-3.8)

Als **eine Transaktion**, damit kein Zwischenzustand entstehen kann:

1. Alle abgehakten Artikel der Liste lesen.
2. Für jeden einen Eintrag in `purchase_history` schreiben (`purchased_at` = jetzt).
3. Die abgehakten Artikel löschen.
4. Nicht abgehakte Artikel bleiben unverändert.
5. `last_opened_at` der Liste aktualisieren.
6. Die Produkte der abgehakten Artikel in `pantry` eintragen (Abschnitt 4.6). Schon vorhandene bleiben mit ihrem alten `added_at` stehen.

### 4.4 Vorlage anwenden (FR-5.4)

Ein Vorlagen-Artikel wird übersprungen, wenn auf der Zielliste bereits ein **nicht abgehakter** Artikel mit derselben `product_id` steht – ersatzweise mit demselben Namen (ohne Groß-/Kleinschreibung). Alle übrigen werden ergänzt.

### 4.5 Import einer geteilten Liste (FR-6.2/6.3)

1. Datei einlesen, gegen das Schema prüfen (Abschnitt 5), Version prüfen.
2. Vorschau anzeigen. Erst nach Bestätigung schreiben.
3. **Immer eine neue Liste anlegen**, Name aus der Datei plus Datum.
4. Für jeden Artikel: Produkt über den Namen suchen (ohne Groß-/Kleinschreibung). Treffer → verknüpfen. Kein Treffer → Produkt im Katalog anlegen, Kategorie aus der Datei übernehmen, unbekannte Kategorie → „Sonstiges".
5. Kategorie-Reihenfolge aus der Datei übernehmen, soweit die Kategorien lokal existieren.
6. Alles in einer Transaktion. Schlägt ein Schritt fehl, ist nichts geschrieben.

### 4.6 Vorrat (FR-9)

1. **Hinein beim Abschließen:** In derselben Transaktion wie 4.3 kommen die abgehakten Artikel in den Vorrat – nur solche **mit Produktbezug**, jedes Produkt einmal. Einträge ohne `product_id` haben kein Katalogprodukt, an dem ein Haken hängen könnte (ADR-043).
2. **Checkliste:** Sie zeigt „was du üblicherweise kaufst": alle Produkte mit Käufen im 180-Tage-Fenster der Vorschläge (4.2) **vereinigt mit** allem, was gerade im Vorrat steht. Gruppiert nach Abteilungen in der Standardreihenfolge, innerhalb alphabetisch; Produkte ohne oder mit unbekannter Kategorie landen in „Sonstiges". Jeder Abschnitt trägt die Kategorie-ID als `key`.
3. **„Fehlende auf die Liste":** Alle Produkte ohne Haken gehen gesammelt an `addProductsToList`. Dort gilt dieselbe Regel wie in 4.4 – was schon **nicht abgehakt** mit derselben `product_id` auf der Liste steht, wird übersprungen. Eine eigene Schreiblogik gibt es nicht.

### 4.7 Rezepte und Wochenplan (FR-10)

1. **Zutat einordnen (`planRecipeShopping`):** Jede Zutat ist *da*, *schon auf der Liste* oder *fehlt*. **Der Vorrat schlägt die Liste:** Ist eine Zutat zu Hause und steht zugleich offen auf der Liste, gilt sie als „da" – für das Rezept zählt, ob man kochen kann. „Auf der Liste" entscheidet `planTemplateApply` (4.4), keine eigene Regel. Eine Zutat ohne `product_id` kann nie „da" sein, weil der Vorrat nur Produkte kennt (ADR-043).
2. **Übersicht (`buildRecipeOverview`):** Gezählt wird, was **nicht im Vorrat** ist – ob es schon auf der Liste steht, spielt keine Rolle, denn „Alles da" heißt „ich kann heute kochen". Sortiert nach Zahl der fehlenden Zutaten, dann alphabetisch, dann nach ID.
3. **Wochenplan (`planWeeklyShopping`):** Jedes Rezept der Woche wird für sich eingeordnet, die fehlenden Zutaten werden dann **vereinigt** – brauchen zwei Gerichte Hackfleisch, kommt es einmal auf die Liste. Zutaten ohne Produktbezug werden gesondert gemeldet statt still verschluckt. Geschrieben wird über `addProductsToList` wie in 4.6.
4. **Grundstock genau einmal:** Gesät wird über den Merker `recipes_seeded` in `app_state`, nicht über „Tabelle ist leer" – wer alle Gerichte löscht, soll sie nicht beim nächsten Start wiederfinden (ADR-044). Eine Wiederherstellung aus einer Sicherung ohne `recipes` setzt den Merker zurück (5.2).
5. **Zurücksetzen (`planRecipeReset`, ADR-031):** Mitgelieferte Gerichte kehren in den Auslieferungszustand zurück, gelöschte kommen wieder, **eigene bleiben unangetastet** – auch eines, das zufällig dieselbe ID wie ein mitgeliefertes trägt.

### 4.8 Widget (FR-11)

Entscheidung und Abwägung in ADR-045; der Code liegt in `modules/to-shopping-widget/`.

1. **Lesen (`ListReader.kt`):** Das Widget öffnet die Datei der App unter `filesDir/SQLite/to-shopping.db` – derselbe Ort, den expo-sqlite verwendet – **nur lesend** über Androids eigene `SQLiteDatabase`. Es nimmt die Liste mit dem jüngsten `last_opened_at` und deren offene Artikel, höchstens fünf, plus die Gesamtzahl für „+ n weitere“. Es setzt einen **eigenen, leeren Fehler-Handler**: Androids Standard **löscht** die Datenbankdatei, sobald SQLite eine Beschädigung meldet – und das kann hier ohne echten Schaden passieren, wenn das Widget eine halb geschriebene Seite erwischt. Jeder Lesefehler endet in „keine neuen Daten“, die alte Anzeige bleibt stehen.
2. **Aktualisieren:** Android löst das Widget periodisch aus, frühestens alle 30 Minuten. Dazu startet `app/_layout.tsx` nach den Migrationen `startWidgetRefresh` (`src/lib/widgetRefresh.ts`): ein Datenbank-Listener auf `lists` und `list_items`, um 500 ms entprellt. Ein Listener statt eines Aufrufs in jeder Schreibfunktion, weil er **jeden** Schreibvorgang sieht, auch künftige und seltene wie Import oder Wiederherstellung. Die Entprellung macht aus „Einkauf abschließen“ mit zwanzig Artikeln eine Neuzeichnung statt zwanzig. Änderungen an **anderen Tabellen** lösen nichts aus, schieben ein geplantes Update aber auf: SQLite meldet Zeilen sofort, nicht erst beim Commit – liefe das Update mitten in einer Wiederherstellung los, läse das Widget den Stand vor dem Commit und bliebe bis zum nächsten 30-Minuten-Takt dabei.
3. **Tipp:** Öffnet die Liste über den App-Link `toshopping://liste?listId=…`.
4. **Bekannte Abweichung:** Das Widget sortiert nur nach `position`, die App zusätzlich nach Abteilung (4.1). Die Reihenfolge im Widget kann daher von der Liste in der App abweichen.

---

## 5. Dateiformate

### 5.1 Geteilte Liste (`.tsl`, `application/json`)

```json
{
  "format": "to-shopping.list",
  "version": 1,
  "exportedAt": "2026-08-18T18:22:00.000Z",
  "list": {
    "name": "Rewe",
    "categoryOrder": ["Obst & Gemüse", "Kühlregal", "Getränke"],
    "items": [
      { "name": "Milch", "category": "Kühlregal", "quantity": 2, "unit": "l", "note": null },
      { "name": "Bananen", "category": "Obst & Gemüse", "quantity": 1, "unit": "bund", "note": "reif" }
    ]
  }
}
```

Kategorien werden **über den Namen** übertragen, nicht über IDs – die IDs des Empfängers sind andere.

Zusätzlich zur Datei wird im Nachrichtentext eine lesbare Fassung mitgeschickt (PRD Flow 3.3):

```
Einkaufsliste „Rewe" (2 Artikel)
• 2 l Milch
• 1 Bund Bananen (reif)
```

### 5.2 Vollsicherung (`.tsb`)

```json
{
  "format": "to-shopping.backup",
  "version": 1,
  "exportedAt": "...",
  "schemaVersion": 3,
  "data": {
    "categories": [], "products": [], "lists": [],
    "listCategoryOrder": [], "listItems": [],
    "templates": [], "templateItems": [], "purchaseHistory": [],
    "pantry": [], "recipes": [], "recipeItems": [], "weeklyPlan": []
  }
}
```

Die acht Tabellen aus V1 sind **Pflichttabellen**, alle später hinzugekommenen (`pantry`, `recipes`, `recipeItems`, `weeklyPlan`) sind **optional**: Fehlt eine optionale Tabelle in der Datei, gilt sie als leer, sodass Sicherungen aus V1 lesbar bleiben. Weil das eine verträgliche Änderung ist, bleibt `version` bei 1, und die Pflichtliste wächst nie mehr (ADR-046).

`parseBackup` meldet zusätzlich, welche optionalen Tabellen fehlten (`missingOptional`). Fehlte `recipes`, setzt die Wiederherstellung nach ihrer Transaktion den Merker `recipes_seeded` zurück: Die Rezepttabelle ist nach dem Ersetzen leer, und ohne diesen Schritt käme der Grundstock nie zurück. Beim nächsten Start sät `seedRecipesOnce`. Eine vorhandene, aber leere `recipes`-Tabelle lässt den Merker stehen. `app_state` selbst gehört nie in die Sicherung.

Die Sicherung enthält im Gegensatz zur geteilten Liste **echte IDs**, weil sie den vollständigen Zustand wiederherstellt. Beim Wiederherstellen wird der bestehende Datenbestand **ersetzt**, nicht ergänzt – mit ausdrücklicher Warnung.

**Regel für beide Formate:** `version` wird bei jeder inkompatiblen Änderung erhöht. Der Import lehnt unbekannte höhere Versionen mit einer verständlichen Meldung ab („Diese Datei stammt aus einer neueren Version der App").

---

## 6. Offline-Strategie

Es gibt keine Offline-Strategie im üblichen Sinn, weil es keinen Online-Modus gibt.

| Aspekt | Umsetzung |
|---|---|
| Datenhaltung | vollständig lokal in SQLite |
| Schreibvorgänge | sofort, ohne Warteschlange, ohne Bestätigungs-UI |
| Netzwerkzugriff der App | **keiner**, ohne Ausnahme (ADR-040) |
| Berechtigungen | keine Standort-, Kamera- oder Benachrichtigungsberechtigung in V1 |
| Konflikte | können nicht entstehen (ein Gerät, eine Datenbank) |

Die App baut von sich aus **keine einzige** Verbindung auf. `INTERNET` steht im Manifest, weil eine Programmbibliothek es dort einträgt – benutzt wird es nicht. Damit ist das Data-Safety-Formular durchgehend mit „nein" zu beantworten; siehe [`compliance.md`](compliance.md).

---

## 7. Ordnerstruktur

```
To-Shopping/
├── app/                          # Expo Router: eine Datei = eine Route
│   ├── _layout.tsx               # Theme, i18n, DB-Initialisierung, Migrationen
│   ├── index.tsx                 # Einstieg: leitet auf die zuletzt genutzte Route
│   ├── listen.tsx                # Listenübersicht
│   ├── liste.tsx                 # Eine Liste (Haupt-Screen)      ?listId=
│   ├── katalog.tsx               # Katalog mit Mehrfachauswahl    ?listId=
│   ├── ladenlayout.tsx           # Kategorie-Reihenfolge          ?listId=
│   ├── produkte.tsx              # Katalogpflege
│   ├── vorlagen.tsx
│   ├── sicherung.tsx             # Vollsicherung, Wiederherstellung
│   ├── diagnose.tsx              # Fehlerspeicher, Bericht senden
│   └── import.tsx                # Ziel des Teilen-Intents, Vorschau
│
│   Routen sind flach und tragen die Listen-ID als Parameter statt im
│   Pfad – Begründung in ADR-030.
│
├── src/
│   ├── db/
│   │   ├── schema.ts             # Drizzle-Schema (Abschnitt 3)
│   │   ├── client.ts             # DB-Verbindung, Migrationslauf
│   │   ├── migrations/           # generiert, unveränderlich
│   │   └── seed/
│   │       ├── categories.json   # 10–12 Kategorien
│   │       └── products.json     # 150–200 Produkte
│   ├── features/                 # Fachlichkeit, nach Domäne geschnitten
│   │   ├── lists/                # repository.ts · logic.ts · components/
│   │   ├── items/
│   │   ├── catalog/
│   │   ├── suggestions/          # logic.ts = Abschnitt 4.2, voll getestet
│   │   ├── templates/
│   │   ├── history/
│   │   ├── diagnostics/          # Fehlerspeicher, Error Boundary
│   │   └── transfer/             # Export, Import, Sicherung, Formate
│   ├── components/               # domänenfreie UI-Bausteine
│   ├── theme/                    # Material-3-Farbschema (Grün), Typografie
│   ├── i18n/
│   │   ├── index.ts
│   │   └── locales/de.json       # alle sichtbaren Texte
│   ├── lib/                      # Hilfsfunktionen: uuid, datum, text-normalisierung
│   └── store/                    # Zustand: nur UI-Zustand, keine Daten
│
├── modules/to-shopping-widget/   # Homescreen-Widget: lokales Expo-Modul in Kotlin (ADR-045)
├── e2e/                          # Maestro-Flows (YAML)
├── docs/                         # diese Dokumentation
├── assets/                       # Icon, Splash
└── ...                           # Konfiguration im Wurzelverzeichnis
```

### Schichtenregel

```
Screen (app/)  →  Repository (features/*/repository.ts)  →  Drizzle  →  SQLite
                        ↑
                  Logic (features/*/logic.ts) – rein, ohne DB, voll getestet
```

Verbindliche Regeln:

1. **Screens greifen nie direkt auf die Datenbank zu.** Ausschließlich über Repository-Funktionen.
2. **Fachlogik kennt die Datenbank nicht.** Sortierung, Ranking, Formatprüfung sind reine Funktionen mit Ein- und Ausgabe.
3. **Zustand hält keinen Datenbestand.** Der Store enthält nur UI-Zustand (aktive Liste, „erledigte anzeigen", Suchtext). Daten werden aus der DB gelesen.
4. **Kein sichtbarer Text im Code.** Alle Texte kommen aus `i18n/locales/de.json`.

---

## 8. Zustandsverwaltung

| Art des Zustands | Wo | Beispiel |
|---|---|---|
| Persistent | SQLite | Listen, Artikel, Katalog, Historie |
| App-übergreifend, persistent | `app_state`-Tabelle | letzte Route, letzte Sicherung |
| UI, flüchtig | Zustand-Store | „erledigte anzeigen", Suchtext, offene Detailzeile |
| Lokal | React-Komponente | Eingabefeld-Inhalt, Animationszustand |

Datenbankabfragen laufen über `expo-sqlite`s Live-Query-Mechanismus, damit die Oberfläche nach Schreibvorgängen automatisch aktualisiert – ohne manuelles Nachladen.

---

## 9. Fehlerbehandlung und Diagnose (FR-8.1/8.2)

- Eine **Error Boundary** um die App fängt Abstürze der Oberfläche ab und zeigt einen verständlichen Bildschirm statt eines weißen Fensters.
- Der technische Bericht (Zeitstempel, App-Version, Android-Version, Gerätemodell, Fehlermeldung, Aufrufkette) wird **lokal** in eine Datei geschrieben, maximal die letzten 20 Einträge.
- Einstellungen → Diagnose zeigt diese Einträge und bietet **„An den Entwickler senden"** an – das öffnet das Teilen-Menü mit dem Bericht als Text. Der Nutzer entscheidet, ob und wie er ihn verschickt.
- **Kein Drittanbieter, keine automatische Übertragung.**

---

## 10. Barrierefreiheit (FR-7.3–7.6)

Verbindlich für jede Komponente:

- Trefferflächen mindestens 48 × 48 dp.
- Schriftgrößen skalieren mit der Systemeinstellung; keine festen Höhen bei Textcontainern.
- Kontraste nach WCAG AA; die Material-3-Farbrollen werden nicht mit eigenen Farbwerten überschrieben.
- Jede Wischgeste hat eine gleichwertige Antipp-Alternative.
- Jedes Bedienelement hat ein `accessibilityLabel` und, wo nötig, `accessibilityHint`.
- Abgehakte Artikel sind nicht nur durch Farbe erkennbar (Durchstreichung + Zustandsansage).

---

## 11. Qualitätssicherung

| Prüfung | Werkzeug | Umfang |
|---|---|---|
| Typecheck | `tsc --noEmit`, strict | vollständig |
| Lint | ESLint + Prettier | vollständig |
| Unit-Tests | Jest | **verpflichtend** für alle `logic.ts`: Sortierung, Ranking, Vorlagen-Abgleich, Formate, Mengenformatierung |
| Komponententests | React Native Testing Library | Kernkomponenten: Listenzeile, Eingabefeld mit Vorschlägen |
| E2E-Smoke | Maestro | Liste öffnen → Artikel hinzufügen → abhaken → Einkauf abschließen |
| Manuell | Samsung Galaxy S24 | jede Abnahme, hell und dunkel |

Die Repository-Schicht wird **nicht** durchgängig getestet – sie ist dünn und würde nur SQLite testen. Getestet wird, was rechnet und entscheidet.

---

## 12. Build und Auslieferung

| Zweck | Weg |
|---|---|
| Tägliche Entwicklung | `npx expo start` mit Development Build auf dem S24 |
| Android-Build lokal | `npm run android` (Android Studio + SDK auf Windows), kostenlos |
| Build für E2E und Abnahme | `npm run android:release` – APK mit eingebettetem JavaScript (ADR-025) |
| **Build für den Store** | `npm run bundle:android` – App Bundle, lokal über Gradle, alle drei Architekturen (ADR-041) |
| Verteilung an Tester | Play Console, **interner Test**, Einladung per E-Mail (ADR-014) |
| Schnellkorrekturen | **gibt es nicht** – jede Korrektur braucht einen neuen Build und Upload (ADR-040) |

**Alles läuft lokal.** Kein EAS Build, kein EAS Update, kein `eas.json`, kein Expo-Konto. Der Rechner baut, die Play Console verteilt.

**Signierung:** Der Build liest den Upload-Schlüssel aus `%USERPROFILE%\.gradle\gradle.properties`, nie aus dem Repository. Fehlen die Eigenschaften, signiert er mit dem Debug-Schlüssel weiter (ADR-042). Den Schlüssel für die Geräte hält Google – Play App Signing ist beim App Bundle Pflicht.

Versionierung: `app.json` führt `version` (sichtbar) und `versionCode` (Play Console). Der `versionCode` wird bei jedem Store-Upload erhöht.

---

## 13. Was iOS später bedeuten würde

Damit die Tür nachweislich offen bleibt, hier die Liste dessen, was bei einer späteren iOS-Version zu tun wäre:

1. Apple-Developer-Programm (99 €/Jahr) und ein Testgerät.
2. EAS Build für iOS (Cloud, kostenpflichtig oder Wartezeit im kostenlosen Kontingent).
3. Teilen-Intent ersetzen: Android-Intents ↔ iOS Share Extension. **Das ist der einzige echte Bruch** und der Grund, warum die Transfer-Schicht (`features/transfer/`) plattformspezifisch gekapselt ist.
4. „Sign in with Apple" ist nicht nötig, solange es keine Konten gibt.
5. Datenschutzerklärung und App-Privacy-Angaben für den App Store.

Keine dieser Aufgaben erfordert eine Änderung am Datenmodell oder an der Fachlogik.

---

## Verweise

- Produktdefinition: [`PRD.md`](PRD.md)
- Warum dieser Stack, warum nicht Flutter/Kotlin/PWA: [`decisions.md`](decisions.md)
- Datenschutz und Store-Pflichten: [`compliance.md`](compliance.md)
- Umsetzungsreihenfolge: [`roadmap.md`](roadmap.md)
