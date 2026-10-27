# PRD – To-Shopping

**Version:** 1.0
**Stand:** 2026-08-18
**Status:** Abgenommen (Grundlage für V1)
**Verantwortlich:** Aytekin (Produkt + Entwicklung in Personalunion)

---

## 1. Problem

Der Wocheneinkauf ist eine wiederkehrende Aufgabe mit einem wiederkehrenden Aufwand: Die Einkaufsliste wird jedes Mal von Grund auf neu geschrieben, obwohl sich 80 % der Artikel von Woche zu Woche wiederholen.

Heutige Lösung des Nutzers: Zettel oder eine generische Notizen-App (handschriftlich oder getippt). Beides hat dieselben drei Schwächen:

1. **Kein Gedächtnis.** Jeder Artikel muss jedes Mal neu geschrieben werden. Nichts fließt vom letzten Einkauf in den nächsten.
2. **Keine Struktur.** Die Liste hat die Reihenfolge, in der einem etwas eingefallen ist – nicht die Reihenfolge, in der man den Laden abläuft. Ergebnis: mehrfaches Kreuzen durch den Markt.
3. **Keine Gedächtnisstütze.** Es gibt keinen Mechanismus, der beim Zusammenstellen zeigt, was man üblicherweise kauft. Vergessene Artikel fallen erst zu Hause auf.

Dazu kommt eine Nebenanforderung aus dem Alltag: Es wird in **verschiedenen Läden** und zu **verschiedenen Zeitpunkten** eingekauft, und gelegentlich geht **jemand anderes** einkaufen und braucht die Liste.

### Warum keine bestehende App

Bring!, AnyList, Listonic und Google Keep lösen dieses Problem funktional bereits. Sie wurden bewusst verworfen, aus zwei Gründen:

- **Datenhoheit:** Diese Apps verlangen eine Registrierung und speichern Listen auf fremden Servern. Für eine Einkaufsliste ist das aus Sicht des Nutzers unangemessen.
- **Lernziel:** Das Projekt ist ausdrücklich ein eigenes Produkt, an dem der Gesamtzusammenhang gelernt werden soll – Architektur, Datenmodell, Store-Prozess.

To-Shopping ist deshalb bewusst **lokal, kontenlos und offline**.

---

## 2. Zielgruppe

### Primär: der Entwickler selbst

Nutzt Android (Samsung Galaxy S24), kauft regelmäßig in mehreren Läden ein, führt heute Zettel- und Notizlisten parallel. Erfolgsmaßstab des gesamten Projekts.

### Sekundär: 10 Tester aus Familie und Freundeskreis

Kernmerkmale, die den Produktentwurf bestimmen:

- **Nicht technikaffin.** Sie installieren keine APKs aus unbekannten Quellen, sie lesen keine Anleitungen, und sie melden Fehler nicht von selbst – sie hören einfach auf, die App zu benutzen.
- **Gemischte Nutzungsform.** Ein Teil führt eigene, unabhängige Listen. Ein Teil kauft im selben Haushalt ein und will Listen austauschen.
- **Erwartungshaltung** ist von Bring! & Co. geprägt (siehe Risiko in Abschnitt 8).

Daraus folgt die oberste Produktregel:

> **Benutzerfreundlichkeit schlägt Funktionsumfang.** Bei jeder Designentscheidung gewinnt die Variante, die ohne Erklärung verstanden wird.

### Region und Sprache

Deutschland, deutschsprachige Oberfläche. Technisch von Anfang an übersetzbar aufgebaut, aber V1 wird ausschließlich mit deutschen Texten ausgeliefert. Der Produktkatalog ist einsprachig deutsch.

### Plattform

**V1 ist Android-only.** Mindestversion Android 8.0. iOS ist technisch offengehalten, aber ausdrücklich kein V1-Ziel (Begründung: kein Mac, kein Testgerät, kein Budget für Cloud-Builds).

---

## 3. Produktvision in einem Satz

> Eine Einkaufsliste, die sich merkt, was du kaufst – damit du sie nie wieder von vorne schreiben musst.

### Die drei Kernnutzen

| Nutzen | Umsetzung im Produkt |
|---|---|
| **Nie wieder alles neu tippen** | Produktkatalog mit 150–200 vorbereiteten Artikeln + eigene Ergänzungen + Häufigkeits-Vorschläge |
| **Den Laden einmal ablaufen** | Kategorie-Reihenfolge pro Liste einstellbar (Ladenlayout-Sortierung) |
| **Nichts vergessen** | Katalog als Checkliste, Vorschläge aus der Historie, Vorlagen für wiederkehrende Einkäufe |

---

## 4. User Flows

Die Flows sind die verbindliche Beschreibung des Verhaltens. Bei Widersprüchen zwischen Flow und Feature-Liste gilt der Flow.

### Flow 1 – Liste zusammenstellen (Hauptflow, „Sofa-Flow")

**Auslöser:** Der Nutzer plant den nächsten Einkauf.

1. App öffnet auf dem **zuletzt genutzten Screen** – im Regelfall die aktive Liste.
2. Die Liste zeigt die offenen Artikel, gruppiert nach Kategorie, in der Reihenfolge des zugeordneten Ladens.
3. Am **unteren Bildschirmrand** liegt das Eingabefeld (Daumenreichweite).
4. Der Nutzer tippt die ersten Buchstaben. Darunter erscheinen sofort Treffer aus dem Katalog, sortiert nach **häufig und zuletzt gekauft**, dann alphabetisch.
5. Tippen auf einen Treffer → Artikel steht auf der Liste. Das Eingabefeld bleibt aktiv, der nächste Artikel kann direkt getippt werden.
6. Kein Treffer? Der oberste Vorschlag lautet **„‚Hafermilch' anlegen"**. Ein Tipp legt das Produkt im Katalog an und setzt es auf die Liste. Kategorie wird dabei abgefragt, Voreinstellung „Sonstiges".
7. **Alternativer Weg – Katalog durchblättern:** Button „Aus Produkten wählen" → Kategorieübersicht → Mehrfachauswahl über mehrere Kategorien hinweg → „Übernehmen" setzt alle gewählten Artikel auf die Liste. Dieser Weg ist zugleich die Gedächtnisstütze.
8. **Menge anpassen:** Antippen eines Artikels öffnet die Detailzeile mit Menge, Einheit und Notiz. Voreinstellung ist 1 Stück; die Menge wird in der Liste nur angezeigt, wenn sie ≠ 1 ist.
9. **Kein Speichern-Button.** Jede Änderung ist sofort persistent. Der Nutzer legt das Handy weg.

**Erfolgskriterium des Flows:** Eine typische Wochenliste mit 15 Artikeln ist in unter 60 Sekunden zusammengestellt, ohne ein Wort vollständig zu tippen.

### Flow 2 – Einkaufen (Laden-Flow)

**Auslöser:** Der Nutzer steht im Laden.

1. App öffnet auf der Liste. Die Artikel sind nach Kategorien in der **Ladenreihenfolge** gruppiert.
2. Der Nutzer **wischt** über einen Artikel → der Text wird sichtbar durchgestrichen (Animation), das Gerät gibt ein kurzes haptisches Feedback, der Artikel wird anschließend ausgeblendet.
3. Für jeden Wischvorgang erscheint kurz ein **„Rückgängig"**-Hinweis.
4. **Antipp-Alternative:** Jeder Artikel hat zusätzlich ein Kästchen. Wer nicht wischen kann oder will, tippt. Funktional identisch.
5. Am unteren Rand steht der Fortschritt: **„3 von 12 offen"**.
6. Über dem Abschluss-Button liegt ein Schalter **„4 erledigte anzeigen"**, der die abgehakten Artikel durchgestrichen wieder einblendet.
7. Artikel können auch im Laden noch hinzugefügt werden – das Eingabefeld bleibt erreichbar.
8. **„Einkauf abschließen"**:
   - Abgehakte Artikel verschwinden von der Liste und werden in die **Historie** geschrieben (Produkt, Menge, Datum).
   - **Nicht** abgehakte Artikel bleiben auf der Liste stehen und gehen in den nächsten Einkauf.
   - Bestätigungsdialog nur, wenn noch offene Artikel vorhanden sind.

### Flow 3 – Liste teilen (Senden)

1. In der Liste: Menü → **„Liste teilen"**.
2. Es öffnet sich das **normale Android-Teilen-Menü** (WhatsApp, Signal, E-Mail …).
3. Versendet wird ein Paket aus zwei Bestandteilen:
   - eine **Datei im JSON-Format** (`.tsl`), die die App lesen kann,
   - ein **lesbarer Text** der Liste im Nachrichtentext, damit auch Empfänger ohne App etwas damit anfangen können.
4. Es handelt sich ausdrücklich um eine **Momentaufnahme (Kopie)**. Änderungen des Empfängers fließen nicht zurück. Die App weist beim ersten Teilen einmalig darauf hin.

### Flow 4 – Liste empfangen (Import)

1. Der Empfänger tippt in WhatsApp auf die Datei → Android bietet To-Shopping zum Öffnen an.
2. Die App zeigt eine **Vorschau**: Listenname, Absenderangabe, Anzahl der Artikel.
3. Bestätigung erzeugt **immer eine neue Liste** (Benennung z. B. „Einkauf von Aytekin, 18.08."). Kein Überschreiben, kein Zusammenführen.
4. Produkte aus der geteilten Liste, die im eigenen Katalog fehlen, werden dort **ergänzt**. Bestehende Produkte werden über den Namen zugeordnet und nicht dupliziert.

### Flow 5 – Sicherung

1. Einstellungen → **„Alle Daten sichern"** → Datei wird über das Teilen-/Speichern-Menü abgelegt (Google Drive, Dateien-App, an sich selbst schicken).
2. Der Export enthält **alles**: Listen, Katalog, Kategorien, Ladenreihenfolgen, Vorlagen, Historie.
3. **„Sicherung wiederherstellen"** ersetzt den kompletten Datenbestand – mit ausdrücklicher Warnung und Bestätigung.
4. Sind seit der letzten Sicherung mehr als **14 Tage** vergangen, erscheint beim App-Start ein unaufdringlicher Hinweisstreifen mit „Jetzt sichern" und „Später". Keine System-Benachrichtigung.

### Flow 6 – Katalog pflegen

1. Einstellungen → **Produkte**: Liste aller Produkte, nach Kategorien gruppiert, durchsuchbar.
2. Produkt anlegen, umbenennen, Kategorie ändern, löschen – **auch bei mitgelieferten Produkten**.
3. Wird ein Produkt gelöscht, das auf einer Liste steht, bleibt der Listeneintrag als reiner Text bestehen.
4. **„Katalog zurücksetzen"** stellt den Auslieferungszustand wieder her. Eigene Produkte bleiben dabei erhalten, gelöschte mitgelieferte Produkte kehren zurück. Nur mit Bestätigung.

### Flow 7 – Listen und Läden verwalten

1. Listenübersicht: alle Listen mit Name und Anzahl offener Artikel.
2. Neue Liste anlegen: Name + Kategorie-Reihenfolge (Ladenlayout).
3. Die **Kategorie-Reihenfolge ist eine Eigenschaft der Liste** und wird per Drag-and-drop eingestellt. Es gibt keine separate Ladenverwaltung.
4. Listen umbenennen, duplizieren, löschen.
5. **„Als Vorlage speichern"** legt aus den aktuellen Artikeln eine Vorlage an.
6. **„Vorlage anwenden"** setzt die Artikel einer Vorlage auf die aktuelle Liste. Bereits vorhandene Artikel werden nicht doppelt eingefügt.

---

### Flow 8 – Vorrat prüfen (V2, „Vor-dem-Einkauf-Minute")

**Auslöser:** Der nächste Einkauf steht an; der Nutzer will wissen, was fehlt.

1. Liste → Menü → **Vorrat prüfen** (oder Übersicht → Menü → Vorrat).
2. Der Screen zeigt die üblichen Artikel nach Abteilungen, jeder mit Haken: „ist da". Gefüllt hat ihn der letzte abgeschlossene Einkauf – der Nutzer hat dafür nichts getan.
3. Der Nutzer geht die Liste durch und entfernt den Haken bei allem, was aufgebraucht ist. Ein Tipp pro Artikel.
4. Unten steht „n fehlen". Ein Tipp auf **Auf die Liste setzen** legt alle Fehlenden auf die aktive Liste – was schon draufsteht, wird übersprungen.
5. Zurück zur Liste; sie ist fertig für Flow 2.

**Erfolgskriterium:** Eine Wochenliste entsteht in unter einer Minute, ohne dass ein Artikel getippt wird.

### Flow 9 – Kochen aus dem Vorrat (V2)

**Auslöser:** „Was koche ich diese Woche?"

1. Übersicht → Menü → **Rezepte**. Ganz oben die Gerichte, für die alles da ist; darunter die mit einer fehlenden Zutat, dann zwei, und so fort.
2. Ein Tipp auf ein Gericht zeigt die Zutaten: Haken bei dem, was im Vorrat liegt, Einkaufswagen bei dem, was fehlt.
3. **Diese Woche kochen** nimmt das Gericht in den Wochenplan.
4. Auf der Übersicht steht der Wochenplan oben: **Alles Fehlende auf die Liste (n)** setzt die Zutaten aller gewählten Gerichte gesammelt auf die aktive Liste – jede nur einmal, und nur, was weder da ist noch schon draufsteht.
5. Nach dem Einkauf: Abschließen füllt den Vorrat; die Gerichte stehen jetzt bei „Alles da".

**Erfolgskriterium:** Der Wocheneinkauf für drei Gerichte ist in drei Tipps auf der Liste.

---

## 5. Funktionsumfang V1

Die Anforderungen sind durchnummeriert und werden in `roadmap.md` auf Meilensteine abgebildet.

### FR-1 Listen

| ID | Anforderung |
|---|---|
| FR-1.1 | Mehrere Listen parallel führen, frei benennbar |
| FR-1.2 | Liste anlegen, umbenennen, duplizieren, löschen |
| FR-1.3 | Kategorie-Reihenfolge pro Liste einstellbar (Drag-and-drop) |
| FR-1.4 | Listenübersicht mit Anzahl offener Artikel |
| FR-1.5 | App startet auf dem zuletzt genutzten Screen |

### FR-2 Artikel

| ID | Anforderung |
|---|---|
| FR-2.1 | Artikel per Texteingabe mit Sofort-Vorschlägen hinzufügen |
| FR-2.2 | Neues Produkt direkt aus der Eingabe anlegen |
| FR-2.3 | Artikel per Katalog-Durchblättern mit Mehrfachauswahl hinzufügen |
| FR-2.4 | Menge und Einheit pro Artikel (feste Einheitenauswahl) |
| FR-2.5 | Freie Notiz pro Artikel |
| FR-2.6 | Menge wird in der Liste nur bei ≠ 1 angezeigt |
| FR-2.7 | Artikel von der Liste entfernen |
| FR-2.8 | Änderungen sind sofort persistent, kein Speichern-Button |

### FR-3 Abhaken und Abschluss

| ID | Anforderung |
|---|---|
| FR-3.1 | Wischgeste hakt ab, mit Durchstreich-Animation |
| FR-3.2 | Haptisches Feedback beim Abhaken |
| FR-3.3 | „Rückgängig" nach jedem Abhaken |
| FR-3.4 | Gleichwertige Antipp-Alternative (Kästchen) |
| FR-3.5 | Abgehakte Artikel werden ausgeblendet |
| FR-3.6 | Schalter blendet erledigte Artikel wieder ein |
| FR-3.7 | Fortschrittsanzeige „x von y offen" |
| FR-3.8 | „Einkauf abschließen": Erledigtes in die Historie, Rest bleibt liegen |

### FR-4 Katalog und Kategorien

| ID | Anforderung |
|---|---|
| FR-4.1 | 150–250 mitgelieferte Produkte in 10–12 Kategorien (angehoben mit ADR-047: Gewürze und Grundzutaten) |
| FR-4.2 | Produkte anlegen, umbenennen, Kategorie ändern, löschen – auch mitgelieferte |
| FR-4.3 | Katalog durchsuchbar und nach Kategorien gruppiert |
| FR-4.4 | „Katalog zurücksetzen" auf Auslieferungszustand |

### FR-5 Intelligenz

| ID | Anforderung |
|---|---|
| FR-5.1 | Historie: was wurde wann in welcher Menge gekauft |
| FR-5.2 | Vorschläge sortiert nach Häufigkeit und Aktualität |
| FR-5.3 | Liste als Vorlage speichern |
| FR-5.4 | Vorlage auf eine Liste anwenden, ohne Duplikate zu erzeugen |
| FR-5.5 | Vorlagen verwalten (umbenennen, löschen) |

### FR-6 Teilen und Sicherung

| ID | Anforderung |
|---|---|
| FR-6.1 | Liste über das Android-Teilen-Menü versenden (JSON-Datei + lesbarer Text) |
| FR-6.2 | Empfangene Liste öffnen, Vorschau anzeigen, als neue Liste importieren |
| FR-6.3 | Fehlende Produkte beim Import in den Katalog übernehmen, ohne zu duplizieren |
| FR-6.4 | Vollsicherung exportieren |
| FR-6.5 | Vollsicherung wiederherstellen, mit Warnung |
| FR-6.6 | Hinweis in der App nach 14 Tagen ohne Sicherung |
| FR-6.7 | Einmaliger Hinweis, dass Teilen eine Kopie erzeugt |

### FR-7 Darstellung und Bedienung

| ID | Anforderung |
|---|---|
| FR-7.1 | Material 3, Grundfarbe Grün |
| FR-7.2 | Dark Mode automatisch nach Systemeinstellung, kein eigener Schalter |
| FR-7.3 | Schriftgrößen skalieren mit der Systemeinstellung |
| FR-7.4 | Kontraste erfüllen WCAG-AA-Mindestwerte |
| FR-7.5 | Trefferflächen mindestens 48 × 48 dp |
| FR-7.6 | Screenreader-Beschriftungen für alle Bedienelemente |
| FR-7.7 | Deutsche Texte, technisch übersetzbar ausgelagert |

### FR-8 Betrieb

| ID | Anforderung |
|---|---|
| FR-8.1 | Lokaler Fehlerspeicher bei Abstürzen |
| FR-8.2 | „Fehlerbericht senden" über das Teilen-Menü, kein Drittanbieter |
| FR-8.3 | Auslieferung über internen Play-Store-Test |
| FR-8.4 | OTA-Updates für Änderungen am App-Code – **in V1 vertagt, siehe ADR-040** |

### V2 – entschieden am 27. Oktober 2026 nach sieben Wochen Alltag

Hebt zwei Nicht-Ziele aus Abschnitt 6 auf (Widget, Rezepte) und fügt den Vorrat hinzu. Begründungen: ADR-043 bis ADR-046.

### FR-9 Vorrat

| ID | Anforderung |
|---|---|
| FR-9.1 | „Einkauf abschließen" setzt alle abgehakten Artikel mit Produktbezug in den Vorrat – in derselben Transaktion wie die Historie |
| FR-9.2 | Der Vorrat ist eine Checkliste der üblichen Artikel (Kaufhistorie ∪ Vorrat), nach Abteilungen; Haken = „ist da" |
| FR-9.3 | Haken entfernen = aufgebraucht; Haken setzen = da |
| FR-9.4 | Alle Fehlenden der Checkliste gesammelt auf die aktive Liste, ohne Duplikate (Regel aus ADR-038) |
| FR-9.5 | Vorschläge beim Tippen zeigen „Im Vorrat" unter dem Treffer – ohne ihn auszublenden |
| FR-9.6 | Der Vorrat ist in der Sicherung enthalten; ältere Sicherungen bleiben einspielbar (ADR-046) |

### FR-10 Rezepte und Wochenplan

| ID | Anforderung |
|---|---|
| FR-10.1 | Ein Rezept besteht aus Name, Zutaten (Katalogprodukte, Menge optional) und einer Notiz – keine Schritte, Bilder, Portionen |
| FR-10.2 | Mitgelieferter Grundstock von Alltagsgerichten, veränderbar, mit „Rezepte zurücksetzen" nach ADR-031 |
| FR-10.3 | Die Übersicht sortiert nach fehlenden Zutaten, „Alles da" zuerst; jede Zeile nennt die Zahl und bis zu zwei fehlende Zutaten |
| FR-10.4 | Die Detailansicht kennzeichnet jede Zutat als da oder fehlend |
| FR-10.5 | „Fehlendes auf die Liste" setzt nur, was weder im Vorrat liegt noch offen auf der Liste steht |
| FR-10.6 | Wochenplan: Rezepte für diese Woche wählen, gesammelt Fehlendes auf die Liste, Plan leeren – keine Wochentage |
| FR-10.7 | Zutaten werden über dasselbe Eingabefeld mit denselben Vorschlägen erfasst wie Listenartikel |
| FR-10.8 | Rezepte und Wochenplan sind in der Sicherung enthalten (optional, ADR-046) |
| FR-10.9 | Ein Rezept hat nummerierte Zubereitungsschritte – **nur Text**: keine Timer, Fotos, Portionen (ADR-047, ändert FR-10.1) |
| FR-10.10 | Zutaten, deren Produkt „Grundvorrat" ist, zählen nicht als fehlend und gehen nicht automatisch auf die Liste |
| FR-4.5 | Ein Produkt kann als „Grundvorrat" gekennzeichnet werden; mitgelieferte Gewürze und Grundzutaten sind es ab Werk (ADR-047) |

### FR-11 Widget

| ID | Anforderung |
|---|---|
| FR-11.1 | Ein Homescreen-Widget zeigt die offenen Artikel der zuletzt geöffneten Liste, höchstens fünf, dann „+ n weitere" |
| FR-11.2 | Ein Tipp auf das Widget öffnet diese Liste in der App |
| FR-11.3 | Das Widget aktualisiert sich nach jeder Änderung in der App, spätestens alle 30 Minuten |
| FR-11.4 | Das Widget folgt dem hellen und dunklen Systemdesign |
| FR-11.5 | Das Widget liest nur; es verändert keine Daten (ADR-045) |

---

## 6. Nicht-Ziele in V1

Bewusst gestrichen, nicht vergessen. Jeder Punkt wurde im Discovery-Interview besprochen und abgewählt.

| Nicht-Ziel | Begründung | Wiedervorlage |
|---|---|---|
| Live-Sync / gemeinsames Bearbeiten | Erfordert Server, Konten, Konfliktbehandlung – verdoppelt das Projekt | Nach V1, eigener Meilenstein |
| Benutzerkonten, Login, Rollen | Ohne Server gegenstandslos; erspart „Sign in with Apple" und Kontolöschungspflicht | Mit Sync |
| iOS | Kein Mac, kein Testgerät, kein Budget | Offen |
| Homescreen-Widget | Erfordert nativen Android-Code, mehrere Abende Aufwand | V2 |
| Barcode-Scan | Kameraberechtigung + Produktdatenbank | V2 |
| System-Benachrichtigungen | Berechtigungsdialog beim ersten Start schadet dem ersten Eindruck | Offen |
| Standortbasierte Erinnerungen | Hintergrund-Standort ist rechtfertigungspflichtig und datenschutzintensiv | Nein |
| Werbung | Zerstört die Datensparsamkeit, bringt bei 10 Nutzern nichts, macht DSA-Händlerdaten öffentlich | Nein |
| In-App-Käufe | Store-Abrechnung, AGB, Widerruf, Kaufwiederherstellung | Offen |
| Crash-Reporting bei Dritten | Bei 10 bekannten Testern ist Direktkontakt wirksamer | Bei öffentlicher Veröffentlichung: Sentry EU |
| Automatisches Cloud-Backup | Nutzerentscheidung gegen Google Drive | Ein Konfigurationseintrag, jederzeit nachrüstbar |
| Produktbilder | Pflegeaufwand, Speicherbedarf, Lizenzfragen | Nein |
| Preise und Budget | Pflegeaufwand bei jedem Einkauf, veraltet sofort | V2+ |
| Rezepte, Wochenplan | Eigenständiges Produkt im Bauch der App | V2+ |
| Angebote, Prospekte, echte Filialdaten | Erfordert externe Datenquellen und Server | Nein |
| Ernährungs-/Kalorientracking | Anderes Produkt | Nein |
| Englische Übersetzung | Struktur vorbereitet, Texte nicht | Bei öffentlicher Veröffentlichung |

---

## 7. Erfolgskriterien

### Primär (Abnahmekriterium für V1)

> **Der Entwickler benutzt die App vier Wochen lang bei jedem Einkauf und greift dabei kein einziges Mal zum Zettel.**

### Sekundär

| Kriterium | Zielwert |
|---|---|
| Zusammenstellen einer 15-Artikel-Liste | unter 60 Sekunden, ohne ein Wort vollständig zu tippen |
| Anteil der Artikel, die aus Vorschlägen oder Katalog kommen | über 80 % |
| Tester, die die App nach 4 Wochen freiwillig weiter benutzen | mindestens 3 von 10 |
| Abstürze im Testzeitraum | 0 im Hauptflow |

### Lernziel (nicht messbar, aber gleichrangig)

Der Entwickler kann nach V1 erklären, **warum** die Architektur so aussieht, wie sie aussieht – Datenmodell, Persistenz, Offline-Strategie, Store-Prozess. Dafür gilt: Zu jedem abgeschlossenen Arbeitsblock gehört eine schriftliche Erklärung mit Begründung und verworfenen Alternativen.

---

## 8. Bekannte Risiken

| # | Risiko | Gegenmaßnahme |
|---|---|---|
| R1 | **Projekt schläft ein.** 5 h/Woche, kein Termindruck, 3–4 Monate Laufzeit | Roadmap so geschnitten, dass die App ab Meilenstein 4 täglich selbst nutzbar ist. Jeder Task passt in einen Abend (1–3 h) |
| R2 | **Stille Fehler bleiben unentdeckt.** Der Code wird nicht Zeile für Zeile geprüft | Unit-Tests für jede Logik, die still falsch sein kann: Sortierung, Vorschläge, Import/Export, Mengen. E2E-Smoke-Test über den Hauptflow |
| R3 | **Datenverlust.** Kein automatisches Backup | Export ist eigener Meilenstein, Erinnerung nach 14 Tagen, Android Auto-Backup als dokumentierter Notausgang |
| R4 | **Erwartungslücke beim Teilen.** Tester erwarten Bring!-Verhalten (einer hakt ab, alle sehen es) | Einmaliger Hinweis in der App; beim Verteilen ausdrücklich ansagen |
| R5 | **Katalogqualität.** Ein schlecht zusammengestellter Startkatalog entwertet den Kernnutzen | Katalog wird als eigener Task mit Abnahme behandelt, nicht nebenbei erzeugt |

---

## 9. Getroffene Annahmen

Diese Annahmen wurden im Interview nicht explizit entschieden, sondern gesetzt und abgenommen:

1. **Import erzeugt immer eine neue Liste.** Kein Überschreiben, kein Zusammenführen – die einzige Variante ohne Datenverlustrisiko.
2. **Ein „Laden" ist eine Eigenschaft der Liste**, keine eigene Verwaltungsebene.
3. **Teilen-Format ist JSON**, plus lesbare Textfassung für Empfänger ohne App.
4. **Einheiten sind eine feste Auswahl:** Stück, g, kg, ml, l, Packung, Bund, Dose. Keine Freitexteingabe.
5. **Die Historie speichert nur Produkt, Menge und Datum** – keine Preise, keine Orte.
6. **Mindest-Android-Version 8.0.**
7. **Keine Übergabe an Dritte** innerhalb der nächsten 12 Monate.

---

## 10. Rahmenbedingungen

| Punkt | Festlegung |
|---|---|
| Zeitbudget | 5 Stunden pro Woche |
| Zieltermin | keiner; realistische Laufzeit für V1: 3–4 Monate |
| Laufende Kosten | 0 € pro Monat |
| Entwicklungsrechner | Windows 11 |
| Testgerät | Samsung Galaxy S24 (Android) |
| Entwicklungsmodus | Code wird KI-gestützt erzeugt, Abnahme in größeren Blöcken mit schriftlicher Erklärung |
| Qualitätssicherung | Typecheck, Lint, Unit-Tests, E2E-Smoke, manuelle Abnahme (siehe `CLAUDE.md`) |

---

## Verweise

- Technische Umsetzung: [`architecture.md`](architecture.md)
- Begründete Einzelentscheidungen: [`decisions.md`](decisions.md)
- Datenschutz- und Store-Pflichten: [`compliance.md`](compliance.md)
- Umsetzungsplan: [`roadmap.md`](roadmap.md)
