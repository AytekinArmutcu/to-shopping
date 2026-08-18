# Architekturentscheidungen – To-Shopping

Kurz-ADRs (Architecture Decision Records). Jeder Eintrag beantwortet vier Fragen: **Warum stand die Entscheidung an? Was wurde entschieden? Was wurde verworfen? Was kostet uns das?**

Format bewusst knapp. Diese Datei ist das Gedächtnis des Projekts – sie erklärt in sechs Monaten, warum etwas so ist, wie es ist.

**Status-Legende:** `Angenommen` · `Aufgeschoben` (bewusst später) · `Abgelöst durch ADR-xxx`

---

## ADR-001 – React Native mit Expo als Stack

**Datum:** 2026-08-18 · **Status:** Angenommen

**Kontext**
Eine Einkaufslisten-App für Android, iOS soll technisch offenbleiben. Der Entwickler schreibt den Code nicht selbst, sondern lässt ihn KI-gestützt erzeugen und nimmt ihn in großen Blöcken ab. Entwicklungsrechner ist Windows, Budget 0 €/Monat, Zeitbudget 5 h/Woche. OTA-Updates sind gewünscht (ADR-013).

**Entscheidung**
React Native mit Expo, TypeScript im Strict-Modus, Expo Router, React Native Paper.

**Verworfene Alternativen**

| Alternative | Warum verworfen |
|---|---|
| **Flutter** | Technisch mindestens ebenbürtig, bessere Werkzeuge, exzellente UI-Qualität. Scheitert an OTA: Flutter kann das offiziell nicht, der einzige Weg ist ein kostenpflichtiger Drittanbieter – unvereinbar mit 0 € Budget. Zweitrangig: Dart hat deutlich weniger öffentlich verfügbaren Beispielcode als TypeScript, was bei KI-gestützter Entwicklung die Ergebnisqualität senkt. |
| **Natives Android (Kotlin + Jetpack Compose)** | Wäre die sauberste Android-App und die beste Material-3-Umsetzung. Schließt iOS aber endgültig aus (Neuentwicklung statt Portierung) und macht OTA unmöglich. Für „nur Android, für immer" die richtige Wahl – iOS wurde ausdrücklich offengehalten. |
| **PWA / Web-App** | Billigster Weg und bei einer Einkaufsliste nicht abwegig. Scheitert am Teilen-Konzept, das am Android-Teilen-Menü hängt, und an der Installationshürde („Zum Startbildschirm hinzufügen") für nicht-technikaffine Nutzer. Außerdem war der Store-Prozess ein ausdrückliches Lernziel. |
| **Bare React Native ohne Expo** | Mehr Kontrolle, aber Build-Kette und OTA müssten selbst gebaut und gepflegt werden. Kein Gewinn, nur Reibung. |

**Konsequenz**
Android-Builds laufen kostenlos lokal unter Windows. Ein späterer iOS-Port erfordert keine Neuentwicklung, aber Geld und ein Testgerät. Erkauft wird das mit der bekannten React-Native-Schwäche: native Zusatzfunktionen (Widget, Share Extension) erfordern plattformspezifischen Code.

---

## ADR-002 – Kein Backend, alle Daten lokal

**Datum:** 2026-08-18 · **Status:** Angenommen

**Kontext**
Ausdrückliche Anforderung: keine Registrierung, keine Daten bei einem Unternehmen. Eine Einkaufsliste rechtfertigt aus Nutzersicht kein Konto.

**Entscheidung**
Sämtliche Daten liegen in einer SQLite-Datenbank auf dem Gerät. Kein Server, keine API, kein Konto.

**Verworfene Alternativen**
Supabase, Firebase oder ein selbst gehostetes Backend – jeweils mit anonymer Geräte-Identität statt E-Mail-Registrierung. Verworfen für V1, weil damit AVV, Datenschutzerklärung mit Drittlandtransfer, Kontolöschungspflicht in den Stores, Konfliktbehandlung und laufende Kosten entstehen. Der Aufwand hätte das Projekt etwa verdoppelt.

**Konsequenz**
Ein sehr großer Teil üblicher App-Komplexität entfällt: keine Ladezustände, keine Netzwerkfehler, keine Synchronisationskonflikte, keine Auth-Schicht, kein Block „Auth & Rollen" im Discovery. Preis: kein gemeinsames Bearbeiten (→ ADR-003) und kein automatisches Backup (→ ADR-004).

---

## ADR-003 – Teilen als Momentaufnahme statt Live-Sync

**Datum:** 2026-08-18 · **Status:** Angenommen für V1, Live-Sync aufgeschoben

**Kontext**
Listen sollen mit Haushaltsmitgliedern geteilt werden. Gleichzeitig gilt ADR-002 (kein Server). Zielgruppe ist nicht technikaffin, Teilen muss so einfach sein wie das Weiterleiten eines Fotos.

**Entscheidung**
Teilen über das normale Android-Teilen-Menü: eine JSON-Datei plus eine lesbare Textfassung. Der Empfänger importiert sie als neue Liste. Es ist eine **Kopie**, kein gemeinsamer Zustand.

**Verworfene Alternativen**
- *Live-Sync über ein Backend*: das eigentlich gewünschte Verhalten, aber unvereinbar mit ADR-002 und dem Zeitbudget. Als eigener Meilenstein nach V1 vorgemerkt.
- *Direktverbindung Gerät-zu-Gerät (Bluetooth/lokales WLAN)*: kein Server nötig, aber beide Geräte müssen gleichzeitig anwesend sein, das Verhalten unterscheidet sich zwischen Android-Herstellern, und der Frustfaktor ist hoch. Für nicht-technikaffine Nutzer ungeeignet.

**Konsequenz**
Teilen funktioniert offline, sofort und ohne jede Einrichtung. Aber: Hakt der Empfänger etwas ab, sieht der Absender es nicht. Das erzeugt eine **Erwartungslücke** gegenüber Bring! (Risiko R4 im PRD), abgefedert durch einen einmaligen Hinweis in der App. Das Datenmodell ist so gebaut, dass eine spätere Sync-Schicht darübergelegt werden kann, ohne es umzubauen.

---

## ADR-004 – Nur manuelles Backup, kein Android Auto-Backup

**Datum:** 2026-08-18 · **Status:** Angenommen (gegen die Empfehlung des Tech Leads)

**Kontext**
Ohne Server sind bei Geräteverlust alle Daten weg – auch der über Monate aufgebaute Katalog. Android Auto-Backup würde die App-Daten automatisch und verschlüsselt im Google-Drive-Konto des Nutzers sichern und wäre ein einzelner Konfigurationseintrag.

**Entscheidung**
Nur manueller Export und Import einer Sicherungsdatei. Kein Auto-Backup.

**Begründung des Auftraggebers**
Auch das eigene Google-Drive-Konto ist „Daten bei einem Unternehmen". Konsequenz aus der Grundhaltung, die auch ADR-002 trägt.

**Empfehlung des Tech Leads (abgelehnt)**
Auto-Backup zusätzlich aktivieren. Die nicht-technikaffine Zielgruppe wird von sich aus nie ein manuelles Backup anlegen; beim ersten Gerätewechsel ist deren Datenbestand verloren, und die Beschwerde landet beim Entwickler.

**Konsequenz**
Datenverlustrisiko bleibt bestehen (Risiko R3 im PRD). Abgefedert durch einen Hinweisstreifen in der App nach 14 Tagen ohne Sicherung. Die Entscheidung ist mit einem Konfigurationseintrag jederzeit umkehrbar – bewusst dokumentiert als Notausgang.

---

## ADR-005 – V1 ist Android-only

**Datum:** 2026-08-18 · **Status:** Angenommen

**Kontext**
Entwicklungsrechner ist Windows, es gibt kein iPhone und keinen Mac, das Budget ist 0 €/Monat. Alle Erstnutzer sind Android-Nutzer.

**Entscheidung**
V1 wird ausschließlich für Android gebaut, getestet und ausgeliefert. Der Stack hält iOS technisch offen (ADR-001), mehr nicht.

**Verworfene Alternative**
iOS von Anfang an mitlaufen lassen. Verworfen, weil iOS auf Windows nicht getestet werden kann – weder Simulator noch Gerät. Eine App zu veröffentlichen, die man selbst nie gesehen hat, führt absehbar zu Apple-Review-Ablehnungen und Fehlern, die niemand bemerkt.

**Konsequenz**
Der Aufwand halbiert sich gegenüber einer parallelen Entwicklung. Was ein späterer iOS-Port konkret erfordert, ist in `architecture.md`, Abschnitt 13, aufgelistet – der einzige echte Bruch ist die Teilen-Integration.

---

## ADR-006 – SQLite mit Drizzle ORM als Persistenz

**Datum:** 2026-08-18 · **Status:** Angenommen

**Kontext**
Es sind Listen, Artikel, Kategorien, Vorlagen und eine Kaufhistorie zu speichern. Über die Historie wird gerechnet (Häufigkeit, Aktualität). Das Schema wird sich während der Entwicklung mehrfach ändern.

**Entscheidung**
SQLite über `expo-sqlite`, Zugriff über Drizzle ORM mit versionierten Migrationen.

**Verworfene Alternativen**

| Alternative | Warum verworfen |
|---|---|
| **AsyncStorage / MMKV** (Schlüssel-Wert) | Für Listen und Artikel noch machbar, für die Historie mit Häufigkeitsauswertung nicht. Jede Abfrage müsste im JavaScript-Code nachgebaut werden. |
| **JSON-Datei im Dateisystem** | Keine Transaktionen. Ein Absturz beim „Einkauf abschließen" könnte den gesamten Datenbestand beschädigen. |
| **WatermelonDB** | Auf Synchronisation ausgelegt – Funktionalität, die hier ungenutzt bliebe, aber Komplexität mitbringt. |
| **SQLite ohne ORM (rohes SQL)** | Funktioniert, verliert aber die Typsicherheit zwischen Schema und Code. Genau darauf beruht bei KI-erzeugtem Code die Fehlererkennung. |

**Konsequenz**
Transaktionen sichern zusammengesetzte Vorgänge ab (Einkauf abschließen, Import). Das Schema ist typisiert, Schemaänderungen erzeugen Compilerfehler statt Laufzeitfehler. Preis: Migrationen müssen diszipliniert gepflegt werden – einmal ausgelieferte Migrationen werden nie verändert.

---

## ADR-007 – Listeneinträge speichern den Produktnamen als Kopie

**Datum:** 2026-08-18 · **Status:** Angenommen

**Kontext**
Ein Listeneintrag verweist auf ein Katalogprodukt. Produkte dürfen aber gelöscht und umbenannt werden (FR-4.2), und geteilte Listen erreichen Empfänger mit einem völlig anderen Katalog.

**Entscheidung**
Bewusste Denormalisierung: `list_items` speichert `name` und `category_id` als Kopie zum Zeitpunkt des Hinzufügens, zusätzlich zur optionalen `product_id`. Gleiches gilt für `purchase_history` und `template_items`.

**Verworfene Alternative**
Reine Normalisierung mit Fremdschlüssel auf `products`. Verworfen, weil dann das Löschen eines Produkts Listeneinträge mitreißt oder durch Löschsperren blockiert werden müsste – beides für den Nutzer unverständlich.

**Konsequenz**
Ein gelöschtes Produkt lässt den Listeneintrag als Text stehen. Umbenennungen wirken nicht rückwirkend auf bestehende Einträge – das ist gewollt, dasselbe Prinzip wie bei Rechnungspositionen. Preis: der Name steht an mehreren Stellen.

---

## ADR-008 – Reine Fachlogik getrennt vom Datenzugriff

**Datum:** 2026-08-18 · **Status:** Angenommen

**Kontext**
Der Auftraggeber liest den erzeugten Code nicht Zeile für Zeile und nimmt in großen Blöcken ab. Fehler in Sortierung, Ranking oder Importprüfung wären beim Draufschauen unsichtbar und würden erst durch falsche Daten auffallen.

**Entscheidung**
Alle Algorithmen liegen als reine Funktionen ohne Datenbankzugriff in `features/*/logic.ts`. Datenbankzugriff ausschließlich in `repository.ts`. Screens greifen nie direkt auf die Datenbank zu.

**Verworfene Alternative**
Logik direkt in den Screens oder in den Repository-Funktionen – kürzer zu schreiben, aber nur mit laufender App und gefüllter Datenbank testbar.

**Konsequenz**
Sortierung, Vorschlagsranking, Vorlagenabgleich und Formatprüfung sind vollständig mit Unit-Tests abgedeckt und liefern bei gleicher Eingabe immer dasselbe Ergebnis. Das ist die zentrale Gegenmaßnahme zu Risiko R2. Preis: etwas mehr Dateien und eine zusätzliche Schicht.

---

## ADR-009 – Material 3 mit eigener Farbwelt

**Datum:** 2026-08-18 · **Status:** Angenommen

**Kontext**
Zielgruppe ist nicht technikaffin und erwartet Bedienelemente, die sie aus anderen Android-Apps kennt. Gleichzeitig soll es die eigene App sein und nicht wie eine Vorlage aussehen.

**Entscheidung**
Material 3 über React Native Paper als Basis, mit eigener Grundfarbe (Grün), eigenem Icon und eigenen Details wie der Durchstreich-Animation.

**Verworfene Alternativen**
- *Material 3 unverändert*: sofort „richtig", aber ohne jeden Wiedererkennungswert.
- *Eigenes Designsystem*: mehrere Wochen Arbeit, und Dark Mode, Kontraste, Schriftskalierung und Screenreader-Tauglichkeit müssten von Hand nachgebaut werden. Bei 5 h/Woche unverhältnismäßig.

**Konsequenz**
Dark Mode, dynamische Farbrollen und Barrierefreiheitsgrundlagen kommen praktisch geschenkt. Preis: Die App bleibt erkennbar eine Android-App und wird auf iOS später nicht wie eine iOS-App wirken.

---

## ADR-010 – Dark Mode folgt dem System, ohne Schalter in der App

**Datum:** 2026-08-18 · **Status:** Angenommen

**Kontext**
Dark Mode wird erwartet. Ein eigener Umschalter in den Einstellungen wäre zusätzliche Funktionalität mit eigenem Zustand.

**Entscheidung**
Das Farbschema folgt automatisch der Systemeinstellung. Kein Schalter.

**Verworfene Alternative**
Dreistufiger Schalter (hell / dunkel / System). Verworfen: Wer dunkel will, hat es systemweit eingestellt. Die Funktion wird nicht vermisst, wenn sie fehlt.

**Konsequenz**
Kein zusätzlicher Zustand, keine zusätzliche Einstellung. Preis: Jeder Screen muss bei der Abnahme in beiden Modi angesehen werden – das ist in der Definition of Done verankert.

---

## ADR-011 – Kein Crash-Reporting bei Dritten, stattdessen lokaler Fehlerspeicher

**Datum:** 2026-08-18 · **Status:** Angenommen für V1

**Kontext**
Zehn persönlich bekannte Tester. Nicht-technikaffine Nutzer melden Fehler nicht von selbst – sie hören auf, die App zu benutzen.

**Entscheidung**
Abstürze werden lokal auf dem Gerät protokolliert (die letzten 20). Der Nutzer kann den Bericht über einen Knopf in den Einstellungen per Teilen-Menü an den Entwickler schicken. Kein SDK, keine automatische Übertragung.

**Verworfene Alternativen**
- *Firebase Crashlytics*: sehr einfach einzurichten, holt aber Google in eine bewusst google-freie App, mit Drittlandtransfer.
- *Sentry (EU-Region)*: datenschutzrechtlich sauber, kostenlos im benötigten Umfang. Für V1 dennoch verworfen, weil bei zehn bekannten Testern der direkte Kontakt wirksamer ist als ein Dashboard. **Vorgemerkt für den Tag der öffentlichen Veröffentlichung.**

**Konsequenz**
Nichts verlässt das Gerät ohne aktive Entscheidung des Nutzers. Die Datenschutzerklärung bleibt trivial. Preis: Abstürze werden nur bekannt, wenn jemand den Knopf drückt.

---

## ADR-012 – Keine System-Benachrichtigungen in V1

**Datum:** 2026-08-18 · **Status:** Angenommen

**Kontext**
Denkbar wären Einkaufserinnerungen und ein Hinweis auf fehlende Sicherungen. Ab Android 13 erfordert jede Benachrichtigung eine Berechtigungsabfrage.

**Entscheidung**
Keine System-Benachrichtigungen. Der Sicherungshinweis erscheint als unaufdringlicher Streifen beim App-Start.

**Verworfene Alternativen**
- *Lokale Benachrichtigungen*: Ein Berechtigungsdialog beim ersten Start ist der erste Eindruck der App – bei einer Zielgruppe, die auf Einfachheit reagiert, ein schlechter Anfang.
- *Standortbasierte Erinnerungen* („du bist bei Rewe"): erfordert Hintergrund-Standortzugriff, ist bei Google rechtfertigungspflichtig und verändert die Datenschutzerklärung grundlegend.

**Konsequenz**
Die App fragt beim ersten Start **keine einzige Berechtigung** ab. Preis: Erinnerungen sind nur sichtbar, wenn die App geöffnet wird.

---

## ADR-013 – OTA-Updates über EAS Update

**Datum:** 2026-08-18 · **Status:** Angenommen

**Kontext**
Zehn Tester, App in aktiver Entwicklung, 5 h/Woche. Jede Korrektur über den Store-Weg kostet Upload, Wartezeit und Aufmerksamkeit der Tester.

**Entscheidung**
EAS Update wird eingerichtet. Änderungen am JavaScript-Code erreichen die Geräte beim nächsten App-Start.

**Verworfene Alternative**
Ausschließlich Store-Updates. Verworfen wegen der Reibung bei kleinen Korrekturen. Zugleich ist OTA einer der Hauptgründe für ADR-001.

**Konsequenz**
Ein Tippfehler ist in Minuten korrigiert. **Aber:** Der Start der App erzeugt damit den einzigen Netzwerkverkehr der ganzen App – eine Abfrage an die Expo-Server. Das steht im Widerspruch zum Ideal „kein Netzwerk" und muss in der Datenschutzerklärung genannt werden. Änderungen an nativen Abhängigkeiten oder Berechtigungen erfordern weiterhin ein Store-Update.

---

## ADR-014 – Verteilung über den internen Play-Store-Test statt APK

**Datum:** 2026-08-18 · **Status:** Angenommen

**Kontext**
Zehn nicht-technikaffine Tester müssen die App installieren. Der Play-Console-Zugang besteht bereits.

**Entscheidung**
Interner Test in der Play Console, Einladung per E-Mail-Adresse, Installation über den Play Store.

**Verworfene Alternative**
APK per Link oder Messenger. Verworfen, weil die Installation aus unbekannten Quellen für die Zielgruppe die größte Hürde des gesamten Projekts wäre – Sicherheitswarnungen, Einstellungsänderungen, und Updates müssten jedes Mal neu verschickt werden.

**Konsequenz**
Für die Tester eine normale Store-Installation mit automatischen Updates. Nebeneffekt: Der Store-Prozess wird gelernt, ohne den Druck einer öffentlichen Veröffentlichung.

---

## ADR-015 – Kostenlos, ohne Werbung, ohne In-App-Käufe

**Datum:** 2026-08-18 · **Status:** Angenommen für V1

**Kontext**
Die App ist zunächst ein Lernprojekt für zehn bekannte Nutzer.

**Entscheidung**
V1 ist vollständig kostenlos und enthält keine Werbung und keine Käufe.

**Verworfene Alternativen**
- *Werbung (AdMob)*: würde ein Google-SDK, einen Einwilligungsdialog beim ersten Start, eine erweiterte Datenschutzerklärung und eine Datenerfassungs-Deklaration im Store erfordern. Damit wäre die datensparsame App auf einen Schlag nicht mehr datensparsam – bei zehn Nutzern für praktisch keinen Ertrag.
- *In-App-Käufe*: Store-Abrechnung, AGB, Widerrufsrecht, Kaufwiederherstellung. Unverhältnismäßig für eine App ohne Server.

**Konsequenz**
Keine Einwilligungsdialoge, keine Werbe-ID, keine Datenerfassung. Wichtig für später: Sobald Werbung oder Käufe hinzukommen, greifen die DSA-Händlerpflichten und die Anschrift des Entwicklers wird im Store öffentlich sichtbar.

---

## ADR-016 – Import einer geteilten Liste erzeugt immer eine neue Liste

**Datum:** 2026-08-18 · **Status:** Angenommen

**Kontext**
Beim Import einer geteilten Liste sind drei Verhaltensweisen denkbar: neue Liste anlegen, bestehende überschreiben, oder zusammenführen.

**Entscheidung**
Es wird immer eine neue Liste angelegt, benannt nach Absender und Datum.

**Verworfene Alternativen**
- *Überschreiben*: kann unbemerkt Daten vernichten.
- *Zusammenführen*: erfordert eine Konfliktbehandlung (dieselbe Position mit unterschiedlicher Menge) und damit Entscheidungen, die der Nutzer treffen müsste – genau die Komplexität, die eine kontenlose App vermeiden soll.

**Konsequenz**
Der Import kann nichts kaputtmachen. Preis: Bei wiederholtem Teilen derselben Liste entstehen mehrere ähnliche Listen, die der Nutzer selbst aufräumen muss.

---

## ADR-017 – Der „Laden" ist eine Eigenschaft der Liste

**Datum:** 2026-08-18 · **Status:** Angenommen

**Kontext**
Die Kategorie-Reihenfolge soll dem Aufbau des jeweiligen Marktes folgen. Denkbar wäre eine eigene Verwaltung für Läden, der Listen zugeordnet werden.

**Entscheidung**
Keine Ladenverwaltung. Jede Liste trägt ihren Namen und ihre eigene Kategorie-Reihenfolge.

**Verworfene Alternative**
Eigene `stores`-Tabelle mit Zuordnung. Sauberer, wenn mehrere Listen denselben Laden betreffen – aber es bedeutet einen zusätzlichen Verwaltungsbildschirm und einen zusätzlichen Schritt beim Anlegen einer Liste. Für eine Zielgruppe, die maximale Einfachheit braucht, ein schlechter Tausch.

**Konsequenz**
Eine Liste anzulegen bedeutet: Name eingeben, fertig. Preis: Wer zwei Listen für denselben Laden führt, pflegt die Reihenfolge doppelt. Abgemildert durch „Liste duplizieren".

---

## ADR-018 – Feste Einheitenauswahl statt Freitext

**Datum:** 2026-08-18 · **Status:** Angenommen

**Kontext**
Mengenangaben brauchen Einheiten.

**Entscheidung**
Eine feste Liste als TypeScript-Union: Stück, g, kg, ml, l, Packung, Bund, Dose.

**Verworfene Alternative**
Freitexteingabe. Verworfen, weil daraus binnen Wochen „Pck", „Pkg", „Packung" und „packung" nebeneinander entstehen und damit sowohl die Anzeige als auch jede spätere Auswertung unbrauchbar wird.

**Konsequenz**
Die Auswahl ist immer eindeutig und übersetzbar. Preis: Wer eine ungewöhnliche Einheit braucht, weicht auf das Notizfeld aus.

---

## ADR-019 – Mehrsprachigkeit vorbereitet, aber nur Deutsch ausgeliefert

**Datum:** 2026-08-18 · **Status:** Angenommen

**Kontext**
V1 richtet sich an deutschsprachige Nutzer. Eine spätere Veröffentlichung könnte Englisch erfordern.

**Entscheidung**
Alle sichtbaren Texte liegen von Anfang an in Übersetzungsdateien (i18next). Ausgeliefert wird nur `de`. Produktnamen bleiben einsprachig.

**Verworfene Alternativen**
- *Texte fest im Code*: Nachrüsten würde bedeuten, jede Datei anzufassen.
- *Sofort zweisprachig*: doppelte Pflege ohne Nutzen, und der Produktkatalog müsste zweisprachig geführt werden – deutlich aufwendiger als reine Oberflächentexte.

**Konsequenz**
Kosten praktisch null, spätere Übersetzung ist reine Fleißarbeit an einer Datei.

---

## ADR-020 – Zustand hält nur UI-Zustand, keine Daten

**Datum:** 2026-08-18 · **Status:** Angenommen

**Kontext**
React-Apps neigen dazu, Datenbankinhalte in einen globalen Store zu spiegeln. Damit existieren zwei Wahrheiten, die auseinanderlaufen können.

**Entscheidung**
Zustand (die Bibliothek) speichert ausschließlich UI-Zustand: aktive Liste, „erledigte anzeigen", Suchtext. Daten werden über Live-Abfragen aus SQLite gelesen.

**Verworfene Alternativen**
- *Redux Toolkit*: erheblicher Aufwand für eine App ohne Netzwerk und ohne komplexen Zustandsfluss.
- *Datenbankinhalte im Store spiegeln*: erzeugt Synchronisationsfehler innerhalb der eigenen App – ausgerechnet in einer App, die Synchronisation bewusst vermeidet.

**Konsequenz**
Die Datenbank ist die einzige Wahrheit. Nach jedem Schreibvorgang aktualisiert sich die Oberfläche von selbst.

---

## ADR-021 – Vorlagen und Häufigkeits-Vorschläge in V1, aber als letzte Meilensteine

**Datum:** 2026-08-18 · **Status:** Angenommen

**Kontext**
Beide Funktionen waren zunächst als V2 eingeordnet und wurden auf Wunsch in V1 zurückgeholt. Der V1-Umfang ist für 5 h/Woche bereits ambitioniert.

**Entscheidung**
Beide sind Teil von V1, werden aber als die letzten beiden Meilensteine umgesetzt.

**Verworfene Alternativen**
- *Strikt V2*: hätte dem ausdrücklichen Wunsch widersprochen.
- *Früh einplanen*: hätte den Zeitpunkt nach hinten geschoben, ab dem die App im Alltag nutzbar ist.

**Konsequenz**
Geht die Luft aus, ist die App auch ohne diese beiden Funktionen vollständig benutzbar und auslieferbar. Das ist die zentrale Gegenmaßnahme zu Risiko R1.

---

## ADR-022 – Maestro für End-to-End-Tests

**Datum:** 2026-08-18 · **Status:** Angenommen

**Kontext**
Ein automatischer Test soll den Hauptflow auf einem echten Gerät abfahren, weil der Code nicht Zeile für Zeile geprüft wird.

**Entscheidung**
Maestro. Flows werden als YAML beschrieben.

**Verworfene Alternativen**
- *Detox*: mächtiger, aber deutlich aufwendiger einzurichten und empfindlicher gegenüber Versionswechseln.
- *Kein E2E-Test*: nicht vertretbar, weil sonst kein einziger automatischer Test die App im Ganzen startet.

**Konsequenz**
Der Smoke-Flow ist in wenigen Zeilen lesbarem YAML beschrieben – auch ohne Programmierkenntnisse nachvollziehbar. Preis: weniger Kontrolle als bei Detox, ausreichend für einen Smoke-Test.

---

## Offene Entscheidungen (bewusst vertagt)

| Thema | Wann zu entscheiden | Was dann abzuwägen ist |
|---|---|---|
| Live-Sync und Backend | nach V1 | Anbieterwahl, anonyme Identität vs. Konto, Selbsthosting, Kontolöschungspflicht, laufende Kosten |
| iOS-Portierung | wenn Gerät und Budget vorhanden | Cloud-Build-Kosten, Share Extension, App-Store-Review |
| Crash-Reporting (Sentry EU) | bei öffentlicher Veröffentlichung | AVV, Datenschutzerklärung, Einwilligung |
| Homescreen-Widget | V2 | nativer Android-Code, Datenbankzugriff aus dem Widget |
| Barcode-Scan | V2 | Kameraberechtigung, Produktdatenquelle |
| Monetarisierung | nur bei öffentlicher Veröffentlichung | DSA-Händlerdaten werden dann öffentlich |
| Android Auto-Backup | jederzeit | siehe ADR-004 |
| Endgültiger App-Name | vor öffentlicher Veröffentlichung | Auffindbarkeit im Store |
