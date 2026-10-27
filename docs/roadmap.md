# Roadmap V1 – To-Shopping

**Version:** 1.0
**Stand:** 2026-08-18
**Bezug:** Anforderungs-IDs (FR-x.y) aus [`PRD.md`](PRD.md)

---

## Lesehilfe

- **Ein Task ist 1–3 Stunden groß** und passt damit in einen Abend.
- **Jeder Task nennt seine Anforderung** (FR-Nummer) und ein überprüfbares „Fertig, wenn".
- **Jeder Task endet grün:** Typecheck, Lint, Tests. Die vollständige Definition of Done steht in `CLAUDE.md`.
- **Abnahme erfolgt pro Meilenstein**, nicht pro Task – so vereinbart. Zu jedem Meilenstein gehört eine schriftliche Erklärung: was wurde gebaut, warum so, welche Alternative gab es.

### Zeitplanung

| | |
|---|---|
| Gesamtaufwand V1 | **rund 90 Stunden** |
| Verfügbar | 5 Stunden pro Woche |
| Realistische Laufzeit | **18 Wochen, also 4–5 Monate** |
| **Ab Meilenstein 3 (ca. Woche 6)** | **ist die App im Alltag benutzbar** |

> **Korrektur meiner Schätzung aus Phase 2:** Dort hatte ich 3–4 Monate genannt. Die Aufschlüsselung in Tasks ergibt rund 90 Stunden und damit 4–5 Monate. Die 90 Stunden sind die ehrlichere Zahl.

### Die wichtigste Eigenschaft dieses Plans

Ab **M3** kannst du die App bei jedem Einkauf benutzen – unfertig, aber nützlich. Ab dann treibt dich der eigene Gebrauch und nicht die Disziplin. Das ist die Gegenmaßnahme zu Risiko R1 („Projekt schläft ein").

Die beiden zuletzt geplanten Meilensteine **M10 (Vorschläge) und M11 (Vorlagen)** sind bewusst ans Ende gesetzt (ADR-021): Geht dir die Luft aus, ist die App auch ohne sie vollständig und auslieferbar.

---

## Übersicht

| # | Meilenstein | Stunden | Ergebnis |
|---|---|---|---|
| M0 | Projekt-Setup | 6 | Lauffähiges Grundgerüst, alle Prüfungen grün |
| M1 | Datenfundament | 8 | Schema, Migrationen, 150–200 Produkte, Theme, Texte |
| M2 | Liste und Artikel | 9 | Artikel hinzufügen und entfernen |
| M3 | **Abhaken und Einkauf abschließen** | 8 | **Ab hier täglich nutzbar** |
| M4 | Mengen und Katalogauswahl | 7 | Mengen, Einheiten, Notizen, Mehrfachauswahl |
| M5 | Kategorien und Ladenlayout | 7 | Gruppierte Liste in Ladenreihenfolge |
| M6 | Mehrere Listen | 6 | Listenverwaltung, Start auf letzter Route |
| M7 | Katalogpflege | 6 | Produkte anlegen, ändern, löschen, zurücksetzen |
| M8 | Teilen und Import | 9 | Liste verschicken und empfangen |
| M9 | Sicherung und Diagnose | 7 | Export, Wiederherstellung, Fehlerspeicher |
| M10 | Vorschläge aus der Historie | 5 | Ranking nach Häufigkeit und Aktualität |
| M11 | Vorlagen | 5 | Vorlage speichern und anwenden |
| M12 | Feinschliff und Auslieferung | 8 | Barrierefreiheit, Dark Mode, interner Test |
| **V2** | | | *entschieden nach sieben Wochen Alltag, siehe unten* |
| M13 | Vorrat | 8 | Was zu Hause ist, ohne Buchführung |
| M14 | Rezepte und Wochenplan | 12 | Kochen aus dem, was da ist |
| M15 | Widget | 8 | Die Liste ohne App-Start |
| M16 | Rezepte vertiefen | 14 | Schritte und Gewürze, Grundvorrat zählt nicht als fehlend |

---

## M0 – Projekt-Setup

**Ziel:** Ein lauffähiges Grundgerüst, in dem alle Qualitätsprüfungen tatsächlich laufen.
**Entspricht Phase 4 des Discovery-Prozesses.**

| ID | Aufgabe | h | Fertig, wenn … |
|---|---|---|---|
| T-0.1 | Expo-Projekt mit TypeScript anlegen, SDK-Version festschreiben, Git-Repo mit `.gitignore`, erster Commit | 1 | `npx expo start` startet, Repo hat einen Commit |
| T-0.2 | TypeScript strict, ESLint, Prettier einrichten | 1 | `npm run typecheck` und `npm run lint` laufen grün durch |
| T-0.3 | Jest + React Native Testing Library, ein Beispieltest | 1 | `npm test` läuft grün |
| T-0.4 | Maestro einrichten, Smoke-Flow „App startet und zeigt den Startbildschirm" | 1 | `npm run e2e` läuft grün auf dem S24 |
| T-0.5 | Ordnerstruktur nach `architecture.md` anlegen, `.env`-Handling und `.env.example` | 1 | Struktur steht, keine Secrets im Repo |
| T-0.6 | npm-Scripts (`start`, `typecheck`, `lint`, `test`, `e2e`, `build:android`), `README.md` für einen fremden Entwickler | 1 | Ein Fremder kann das Projekt allein nach README starten |

**Abnahme:** Alle vier Prüfungen laufen mit echter Ausgabe grün. Ein Screen ist auf dem S24 sichtbar.

---

## M1 – Datenfundament

**Ziel:** Die Datenbank steht, der Katalog ist gefüllt, das Aussehen und die Texte sind zentral geregelt.

| ID | Aufgabe | FR | h | Fertig, wenn … |
|---|---|---|---|---|
| T-1.1 | Drizzle-Schema für alle 9 Tabellen aus `architecture.md` Abschnitt 3 | – | 2 | Schema kompiliert, erste Migration ist erzeugt |
| T-1.2 | DB-Client, automatischer Migrationslauf beim App-Start | – | 1 | App startet, Datenbankdatei entsteht auf dem Gerät |
| T-1.3 | Kategorien-Seed: 10–12 Kategorien mit Standardreihenfolge | FR-4.1 | 1 | Kategorien sind nach Neuinstallation vorhanden |
| T-1.4 | **Produkt-Seed: 150–200 Produkte**, keine Markennamen (compliance.md Abschnitt 6) | FR-4.1 | 2 | Alle Produkte haben eine Kategorie und eine Standardeinheit; Test prüft Mindestanzahl und Eindeutigkeit der Namen |
| T-1.5 | Material-3-Theme in Grün, hell und dunkel, Paper-Provider | FR-7.1, FR-7.2 | 1 | Beispielscreen sieht in beiden Modi korrekt aus |
| T-1.6 | i18next einrichten, `de.json`, Regel „kein sichtbarer Text im Code" | FR-7.7 | 1 | Beispielscreen bezieht alle Texte aus der Übersetzungsdatei |

**Abnahme:** Nach Neuinstallation enthält die Datenbank Kategorien und Produkte. Ein Testbildschirm zeigt sie in Grün, hell und dunkel.

---

## M2 – Liste und Artikel

**Ziel:** Artikel auf eine Liste bekommen – der Kern von PRD-Flow 1.

| ID | Aufgabe | FR | h | Fertig, wenn … |
|---|---|---|---|---|
| T-2.1 | Repository für Listen und Artikel (anlegen, lesen, löschen), Standardliste beim ersten Start | FR-1.1 | 2 | Unit-Tests für die Repository-Funktionen laufen |
| T-2.2 | Listen-Screen: flache Artikelliste, leerer Zustand mit Hinweis | FR-1.4 | 2 | Artikel aus der Datenbank erscheinen auf dem Gerät |
| T-2.3 | Eingabefeld am unteren Rand mit Sofort-Vorschlägen (vorerst alphabetisch, ohne Historie) | FR-2.1 | 2 | Tippen von „mil" zeigt „Milch"; Auswahl setzt den Artikel auf die Liste |
| T-2.4 | Neues Produkt aus der Eingabe anlegen, mit Kategorieabfrage, Voreinstellung „Sonstiges" | FR-2.2 | 2 | Unbekannter Text erzeugt Produkt und Listeneintrag |
| T-2.5 | Artikel von der Liste entfernen | FR-2.7 | 1 | Entfernen wirkt sofort und bleibt nach Neustart bestehen |

**Abnahme:** Eine Liste mit 15 Artikeln lässt sich zusammenstellen, ohne ein Wort vollständig zu tippen. Nach Neustart ist alles noch da.

---

## M3 – Abhaken und Einkauf abschließen ⭐

**Ziel:** PRD-Flow 2. **Ab hier ist die App im Alltag benutzbar.**

| ID | Aufgabe | FR | h | Fertig, wenn … |
|---|---|---|---|---|
| T-3.1 | Kästchen zum Abhaken (die barrierefreie Grundvariante) | FR-3.4 | 1 | Zustand wird gespeichert und überlebt den Neustart |
| T-3.2 | Wischgeste mit Durchstreich-Animation und haptischem Feedback | FR-3.1, FR-3.2 | 2 | Wischen streicht sichtbar durch, Gerät vibriert kurz |
| T-3.3 | Abgehakte ausblenden, Schalter „x erledigte anzeigen" | FR-3.5, FR-3.6 | 1 | Umschalten zeigt und verbirgt die erledigten Artikel |
| T-3.4 | „Rückgängig"-Hinweis nach dem Abhaken | FR-3.3 | 1 | Rückgängig stellt den Artikel wieder her |
| T-3.5 | Fortschrittsanzeige „x von y offen" | FR-3.7 | 1 | Zahlen stimmen in jeder Situation |
| T-3.6 | **„Einkauf abschließen"** als Transaktion, schreibt die Historie | FR-3.8, FR-5.1 | 2 | Unit-Test: abgehakte Artikel landen vollständig in der Historie, nicht abgehakte bleiben liegen, bei Fehler wird nichts geschrieben |

**Abnahme:** Ein vollständiger Einkauf ist durchführbar: Liste zusammenstellen, im Laden abhaken, abschließen. Der E2E-Smoke-Test fährt genau diesen Weg ab.

> **Ab hier: App bei jedem Einkauf selbst benutzen.** Jede weitere Woche liefert Erkenntnisse aus echtem Gebrauch.

---

## M4 – Mengen und Katalogauswahl

| ID | Aufgabe | FR | h | Fertig, wenn … |
|---|---|---|---|---|
| T-4.1 | Detailzeile: Menge, Einheit (feste Auswahl), Notiz | FR-2.4, FR-2.5 | 2 | Werte werden gespeichert und angezeigt |
| T-4.2 | Mengenanzeige nur bei ≠ 1, Formatierung („2 l", „500 g", „1 Bund") | FR-2.6 | 1 | Unit-Test deckt alle acht Einheiten und Grenzfälle ab |
| T-4.3 | Katalog-Screen mit Kategoriegruppen und Mehrfachauswahl | FR-2.3, FR-4.3 | 2 | Mehrere Produkte über Kategorien hinweg auswählbar |
| T-4.4 | „Übernehmen" setzt die Auswahl auf die Liste, ohne Duplikate | FR-2.3 | 1 | Bereits vorhandene Artikel werden nicht doppelt eingefügt |
| T-4.5 | Suche im Katalog-Screen | FR-4.3 | 1 | Suche filtert über alle Kategorien |

**Abnahme:** Der zweite Weg zum Hinzufügen (PRD Flow 1.7) funktioniert und ist zugleich die Gedächtnisstütze.

---

## M5 – Kategorien und Ladenlayout

| ID | Aufgabe | FR | h | Fertig, wenn … |
|---|---|---|---|---|
| T-5.1 | Sortierlogik als reine Funktion (`architecture.md` 4.1) | FR-1.3 | 2 | Unit-Tests: Reihenfolge, fehlende Kategorien, leere Abschnitte, Gleichstände |
| T-5.2 | Listen-Screen auf Abschnitte nach Kategorien umstellen | FR-1.3 | 2 | Artikel erscheinen gruppiert, leere Abschnitte fehlen |
| T-5.3 | Ladenlayout-Screen: Kategorien per Drag-and-drop ordnen | FR-1.3 | 2 | Reihenfolge wird pro Liste gespeichert und wirkt sofort |
| T-5.4 | Rückfall auf Standardreihenfolge, wenn für eine Liste nichts gesetzt ist | FR-1.3 | 1 | Neue Liste zeigt sinnvolle Standardreihenfolge |

**Abnahme:** Zwei Listen mit unterschiedlicher Kategorie-Reihenfolge zeigen dieselben Artikel in unterschiedlicher Ordnung.

---

## M6 – Mehrere Listen

| ID | Aufgabe | FR | h | Fertig, wenn … |
|---|---|---|---|---|
| T-6.1 | Listenübersicht mit Anzahl offener Artikel | FR-1.4 | 2 | Zahlen stimmen, Sortierung ist stabil |
| T-6.2 | Liste anlegen, umbenennen, löschen (mit Rückfrage) | FR-1.2 | 2 | Löschen entfernt auch alle Artikel (Fremdschlüssel-Kaskade) |
| T-6.3 | Liste duplizieren, inklusive Ladenlayout | FR-1.2 | 1 | Kopie ist unabhängig von der Vorlage |
| T-6.4 | Start auf der zuletzt genutzten Route | FR-1.5 | 1 | Nach Neustart erscheint der zuletzt gesehene Screen |

**Abnahme:** Mehrere Listen für verschiedene Läden und Zeitpunkte lassen sich parallel führen.

---

## M7 – Katalogpflege

| ID | Aufgabe | FR | h | Fertig, wenn … |
|---|---|---|---|---|
| T-7.1 | Produktverwaltung: Liste nach Kategorien, durchsuchbar | FR-4.3 | 2 | Alle Produkte sind erreichbar |
| T-7.2 | Produkt anlegen, umbenennen, Kategorie ändern – auch bei mitgelieferten | FR-4.2 | 2 | Namensdopplungen werden verhindert (ohne Groß-/Kleinschreibung) |
| T-7.3 | Produkt löschen; bestehende Listeneinträge bleiben als Text erhalten | FR-4.2 | 1 | Unit-Test belegt das Verhalten (ADR-007) |
| T-7.4 | „Katalog zurücksetzen" mit Bestätigung; eigene Produkte bleiben erhalten | FR-4.4 | 1 | Nach dem Zurücksetzen sind gelöschte mitgelieferte Produkte zurück |

**Abnahme:** Der Katalog ist vollständig beherrschbar, ohne dass man sich etwas kaputtmachen kann.

---

## M8 – Teilen und Import

**Ziel:** PRD-Flows 3 und 4 – dein ursprüngliches Kernanliegen.

| ID | Aufgabe | FR | h | Fertig, wenn … |
|---|---|---|---|---|
| T-8.1 | Export-Format `.tsl` erzeugen und prüfen (`architecture.md` 5.1) | FR-6.1 | 2 | Unit-Tests: Erzeugen, Einlesen, kaputte Datei, unbekannte Version |
| T-8.2 | Lesbare Textfassung der Liste erzeugen | FR-6.1 | 1 | Unit-Test prüft die Formatierung mit Mengen und Notizen |
| T-8.3 | „Liste teilen" über das Android-Teilen-Menü (Datei + Text) | FR-6.1 | 2 | Versand über WhatsApp funktioniert auf dem S24 |
| T-8.4 | Empfang: Intent-Filter für `.tsl`, Import-Screen mit Vorschau | FR-6.2 | 2 | Tippen auf die Datei in WhatsApp öffnet To-Shopping |
| T-8.5 | Importlogik: neue Liste, Produkte über den Namen zuordnen oder anlegen, alles in einer Transaktion | FR-6.2, FR-6.3 | 2 | Unit-Tests: bekannte Produkte, unbekannte Produkte, unbekannte Kategorien, Groß-/Kleinschreibung |

**Abnahme:** Eine Liste wird per WhatsApp an ein zweites Gerät geschickt und dort korrekt importiert. Der einmalige Hinweis „Teilen erzeugt eine Kopie" (FR-6.7) erscheint dabei.

---

## M9 – Sicherung und Diagnose

| ID | Aufgabe | FR | h | Fertig, wenn … |
|---|---|---|---|---|
| T-9.1 | Vollsicherung `.tsb` erzeugen (`architecture.md` 5.2) | FR-6.4 | 2 | Unit-Test: alle Tabellen vollständig enthalten |
| T-9.2 | Wiederherstellung mit Warnung, ersetzt den Datenbestand in einer Transaktion | FR-6.5 | 2 | Wiederherstellung auf einem leeren Gerät ergibt denselben Zustand |
| T-9.3 | Hinweisstreifen nach 14 Tagen ohne Sicherung | FR-6.6 | 1 | Erscheint zum richtigen Zeitpunkt, lässt sich wegklicken |
| T-9.4 | Error Boundary und lokaler Fehlerspeicher (letzte 20 Einträge) | FR-8.1 | 1 | Ein absichtlich erzeugter Fehler landet im Speicher |
| T-9.5 | Diagnose-Screen mit „An den Entwickler senden" | FR-8.2 | 1 | Bericht lässt sich über das Teilen-Menü verschicken |

**Abnahme:** Ein vollständiger Datenbestand überlebt Deinstallation und Neuinstallation über die Sicherungsdatei. Das ist die Gegenmaßnahme zu Risiko R3.

---

## M10 – Vorschläge aus der Historie

| ID | Aufgabe | FR | h | Fertig, wenn … |
|---|---|---|---|---|
| T-10.1 | Ranking als reine Funktion (`architecture.md` 4.2), Gewichte als benannte Konstanten | FR-5.2 | 2 | Unit-Tests: Häufigkeit, Zerfall über die Zeit, Treffer am Wortanfang, stabile Reihenfolge bei Gleichstand |
| T-10.2 | Historie-Abfragen (Kaufanzahl 180 Tage, letzter Kauf je Produkt) | FR-5.1 | 1 | Abfragen sind indexgestützt und schnell |
| T-10.3 | Eingabefeld auf das Ranking umstellen, bereits vorhandene Artikel ausschließen | FR-5.2 | 1 | Häufig gekaufte Produkte stehen oben |
| T-10.4 | Vorschläge auch bei leerer Eingabe (die üblichen Verdächtigen) | FR-5.2 | 1 | Bei leerem Feld erscheinen die häufigsten Produkte |

**Abnahme:** Nach mehreren echten Einkäufen stehen die typischen Artikel oben. Die Wirkung ist erst nach Wochen der Nutzung beurteilbar – deshalb liegt dieser Meilenstein spät.

---

## M11 – Vorlagen

| ID | Aufgabe | FR | h | Fertig, wenn … |
|---|---|---|---|---|
| T-11.1 | Vorlage aus der aktuellen Liste speichern | FR-5.3 | 1 | Vorlage enthält Artikel, Mengen und Notizen |
| T-11.2 | Vorlagenübersicht, umbenennen, löschen | FR-5.5 | 1 | Verwaltung vollständig |
| T-11.3 | Abgleichslogik als reine Funktion (`architecture.md` 4.4) | FR-5.4 | 1 | Unit-Tests: gleiche Produkt-ID, gleicher Name, abgehakter Artikel |
| T-11.4 | „Vorlage anwenden" auf eine Liste | FR-5.4 | 2 | Keine Duplikate, Rückmeldung „7 Artikel hinzugefügt" |

**Abnahme:** „Wocheneinkauf" liegt mit einem Tippen auf der Liste.

---

## M12 – Feinschliff und Auslieferung

| ID | Aufgabe | FR | h | Fertig, wenn … |
|---|---|---|---|---|
| T-12.1 | Barrierefreiheits-Durchgang über alle Screens | FR-7.3–7.6 | 2 | Screenreader-Beschriftungen vollständig, 48 dp eingehalten, große Systemschrift bricht nichts |
| T-12.2 | Dark-Mode-Durchgang über alle Screens | FR-7.2 | 1 | Kein Kontrastfehler, keine unlesbare Stelle |
| T-12.3 | App-Icon und Startbildschirm | – | 1 | Icon in allen Größen vorhanden |
| T-12.4 | E2E-Flow auf den vollständigen Hauptweg erweitern | – | 1 | Maestro fährt hinzufügen → abhaken → abschließen ab |
| T-12.5 | Compliance-Aufgaben C-1 bis C-7 abarbeiten | – | 2 | Datenschutzerklärung ist online, Formulare ausgefüllt |
| T-12.6 | Erstes Bundle in den internen Test, Tester einladen | FR-8.3 | 1 | Ein Tester installiert erfolgreich über den Play Store |

> **OTA-Updates (FR-8.4) sind vertagt** – siehe ADR-040. Sie wären die einzige
> Stelle in V1, an der die App von sich aus mit einem Server spricht; bei zehn
> Testern verteilt der interne Play-Store-Test ohnehin schnell genug. Wiedervorlage
> nach den vier Wochen echter Nutzung.

**Stand T-12.6 am 8. September 2026** – der Bauweg steht und ist geprüft:

| | |
|---|---|
| `npm run bundle:android` | 22 min, erfolgreich |
| Architekturen im Bundle | `armeabi-v7a`, `arm64-v8a`, `x86_64` (ADR-041) |
| C-6, Berechtigungen | genau drei, wie erwartet |
| targetSdk / minSdk | 36 / 24 |
| Signatur | **noch Debug** – wartet auf den Upload-Schlüssel |

Was noch fehlt, hängt nicht am Code: der Upload-Schlüssel (README, „Auslieferung
in den Play Store"), die Screenshots vom Gerät, und C-1 bis C-7. Der Rollout an
die Tester wartet auf die Anschrift für die Datenschutzerklärung – Aufgabe C-11,
die durch die Veröffentlichung auf GitHub Pages früher schlagend wird als in
`compliance.md` angenommen.

Nebenbefund beim Zusammenstellen des Store-Materials: **T-12.3 war nur
scheinbar erledigt.** Das Icon war die Expo-Vorlage, in `assets/icon.png` sogar
mit sichtbaren Konstruktionslinien. Ersetzt und als Skript hinterlegt
(`store/grafiken.py`), damit es reproduzierbar bleibt.

Und **T-12.1 ebenfalls nicht ganz**: Die Lupe und das X in beiden Suchleisten
trugen Papers englische Vorgabewerte, `search` und `clear`. Ein Screenreader
sagte sie in einer durchgehend deutschen App auf Englisch an. Sichtbar war das
nirgends – es sind zwei Symbole ohne Text. Gefunden wurde es im
Hierarchie-Abzug eines fehlgeschlagenen E2E-Laufs, nicht im Durchgang von
M12. Behoben über `products.searchAction` / `searchClear` und die
entsprechenden Schlüssel unter `catalog`.

> Das ist die Lehre aus beiden Funden: Ein Kriterium wie „Beschriftungen
> vollständig" lässt sich nicht durch Ansehen abhaken. Was keinen sichtbaren
> Text hat, prüft man im Baum oder gar nicht.

**Abnahme V1:** Zehn Tester haben die App installiert. Der Entwickler benutzt sie bei jedem Einkauf – die vier Wochen des Erfolgskriteriums beginnen zu laufen.

---

## V2 – nach sieben Wochen Alltag

Entschieden am 27. Oktober 2026, nachdem die App sieben Wochen täglich in Gebrauch war. Drei Meilensteine, jeder für sich benutzbar, rund 28 Stunden. Die Entscheidungen stehen in ADR-043 bis ADR-046; die Anforderungen als FR-9 bis FR-11 in `PRD.md`.

**Nicht gebaut, bewusst:** Haltbarkeitsdaten (Mengenpflege in Verkleidung), Rezepte aus dem Netz (bricht den Grundsatz), Wochentage im Plan (werden ignoriert), Abhaken im Widget (vertagt, ADR-045).

### M13 – Vorrat

**Ziel:** Die App weiß, was zu Hause ist – ohne dass jemand Buch führt (ADR-043).

| ID | Aufgabe | FR | h | Fertig, wenn … |
|---|---|---|---|---|
| T-13.1 | Tabelle `pantry` (product_id PK → products CASCADE, added_at), neue Migration, Schema-Test für die Löschregel | FR-9.1 | 1 | Migration 0001 liegt vor, 0000 unverändert, Schema-Test grün |
| T-13.2 | Reine Logik: Produkt-IDs aus den Historie-Entwürfen, Checkliste aus Historie ∪ Vorrat nach Abteilungen, Fehlende ermitteln | FR-9.2, FR-9.4 | 2 | Unit-Tests: Duplikate, fehlender Produktbezug, Abteilungsreihenfolge, „Sonstiges", alphabetisch, leere Eingaben |
| T-13.3 | Repository: Live-Abfrage, Haken setzen/entfernen, Fehlende auf Liste; Einbau in die Transaktion von `finishShopping` | FR-9.1, FR-9.3, FR-9.4 | 1,5 | `finishShopping` schreibt Historie und Vorrat in **einer** Transaktion; bestehende Tests unverändert grün |
| T-13.4 | Screen `/vorrat`: Checkliste nach Abteilungen, Knopf „n fehlen → auf die Liste", Einträge in beiden Menüs, Texte in `de.json` | FR-9.2–9.4 | 2 | Skizze aus der Erkundung umgesetzt, 48 dp, Beschriftungen, hell und dunkel |
| T-13.5 | Hinweis „Im Vorrat" unter dem Vorschlag beim Tippen – kein Ausblenden | FR-9.5 | 0,5 | Treffer zeigt die Zeile; Vorschlags-Tests unverändert |
| T-13.6 | Sicherung: `pantry` als optionale Tabelle (ADR-046); `architecture.md` §3, §4, §5 nachziehen | FR-9.6 | 1 | V1-Sicherungsdatei lässt sich weiter einspielen; Backup-Tests decken „Tabelle fehlt" ab |
| T-13.7 | E2E `vorrat.yaml`: Einkauf abschließen → Vorrat gefüllt → Haken weg → auf die Liste → Hinweis beim Tippen | – | 1 | Flow grün auf dem S24 |

**Abnahme:** Nach einem echten Einkauf steht alles Gekaufte im Vorrat, ohne dass du etwas getan hast. Eine Minute Checkliste vor dem nächsten Einkauf erzeugt die Liste.

### M14 – Rezepte und Wochenplan

**Ziel:** Kochen aus dem, was da ist (ADR-044).

| ID | Aufgabe | FR | h | Fertig, wenn … |
|---|---|---|---|---|
| T-14.1 | Tabellen `recipes`, `recipe_items`, `weekly_plan`, Migration, Schema-Tests | FR-10.1 | 1 | Löschregeln wie bei Vorlagen, geprüft |
| T-14.2 | Grundstock: ~35 Alltagsgerichte als JSON, Zutaten nur aus `products.json`, keine Markennamen; Test prüft jede Zutat | FR-10.2 | 2 | Test „jede Zutat existiert im Katalog" grün; keine Duplikate |
| T-14.3 | Reine Logik: `planRecipeShopping` (da / fehlt / schon auf Liste), `buildRecipeOverview`, `planWeeklyShopping`, `planRecipeReset` nach ADR-031 | FR-10.3–10.6 | 2,5 | Tests für Vorrat-Treffer, Listen-Treffer, Zutat ohne Produkt, Reihenfolge, Wochen-Vereinigung |
| T-14.4 | Repository: Abfragen, anlegen/ändern/löschen, Fehlendes auf Liste (über `addProductsToList`), Wochenplan, Zurücksetzen, Grundstock beim ersten Start | FR-10.2, 10.5, 10.6 | 2 | Alles Zusammengesetzte in Transaktionen |
| T-14.5 | Screens `/rezepte` (Wochenplan oben, alle Gerichte sortiert) und `/rezept?recipeId=` (Zutaten mit da/fehlt, Notiz, Knopf); Zutateneingabe über `AddItemBar` | FR-10.1, 10.3–10.6 | 3 | Skizzen umgesetzt, hell und dunkel, 48 dp |
| T-14.6 | Sicherung (optional, ADR-046), E2E `rezepte.yaml`, Doku | FR-10.7 | 1,5 | Flow grün; `architecture.md` kennt die Tabellen |

**Abnahme:** Die Übersicht nennt mindestens ein Gericht mit „Alles da". „Fehlendes auf die Liste" setzt genau das, was fehlt, und nichts doppelt.

### M15 – Widget

**Ziel:** Die Liste sehen, ohne die App zu öffnen (ADR-045).

| ID | Aufgabe | FR | h | Fertig, wenn … |
|---|---|---|---|---|
| T-15.1 | Lokales Expo-Modul `modules/to-shopping-widget`: `AppWidgetProvider`, Layout, Receiver im Manifest-Fragment, lesender SQLite-Zugriff, Tipp öffnet die Liste | FR-11.1, FR-11.2 | 4 | Widget liegt auf dem S24 und zeigt die offenen Artikel der zuletzt geöffneten Liste |
| T-15.2 | `refreshWidget()` aus der App nach Schreibvorgängen; Layout hell und dunkel; leere Liste, keine Liste | FR-11.3, FR-11.4 | 3 | Abhaken in der App ist binnen Sekunden im Widget sichtbar |
| T-15.3 | Abschnitt in `abnahme.md`, Pflichtpunkt in `architecture.md` §3.4 (zweite Stelle, die das Schema kennt), Doku | – | 1 | Gate 5 deckt ab, was Gate 4 nicht kann |

**Abnahme:** Das Widget überlebt einen Neustart des Telefons und einen `expo prebuild --clean`.

---

### M16 – Rezepte vertiefen

**Ziel:** Schritte und Gewürze, ohne dass der Rezeptteil zum Kochbuch wird (ADR-047). Entschieden am 27. Oktober 2026 nach dem ersten Blick auf den Grundstock – gegen die Empfehlung eines Freitextfelds, auf Wunsch des Auftraggebers.

| ID | Aufgabe | FR | h | Fertig, wenn … |
|---|---|---|---|---|
| T-16.1 | Tabelle `recipe_steps` (recipe_id CASCADE, position, text ≤ 500), Spalte `products.is_staple`, Migration 0003, Schema-Tests | FR-10.9, FR-4.5 | 1 | Migration liegt vor, 0000–0002 unverändert |
| T-16.2 | Katalog: ~10 gängige Gewürze als Grundvorrat; Staple-Kennzeichen für Salz, Pfeffer, Zucker, Mehl, Öle, Essig, Senf, Gemüsebrühe; einmaliges Nachsäen auf Bestandsgeräten über `catalog_seed_version` | FR-4.5 | 2 | Test: alle Seed-Grundvorrat-IDs existieren; Nachsäen fasst gelöschte/umbenannte Produkte nicht an |
| T-16.3 | Reine Logik: Status `staple` in `planRecipeShopping`, Übersicht und Wochenplan zählen Grundvorrat nicht; Schritt-Helfer (säubern, renummerieren, leere verwerfen) | FR-10.9, FR-10.10 | 2 | Tests: Grundvorrat nie „fehlt", nie auf der Liste; Schritte 1..n |
| T-16.4 | Grundstock: Schritte (3–6 je Gericht) und Gewürze in `recipes.json`; `buildRecipeRows` liefert Schritt-Zeilen; Validierung | FR-10.2 | 3 | Jedes Gericht hat Schritte; jede Zutat existiert; Schritte ≤ 500 Zeichen |
| T-16.5 | Repository (Schritte in create/update/reset; Staple-Umschalter im Katalog) und Screens: Schritte in Ansicht und Editor mit Pfeilen (ADR-028), Grundvorrat-Kennzeichen an Zutaten, Checkbox „Grundvorrat" im Produkt-Dialog | FR-10.9, 10.10, 4.5 | 4 | Skizze umgesetzt, 48 dp, Beschriftungen, hell und dunkel |
| T-16.6 | Sicherung (`recipeSteps` optional, Versionsmerker zurücksetzen), E2E `rezept-schritte.yaml`, Doku | FR-10.8 | 2 | Flow grün; `architecture.md` kennt Tabelle, Spalte und Regel |

**Abnahme:** Pfannkuchen zeigt Schritte und „Alles da", obwohl Salz draufsteht. Ein eigener Schritt lässt sich anlegen, umsortieren, löschen.

---

## Nach V1

Nicht Teil dieser Roadmap, hier nur als Ausblick und in der Reihenfolge, die ich empfehlen würde:

1. **Vier Wochen nutzen und nichts bauen.** Notieren, was im Alltag stört. Diese Liste ist mehr wert als jede Planung von heute.
2. Korrekturen aus dem echten Gebrauch.
3. Barcode-Scan oder Homescreen-Widget – je nachdem, was sich als nützlicher erwiesen hat.
4. Live-Sync (ADR-003) – das größte Vorhaben, mit vollständiger Neubewertung der Compliance (Aufgabe C-12).
5. iOS, sobald Gerät und Budget vorhanden sind.
6. Öffentliche Veröffentlichung: Name überdenken, Store-Eintrag, Aufgaben C-8 bis C-11.

---

## Verweise

- Anforderungen: [`PRD.md`](PRD.md)
- Technische Umsetzung: [`architecture.md`](architecture.md)
- Begründungen: [`decisions.md`](decisions.md)
- Rechtliche Aufgaben: [`compliance.md`](compliance.md)
