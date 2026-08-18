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
| T-12.6 | Erstes Bundle in den internen Test, EAS Update einrichten, Tester einladen | FR-8.3, FR-8.4 | 1 | Ein Tester installiert erfolgreich über den Play Store |

**Abnahme V1:** Zehn Tester haben die App installiert. Der Entwickler benutzt sie bei jedem Einkauf – die vier Wochen des Erfolgskriteriums beginnen zu laufen.

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
