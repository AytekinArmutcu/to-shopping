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

**Datum:** 2026-08-18 · **Status:** **Abgelöst durch ADR-040** – V1 liefert ohne OTA aus, `expo-updates` ist nicht installiert. Der Eintrag bleibt stehen, weil die Abwägung bei der Wiedervorlage nach vier Wochen wieder gebraucht wird.

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

## ADR-023 – Android-Build-Einstellungen als eigenes Config-Plugin

**Datum:** 2026-08-18 · **Status:** Angenommen

**Kontext**
Der Ordner `android/` ist nicht versioniert und wird bei jedem `expo prebuild` neu erzeugt. Zwei Einstellungen sind dort aber zwingend nötig: eine neuere CMake-Version (das mitgelieferte ninja 1.10.2 bricht bei Pfaden über 260 Zeichen ab, behoben in ninja 1.12, ausgeliefert mit CMake 3.31.6) und die Beschränkung der Prozessorarchitekturen auf `arm64-v8a` und `x86_64` (Bauzeit von 2 h 48 min auf unter 2 Minuten).

**Entscheidung**
Ein eigenes Expo-Config-Plugin unter `plugins/withAndroidBuildConfig.js` setzt beide Werte bei jedem Erzeugen des Projekts.

**Verworfene Alternativen**
- *`expo-build-properties`*: das offizielle Plugin für Build-Einstellungen, bietet aber weder die CMake-Version noch die ABI-Liste an.
- *`android/` versionieren*: würde die Werte festhalten, nimmt aber den Vorteil, das native Projekt jederzeit sauber neu erzeugen zu können, und erzeugt bei jedem SDK-Wechsel Konflikte.
- *Projekt in einen kürzeren Ordner verschieben*: nachgerechnet nicht ausreichend – der Objektdateipfad bliebe bei 299 Zeichen, weil CMake den Quellpfad im Dateinamen nachbildet.
- *CMake 4.x*: dort ist die Kompatibilität zu `cmake_minimum_required < 3.5` entfallen, woran mehrere native React-Native-Abhängigkeiten scheitern.

**Konsequenz**
Ein frisch erzeugtes Projekt baut ohne Handgriffe. Preis: eine selbst gepflegte Datei, die bei einem SDK-Wechsel zu prüfen ist. Vor der Store-Veröffentlichung ist zu entscheiden, ob `armeabi-v7a` für ältere Geräte wieder aufgenommen wird.

---

## ADR-024 – Zwei Theme-Systeme aus einer Farbquelle versorgen

**Datum:** 2026-08-19 · **Status:** Angenommen

**Kontext**
Die App hat zwei unabhängige Theme-Systeme: React Native Paper färbt die Komponenten, der Navigator von Expo Router färbt den Hintergrund der Screens. Wird nur Paper versorgt, entsteht im Dark Mode heller Hintergrund mit heller Schrift – unlesbar. Der Fehler war weder durch Typecheck noch durch Lint noch durch Unit-Tests sichtbar, sondern nur durch die manuelle Abnahme in beiden Modi.

**Entscheidung**
`src/theme/index.ts` erzeugt beide Themes aus derselben Farbdefinition. Das Wurzel-Layout setzt `PaperProvider` und den `ThemeProvider` von **Expo Router**.

**Verworfene Alternativen**
- *`@react-navigation/native` direkt einbinden*: ab Expo SDK 56 ausdrücklich nicht mehr mit Expo Router verträglich – Metro bricht den Build mit einem entsprechenden Hinweis ab. Expo Router liefert eigene, vendorierte Varianten von `ThemeProvider`, `DefaultTheme` und `DarkTheme`.
- *Hintergrundfarbe je Screen von Hand setzen*: müsste in jedem neuen Screen wiederholt werden und wird irgendwann vergessen.

**Konsequenz**
Farben stehen an genau einer Stelle. Neue Screens sind ohne Zutun in beiden Modi korrekt. Bestätigt zugleich die Regel aus `CLAUDE.md`, Material-3-Farbrollen nicht einzeln zu überschreiben.

---

## ADR-025 – E2E-Tests laufen gegen einen Release-Build, nicht gegen den Entwicklungsserver

**Datum:** 2026-08-19 · **Status:** Angenommen

**Kontext**
Ein Entwicklungs-Build laedt sein JavaScript bei jedem Start vom Metro-Server. Auf dem Entwicklungsrechner dauert das gemessen **83 Sekunden** fuer ein 7,8-MB-Bundle. Maestro startet die App zu Beginn jedes Flows neu, wartet dann auf das Bundle und laeuft in Zeitgrenzen. Der Smoke-Test in M0 lief nur deshalb durch, weil Metros Zwischenspeicher zufaellig warm war – nach einem Neustart mit geleertem Cache scheiterte derselbe Test ohne jede Codeaenderung.

**Entscheidung**
E2E-Tests und die manuelle Abnahme laufen gegen einen **Release-Build mit eingebettetem JavaScript** (`npm run android:release`). Der Entwicklungs-Build bleibt fuer die tägliche Arbeit.

**Verworfene Alternativen**
- *Zeitgrenzen hochsetzen*: haette den Test von 25 Sekunden auf mehrere Minuten verlaengert und die Flakiness nur verschoben. Ein Test, dessen Ergebnis vom Zustand eines Zwischenspeichers abhaengt, ist kein Test.
- *`launchApp` ohne Neustart*: setzt voraus, dass die App bereits geladen laeuft. Genau das kann ein automatischer Test nicht garantieren.
- *Debug-Build mit eingebettetem Bundle*: bei React Native nicht ohne Eingriffe in die Gradle-Konfiguration moeglich; der Release-Build kann es ab Werk.

**Konsequenz**
E2E-Laeufe starten in Sekunden und haengen an keinem Serverzustand. Preis: Nach einer Codeaenderung ist vor dem E2E-Lauf ein Build noetig (rund zwei Minuten) – der Release-Build laedt keine Aenderungen nach. Fuer die Auslieferung an Tester ist derselbe Build-Weg ohnehin erforderlich, die Arbeit faellt also nicht zusaetzlich an.

Zur Signierung: Expo signiert Release-Builds mit dem mitgelieferten Debug-Schluessel. Fuer interne Tests genuegt das; vor der Store-Veroeffentlichung ist ein eigener Schluessel noetig (Aufgabe fuer M12).

---

## ADR-026 – Die Detailzeile sitzt unten am Bildschirmrand, nicht als Dialog in der Mitte

**Datum:** 2026-08-26 · **Status:** Angenommen

**Kontext**
Menge, Einheit und Notiz brauchen eine Eingabeflaeche mit zwei Textfeldern. Der naheliegende Weg waere ein Dialog. Der Dialog von React Native Paper haengt aber im Portal – er ist Teil desselben Fensters und weiss nichts von der Tastatur. Auf Android 15 erzwingt das System Edge-to-Edge: Das Fenster wird beim Oeffnen der Tastatur nicht mehr verkleinert. Genau dieser Umstand hat in M3 bereits das Eingabefeld der Liste verdeckt; der Fehler wurde dort mit `useAnimatedKeyboard` behoben und auf dem Geraet geprueft.

**Entscheidung**
Die Detailzeile erscheint an derselben Stelle wie das Eingabefeld: unten, innerhalb des bereits tastaturbewussten Bereichs. Sie ersetzt das Eingabefeld, solange sie offen ist – unten steht nie beides.

**Verworfene Alternativen**
- *Dialog mit eigener Tastaturbehandlung*: haette einen zweiten Mechanismus neben `useAnimatedKeyboard` gebraucht, fuer denselben Zweck an anderer Stelle. Zwei Wege, dasselbe Problem zu loesen, sind einer zu viel.
- *Aufklappende Zeile innerhalb der Liste*: die aufgeklappte Zeile kann hinter der Tastatur liegen, und die Liste muesste sie selbst in den sichtbaren Bereich scrollen. Mehr bewegliche Teile fuer dieselbe Funktion.
- *Eigener Screen fuer den Artikel*: fuer drei Angaben ein Seitenwechsel. Der Weg zurueck kostet mehr als die Aenderung selbst.

**Konsequenz**
Die Detailzeile erbt das gepruefte Tastaturverhalten und liegt in Daumenreichweite – derselbe Grund, aus dem das Eingabefeld unten sitzt. Preis: Waehrend die Detailzeile offen ist, lassen sich keine neuen Artikel eintippen. Das ist ein Moduswechsel, und Moduswechsel sind erklaerungsbeduerftig; hier macht ihn die hervorgehobene Zeile in der Liste sichtbar.

Aus demselben Grund gibt es keinen Abbrechen-Knopf: Jede Aenderung geht sofort in die Datenbank (FR-2.8), "Fertig" schliesst nur. Die Notiz wird deshalb bei jedem Buchstaben gespeichert und nicht erst beim Verlassen des Feldes – die Zeile verschwindet beim Schliessen, ohne dass das Feld je den Fokus abgibt.

---

## ADR-027 – Live-Abfragen kommen als Bauplan aus dem Repository

**Datum:** 2026-08-26 · **Status:** Angenommen

**Kontext**
`CLAUDE.md` verlangt: Screens greifen nie direkt auf die Datenbank zu. `useLiveQuery` von Drizzle braucht aber die Abfrage selbst und kein fertiges Ergebnis – es fuehrt sie bei jeder Datenaenderung erneut aus. Ein `Promise` aus einer Repository-Funktion waere nur eine Momentaufnahme. In M2 und M3 stand die Abfrage deshalb im Screen: Tabellen, Spalten und Bedingungen lagen offen in `ListScreen.tsx`. Mit dem Katalog-Screen waeren es drei weitere Abfragen an einer zweiten Stelle geworden.

**Entscheidung**
Repositories exportieren neben ihren Funktionen auch **Abfrage-Bauplaene** (`listItemsQuery`, `catalogProductsQuery`, `categoriesQuery`). Der Screen uebergibt den Bauplan an `useLiveQuery` und kennt weiterhin keine Tabelle.

**Verworfene Alternativen**
- *So lassen wie in M2/M3*: haette die Regel mit jedem neuen Screen weiter ausgehoehlt. Eine Regel, die an drei Stellen nicht gilt, gilt nicht.
- *Eigener Abo-Mechanismus im Repository* (Callback bei Aenderung): baut nach, was `useLiveQuery` bereits kann, und muesste den Aenderungs-Listener von expo-sqlite selbst verwalten.
- *Daten in einen Zustand-Store spiegeln*: widerspricht ADR-020 – der Store haelt UI-Zustand, keine Daten.

**Konsequenz**
Die Schichtenregel gilt jetzt ohne Ausnahme. Der Preis ist eine Undichtigkeit auf Typebene: Der Rueckgabetyp des Bauplans stammt aus Drizzle, der Screen sieht also die Form der Zeilen. Das ist gewollt – er soll die Daten anzeigen –, aber es heisst auch, dass eine Schemaaenderung im Typecheck bis in den Screen durchschlaegt. Das ist ein Vorteil, kein Nachteil: Sie faellt beim Uebersetzen auf statt im Laden.

---

## ADR-028 – Drag-and-drop ohne neues Paket, mit Pfeilen als gleichwertigem Weg

**Datum:** 2026-08-26 · **Status:** Angenommen

**Kontext**
FR-1.3 nennt ausdruecklich Drag-and-drop fuer die Kategorie-Reihenfolge. Der uebliche Weg dorthin ist ein fertiges Paket wie `react-native-draggable-flatlist`. Zugleich verlangt `CLAUDE.md` zu jeder Geste eine Antipp-Alternative – ein reines Ziehen waere fuer niemanden bedienbar, der nicht ziehen kann – und verbietet neue Abhaengigkeiten ohne Ruecksprache.

**Entscheidung**
Kein neues Paket. Das Ziehen entsteht aus `react-native-gesture-handler` und `react-native-reanimated`, die beide bereits im Projekt sind. Die eigentliche Rechnung – wo landet die Kategorie, wie sieht die Reihenfolge danach aus – steckt in zwei reinen Funktionen (`dropIndex`, `moveCategory`) und ist getestet. Daneben stehen Hoch/Runter-Pfeile, die dieselben Funktionen aufrufen.

**Verworfene Alternativen**
- *Fertiges Drag-Paket*: haette Arbeit gespart, aber die Antipp-Alternative waere trotzdem noetig gewesen – also zwei Wege, von denen nur einer im eigenen Code liegt. Dazu kommt das Kompatibilitaetsrisiko: Solche Pakete hinken neuen React-Native- und Reanimated-Versionen regelmaessig hinterher, und dieses Projekt laeuft auf React Native 0.86 mit Reanimated 4.
- *Nur Pfeile, kein Ziehen*: haette FR-1.3 nicht erfuellt und zwoelf Kategorien umzusortieren zu einer Klickorgie gemacht.
- *Nur Ziehen*: schliesst Nutzer aus und verstoesst gegen die Barrierefreiheitsregel in `CLAUDE.md`.

**Konsequenz**
Die Reihenfolge laesst sich auf zwei Wegen aendern, und der verlaessliche davon – die Pfeile – ist der, den auch der automatische Test benutzt. Die Geste beginnt nach kurzem Halten (200 ms): Das trennt sie sauber vom Scrollen, ohne beide Gesten ueber Referenzen verdrahten zu muessen.

Preis: Beim Ziehen wird nicht automatisch gescrollt. Wer eine Kategorie ueber den sichtbaren Bereich hinaus verschieben will, zieht in zwei Etappen oder nimmt die Pfeile. Fuer zwoelf feste Kategorien ist das vertretbar; kaemen frei anlegbare Kategorien dazu, waere es neu zu bewerten.

---

## ADR-029 – Abgehakte Artikel bekommen einen eigenen Abschnitt statt zurueck in ihre Kategorie

**Datum:** 2026-08-26 · **Status:** Angenommen

**Kontext**
Seit M5 ist die Liste nach Kategorien gegliedert. Der Schalter „erledigte anzeigen" aus M3 blendet abgehakte Artikel wieder ein – offen blieb, wo sie dann erscheinen. `architecture.md` 4.1 sagt dazu nichts.

**Entscheidung**
Abgehaktes sammelt sich in einem eigenen Abschnitt „Erledigt" am Ende der Liste.

**Verworfene Alternative**
*Zurueck in die eigene Kategorie, durchgestrichen.* Naeher an der Datenlage, aber schlechter im Laden: Wer nachsehen will, was schon im Wagen liegt, muesste dafuer durch zwoelf Abschnitte scrollen. Ausserdem mischt sich Durchgestrichenes dann unter das, was noch zu holen ist – genau die Trennung, auf die es zwischen den Regalen ankommt.

**Konsequenz**
Die offenen Abschnitte bleiben frei von Erledigtem. Preis: Ein abgehakter Artikel verliert beim Einblenden seine Kategorie-Zuordnung aus dem Blick. Das faellt nicht ins Gewicht, weil der Abschnitt nur zum Nachsehen da ist – gekauft wird nach den offenen Abschnitten.

---

## ADR-030 – Flache Routen mit der Listen-ID als Parameter

**Datum:** 2026-08-26 · **Status:** Angenommen

**Kontext**
`architecture.md` Abschnitt 7 sah verschachtelte Routen vor: `app/lists/[id].tsx`, darunter `[id]/settings.tsx` und `[id]/catalog.tsx`. Mit M6 gibt es erstmals mehrere Listen, die Routen mussten also ohnehin angefasst werden.

**Entscheidung**
Die Routen bleiben flach und tragen die Listen-ID als Parameter: `/listen`, `/liste?listId=…`, `/katalog?listId=…`, `/ladenlayout?listId=…`. `architecture.md` Abschnitt 7 wurde entsprechend nachgezogen.

**Verworfene Alternative**
*Die geplante Verschachtelung.* Sie ist ausdrucksstaerker – die Zugehoerigkeit steht im Pfad statt in einem Parameter – und waere bei vielen Unterseiten die bessere Wahl. Dagegen sprach der Zeitpunkt: Fuer eine Verschachtelung muss eine Datei `[id].tsx` neben einem gleichnamigen Ordner `[id]/` liegen, und beides zusammen wollte geprueft sein. Das Handy war waehrend dieser Arbeit nicht erreichbar, ein Geraetetest also nicht moeglich. Die flache Form ist in diesem Projekt seit M4 im Einsatz und funktioniert nachweislich.

**Konsequenz**
Eine Route hat genau eine Datei, und die Listen-ID wird ueberall gleich uebergeben. Preis: Die Zugehoerigkeit ist nicht am Pfad ablesbar, und ein fehlender Parameter ist ein Fall, den jede Route selbst abfangen muss – `/liste` und `/katalog` leiten dann zur Uebersicht weiter beziehungsweise zeigen nichts an.

Zwei Ausdrucksformen derselben Route sind der zweite Preis: Der Router bekommt sie getippt als Objekt, das Gedaechtnis fuer den Startbildschirm als Zeichenkette (`listRoute`). Das ist Absicht – so bleibt die Routenpruefung durch TypeScript erhalten, ohne dass die reine Logik den Router kennen muss.

---

## ADR-031 – Mitgelieferte Produkte sind veraenderbar; die Sicherung heisst „Zuruecksetzen"

**Datum:** 2026-08-26 · **Status:** Angenommen

**Kontext**
Die App liefert 200 Produkte mit. FR-4.2 verlangt, dass Produkte angelegt, umbenannt, umsortiert und geloescht werden koennen – „auch mitgelieferte". Damit stellt sich die Frage, was passiert, wenn jemand den Startkatalog zerlegt.

**Entscheidung**
Mitgelieferte Produkte sind genauso veraenderbar wie eigene. Der Schutz dagegen ist kein Verbot, sondern „Katalog zuruecksetzen" (FR-4.4): Mitgeliefertes kehrt in den Auslieferungszustand zurueck, Geloeschtes kommt wieder, **eigene Produkte bleiben unangetastet**.

**Verworfene Alternativen**
- *Mitgelieferte Produkte sperren.* Waere nach zwei Wochen im Weg: Wer nie Quark kauft, aber immer Skyr, soll das aendern duerfen. Ein Katalog, der sich nicht an den Nutzer anpasst, wird zum Ballast – und die App wirbt gerade damit, sich zu merken, was **dieser** Nutzer kauft.
- *Zuruecksetzen loescht alles und saet neu.* Einfacher zu bauen, aber es wuerde die Arbeit des Nutzers vernichten. „Zuruecksetzen" bezieht sich auf das, was die App mitgebracht hat, nicht auf das, was der Nutzer angelegt hat.
- *Kein Zuruecksetzen anbieten.* Dann waere jede Loeschung endgueltig, und die Freiheit aus dem ersten Punkt waere eine Falle.

**Konsequenz**
Das Kennzeichen `is_builtin` bleibt auch nach einer Umbenennung erhalten – nur dadurch findet das Zuruecksetzen das Produkt spaeter wieder. Der Preis ist ein Sonderfall: Traegt ein **eigenes** Produkt inzwischen den Namen eines mitgelieferten, laesst sich dieses eine nicht wiederherstellen, weil Namen eindeutig sein muessen. Es wird uebersprungen und gezaehlt, statt das ganze Zuruecksetzen scheitern zu lassen; die Meldung nennt die Zahl. Welche Zeilen betroffen sind, entscheidet die reine Funktion `planCatalogReset` – damit ist der Sonderfall testbar, ohne dass ein Katalog dafuer zerlegt werden muss.

---

## ADR-032 – Teilen verschickt Datei und Text; der Import legt immer eine neue Liste an

**Datum:** 2026-08-26 · **Status:** Angenommen

**Kontext**
Teilen war das urspruengliche Kernanliegen des Auftraggebers: „Die Idee, dass mehrere Leute einkaufen gehen, also es teilen kann, finde ich auch cool." Ohne Backend (ADR-001) geht das nur ueber Dateien im Android-Teilen-Menue. Dabei stellen sich drei Fragen: Was wird verschickt? Was passiert beim Empfaenger? Und wie kommt die Datei ueberhaupt in die App?

**Entscheidungen**

1. **Datei *und* lesbarer Text zusammen.** Die `.tsl`-Datei kann nur die App lesen; der Text ist fuer alle anderen. Wer eine Einkaufsliste per WhatsApp schickt, weiss meist nicht, ob der Empfaenger die App hat – und muss es auch nicht wissen.
2. **Nur offene Artikel wandern mit.** Was abgehakt ist, liegt bereits im Wagen. Eine Kopie inklusive erledigter Posten waere fuer den Empfaenger irrefuehrend.
3. **Der Import legt immer eine neue Liste an**, nie ergaenzt er eine bestehende.
4. **Zwei Wege herein:** Antippen der Datei in der Nachricht (Intent-Filter) **und** ein Dateiauswaehler in der App.

**Verworfene Alternativen**
- *Nur die Datei verschicken.* Fuer Empfaenger ohne App wertlos – und das duerfte der haeufigere Fall sein.
- *In eine bestehende Liste importieren, wahlweise.* Die gefaehrlichere Voreinstellung: Der Empfaenger koennte seine eigenen Artikel nicht mehr von den fremden trennen, und ein versehentlicher Import liesse sich nicht rueckgaengig machen, ohne die eigene Arbeit mitzureissen. Eine ueberfluessige Liste ist dagegen mit zwei Tipps geloescht.
- *Nur den Intent-Filter, ohne Dateiauswaehler.* Ob eine fremde App unsere Datei an uns weiterreicht, haengt daran, welchen Dateityp sie ihr zuschreibt. Eine unbekannte Endung wie `.tsl` reichen viele Messenger als `application/octet-stream` durch – und darauf zu horchen hiesse, sich fuer **jede** unbekannte Datei auf dem Geraet anzubieten. Das waere aufdringlich und fuer die Zielgruppe verwirrend.
- *Die Endung auf `.json` aendern*, damit der Typ stimmt. Haette das Weiterreichen erleichtert, aber die Datei sieht dann wie irgendeine JSON-Datei aus, und die App wuerde sich fuer alle davon zustaendig fuehlen.

**Konsequenz**
Der Intent-Filter horcht auf `application/json` – das trifft den Fall, in dem der Messenger den Typ richtig erkennt, ohne sich fuer beliebige Dateien anzubieten. Wo das nicht klappt, fuehrt der Dateiauswaehler zuverlaessig zum Ziel; er haengt an nichts ausser der App selbst.

Der Import ist misstrauisch gegenueber allem, was von aussen kommt: Kaputte Eintraege werden uebersprungen und **gezaehlt**, statt die Datei ganz abzulehnen. Eine Liste mit neun von zehn Artikeln ist mehr wert als gar keine – solange der Empfaenger die Zahl sieht.

Der Hinweis „Teilen erzeugt eine Kopie" (FR-6.7) steht **vor** dem ersten Teilen und nicht danach: Wer erst hinterher erfaehrt, dass Aenderungen nicht zurueckfliessen, hat die falsche Erwartung bereits verschickt.

---

## ADR-033 – Der Fehlerspeicher liegt in einer Datei, nicht in der Datenbank

**Datum:** 2026-08-26 · **Status:** Angenommen

**Kontext**
FR-8.1 verlangt einen lokalen Fehlerspeicher mit den letzten 20 Eintraegen. Die App hat bereits eine Datenbank und darin sogar eine Schluessel-Wert-Ablage (`app_state`) fuer genau solche Kleinigkeiten. Es liegt nahe, den Fehlerspeicher dort abzulegen.

**Entscheidung**
Der Fehlerspeicher ist eine **Datei** im Dokumentenordner (`fehler.json`), wie in `architecture.md` 9 vorgesehen.

**Begruendung**
Ein Fehlerspeicher darf nicht von dem abhaengen, was gerade kaputt sein koennte. Waere er eine Tabelle, wuerde ausgerechnet ein Datenbankfehler nicht aufgezeichnet – also genau der Fall, den man am dringendsten sehen will. Dasselbe gilt fuer einen Fehler beim Oeffnen der Datenbank: Dann gibt es noch gar keinen Ort zum Schreiben.

**Verworfene Alternativen**
- *`app_state`-Tabelle.* Naheliegend, aber sie teilt das Schicksal der Datenbank.
- *Zwischenspeicher statt Dokumentenordner.* Android raeumt den Zwischenspeicher weg, wenn der Platz knapp wird – der Bericht waere verschwunden, bevor jemand ihn ansieht.
- *Fehlerdienst eines Drittanbieters (Sentry o. Ae.).* Ausgeschlossen durch die Nicht-Ziele des PRD und die Datenschutzzusage: keine Uebertragung an Dritte in V1 (ADR-002, ADR-011).

**Konsequenz**
Der Fehlerspeicher ueberlebt einen kaputten Datenbestand und liegt ausserhalb der Vollsicherung – er beschreibt dieses Geraet, nicht die Daten des Nutzers.

**Grenze, die man kennen muss:** Die Error Boundary faengt nur Fehler in React ab. Der Absturz, der in M5 die App umgebracht hat, entstand beim Einhaengen der Views durch React Native selbst; davon erfaehrt JavaScript nichts mehr, und kein Eintrag landet im Speicher. Der Fehlerspeicher ist ein Netz fuer den eigenen Code, kein Schutz gegen alles – und deshalb bleibt der E2E-Lauf auf einem echten Geraet die wichtigere Absicherung.

---

## ADR-034 – Die Wiederherstellung ersetzt den Bestand und wird nie automatisch ausgeloest

**Datum:** 2026-08-26 · **Status:** Angenommen

**Kontext**
Die Vollsicherung enthaelt echte IDs (`architecture.md` 5.2). Beim Zurueckspielen stellt sich die Frage: ergaenzen oder ersetzen?

**Entscheidung**
Ersetzen – vollstaendig, in einer Transaktion, nach ausdruecklicher Warnung mit Nennung von Zeilenzahl und Datum der Sicherung.

**Verworfene Alternative**
*Ergaenzen.* Technisch unmoeglich ohne Umschreiben aller IDs: Dieselbe Liste zweimal mit derselben Kennung gibt es nicht. Wuerde man die IDs neu vergeben, waere das Ergebnis eine Mischung aus altem und gesichertem Bestand, in der niemand mehr unterscheiden kann, was woher stammt – und ein Rueckweg existiert dann erst recht nicht.

**Konsequenz**
Das Zurueckspielen ist der **einzige** Vorgang in dieser App, der Daten des Nutzers unwiederbringlich loescht. Entsprechend steht die Warnung vor dem Knopf und nicht daneben, und die Rueckfrage nennt konkrete Zahlen statt einer allgemeinen Formel.

Nach dem Zurueckspielen geht es zwangsweise zur Listenuebersicht: Die Liste, auf der der Nutzer vorher war, gibt es womoeglich nicht mehr.

Ausserdem: Der Zeitpunkt der letzten Sicherung wird gesetzt, sobald die Datei im Teilen-Menue liegt – nicht erst, wenn sie irgendwo angekommen ist. Android verraet nicht, ob der Nutzer sie tatsaechlich abgelegt hat. Die Erinnerung nach vierzehn Tagen kann also im schlimmsten Fall schweigen, obwohl nichts gesichert wurde. Der Gegenentwurf – jedes Mal nachzufragen, ob es geklappt hat – waere eine Frage, die niemand beantworten kann und die beim dritten Mal weggetippt wird.

---

## ADR-035 – Eine einzige Quelle fuer die Tastaturhoehe

**Datum:** 2026-08-26 · **Status:** Angenommen · **Ersetzt einen Teil von ADR-026**

**Kontext**
Seit M3 holten die Screens die Tastaturhoehe aus Reanimateds `useAnimatedKeyboard`, seit M6 die Dialoge aus einem eigenen Haken auf Basis der `Keyboard`-Ereignisse von React Native. Zwei Wege fuer dieselbe Frage – mit der Begruendung, dass der Dialog von Paper kein animiertes Style entgegennimmt.

Beim ersten Lauf auf einem **zweiten** Android-Geraet (Emulator, Android 15, 1080 × 2400) verschwand das Eingabefeld, sobald die Tastatur aufging. Die Messung: Fenster in voller Hoehe, Tastatur 883 px – also rund 336 dp. Der aufgetragene Abstand war aber so gross, dass die Leiste unter den Bildschirmrand rutschte. Der Wert kam als **Pixel** an und wurde als **dp** verwendet.

**Entscheidung**
`src/lib/useKeyboardHeight.ts` ist die einzige Stelle, an der die Tastaturhoehe herkommt. `endCoordinates.height` aus dem `keyboardDidShow`-Ereignis ist von React Native als dp dokumentiert und verhaelt sich ueber Android-Fassungen hinweg gleich.

**Verworfene Alternativen**
- *Beim Reanimated-Weg bleiben und die Dichte selbst herausrechnen.* Man muesste raten, wann umgerechnet werden muss und wann nicht – und jedes neue Geraet waere wieder ein Ratespiel.
- *Ein fertiges Paket* (`react-native-keyboard-controller`). Loest das Problem, kostet aber eine Abhaengigkeit fuer etwas, das zwanzig Zeilen sind.

**Konsequenz**
Der weiche Uebergang bleibt, er entsteht jetzt aus `withTiming` statt aus dem Tastatur-Inset selbst – minimal spaeter, dafuer auf jedem Geraet an der richtigen Stelle. Der eigentliche Gewinn ist die Regel: **eine Frage, eine Quelle.** Zwei Wege zur selben Antwort heisst, dass einer davon unbemerkt falsch sein kann – genau das ist hier vier Meilensteine lang passiert.

Und die Lehre zum Vorgehen: Der Fehler war auf dem Samsung Galaxy S24 nicht zu sehen. Ein zweites Geraet – und sei es ein Emulator – findet eine Klasse von Fehlern, die ein einzelnes Testgeraet strukturell verbirgt.

---

## ADR-036 – „Zurueck" ist ein benanntes Ziel, kein Schritt zurueck

**Datum:** 2026-08-26 · **Status:** Angenommen

**Kontext**
Der Zurueck-Pfeil im Listen-Screen fuehrte `router.back()` aus, mit `router.replace('/listen')` als Ausweichweg, falls es nichts gibt, wohin man zurueckkann. Im E2E-Lauf tat der Knopf sporadisch **gar nichts**.

Der Grund: Startet die App direkt auf einer Liste, liegt darunter die Einstiegsroute `/`. Die zeigt nichts an, sondern leitet auf die zuletzt genutzte Liste weiter (FR-1.5). Ein Schritt zurueck landet also auf `/` – und `/` schickt einen sofort dorthin zurueck, wo man herkam. Dasselbe gilt fuer die **System-Zurueck-Taste**.

**Entscheidung**
Der Zurueck-Pfeil fuehrt zur Uebersicht als benanntem Ziel, statt einen Schritt im Verlauf zurueckzugehen. Seit dem 2026-10-27 geschieht das in allen Screens mit benanntem Ziel ueber `goTo(href)` aus `src/lib/navigation.ts`, das `router.dismissTo(href)` aufruft: Liegt das Ziel im Verlauf, geht es bis dorthin zurueck und schliesst alles darueber; liegt es nicht darin, ersetzt es den aktuellen Screen. Bis dahin stand hier `router.navigate('/listen')` – warum das falsch war, steht in der Korrektur unten.

**Konsequenz**
Der Knopf tut immer dasselbe, unabhaengig davon, wie der Nutzer auf die Liste gekommen ist. Allgemeiner: Eine Route, die nur weiterleitet, darf kein Ziel im Verlauf sein – wer dorthin zurueckkehrt, dreht sich im Kreis.

**Korrektur vom 2026-10-27: `navigate` ging nie zurueck**
Die urspruengliche Entscheidung nahm an, `router.navigate` springe zu einer schon vorhandenen Uebersicht zurueck und lege nur sonst eine an. In expo-router 57 (React Navigation 7) stimmt das nicht. Der Stack-Router (`node_modules/expo-router/build/layouts/StackClient.js`, Fall `NAVIGATE`) nimmt einen vorhandenen Screen nur, wenn er **ganz oben** liegt. Liegt das Ziel weiter unten, legt `navigate` einen neuen Screen obendrauf; zurueck ginge es nur mit der Option `pop`, die `router.navigate` nicht durchreicht. Verglichen wird dabei nur der Routenname – Parameter wie `/rezept?recipeId=…` spielen keine Rolle.

Auf dem Emulator nachgewiesen, mit voruebergehenden Protokollausgaben beim Mounten und Unmounten: Nach viermal „Pfannkuchen oeffnen, Zurueck" lag der Stapel bei `liste > listen > rezepte > rezept > rezepte > … > rezepte` – fuenf Rezeptuebersichten und vier Rezeptscreens, keiner je unmountet. Jeder hielt seine Live-Abfragen (ADR-027), und expo-sqlite meldet jede geaenderte Zeile einzeln. „Rezepte zuruecksetzen" erzeugt 979 Meldungen (35 Gerichte, 636 Zutaten, 308 Schritte), und jede loeste die passenden Abfragen in allen neun Screens aus statt in einem. Bis zur Snackbar vergingen 22 s statt rund 4 s. Derselbe Aufruf steckte im Listen-Screen und im Vorrat; nach demselben Router-Code liess dort jede Runde ebenso einen Screen liegen.

`dismissTo` erfuellt beide Anforderungen: Das Ziel ist benannt (nie `/`), und der Verlauf waechst nicht. Nachher, gleicher Ablauf: ein Rezeptscreen, der beim Zurueck unmountet, eine einzige Rezeptuebersicht, und der Reset dauert 3,4–4,1 s – nach vier Runden so lange wie nach einem frischen Start.

*Verworfen:* `router.back()` mit `canGoBack()` – das ist der Schritt zurueck, den diese Entscheidung ausschliesst. `router.replace` – ersetzt nur den obersten Screen und laesst alles darunter liegen. `dismissAll` – geht zum ersten Screen des Stapels, und das muss nicht die Uebersicht sein.

*Was es kostet:* Startet die App auf einer Liste, liegt darunter keine Uebersicht; `goTo('/listen')` ersetzt dann die Liste, statt die Uebersicht darueberzulegen. Von der Uebersicht aus verlaesst die System-Zurueck-Taste danach die App, statt zur Startliste zurueckzufuehren.

*Was bleibt:* Screens, die nur per `push` erreichbar sind (Katalog, Produkte, Ladenlayout, Vorlagen, Sicherung, Diagnose), gehen weiter mit `router.back()` zurueck: Dort fuehrt ein Schritt zurueck immer zum Aufrufer, und `back` stapelt nichts. Der Test `src/lib/navigation.test.tsx` faehrt den echten Router und haelt fest, dass `navigate` stapelt und `goTo` nicht – aendert ein Update von expo-router dieses Verhalten, schlaegt er fehl.

---

## ADR-037 – Bei leerer Eingabe erscheint nur, was schon einmal gekauft wurde

**Datum:** 2026-08-26 · **Status:** Angenommen

**Kontext**
T-10.4 verlangt Vorschlaege auch bei leerem Eingabefeld – „die ueblichen Verdaechtigen". Naheliegend waere: bei leerer Eingabe den ganzen Katalog ranken und die besten acht zeigen.

**Entscheidung**
Bei leerer Eingabe erscheinen **nur Produkte mit Kaufhistorie**. Gibt es keine, bleibt das Feld ohne Vorschlagsliste. Ausserdem erscheint die Liste nur, solange das Eingabefeld den Fokus hat.

**Verworfene Alternative**
*Den ganzen Katalog ranken.* Ohne Historie haben alle 200 Produkte denselben Wert, und die Sortierung faellt auf das Alphabet zurueck. Ein neuer Nutzer bekaeme beim Antippen des Feldes „Ananas, Apfelmus, Äpfel …" vorgesetzt – acht zufaellige Produkte, die die halbe Liste verdecken. Wer noch nichts gekauft hat, hat keine ueblichen Verdaechtigen; nichts anzuzeigen ist dann die ehrlichste Antwort.

**Konsequenz**
Die Funktion waechst mit der Nutzung: In der ersten Woche unsichtbar, nach einem Monat der schnellste Weg auf die Liste. Das passt zum Meilenstein – die Wirkung ist ohnehin erst nach Wochen beurteilbar, deshalb liegt M10 spaet.

**Nebenentscheidung: ein fester Zeitpunkt je Sitzung.** Das Ranking braucht ein „jetzt", um die Aktualitaet zu bewerten. `Date.now()` waehrend des Renderns waere unrein – und faktisch falsch: Jeder Tastendruck bekaeme eine minimal andere Bewertung, und an einer Gleichstandsgrenze wuerde die Vorschlagsliste springen, ohne dass sich etwas geaendert hat. Der Zeitpunkt wird deshalb einmal beim Laden bestimmt (`SESSION_START`). Dass er waehrend einer Sitzung altert, ist ohne Bedeutung: Die Halbwertszeit betraegt 30 Tage, eine Sitzung ein paar Minuten.

---

## ADR-038 – Eine Vorlage ueberspringt, was schon draufsteht, statt Mengen zu addieren

**Datum:** 2026-08-26 · **Status:** Angenommen

**Kontext**
`architecture.md` 4.4 legt fest, **wann** ein Vorlagen-Artikel uebersprungen wird: wenn auf der Zielliste bereits ein nicht abgehakter Artikel mit derselben Produkt-ID oder demselben Namen steht. Offen blieb, **was** stattdessen passiert – und was mit der Menge geschieht.

**Entscheidung**
Der Artikel wird uebersprungen. Die Menge auf der Liste bleibt, wie sie ist; nichts wird addiert und nichts ueberschrieben. Die Rueckmeldung nennt beide Zahlen: „1 hinzugefuegt, 1 standen schon drauf".

**Verworfene Alternativen**
- *Mengen addieren.* „2 l Milch auf der Liste, 1 l in der Vorlage, macht 3 l" ist eine Rechnung, die niemand im Kopf mitfuehrt – und sie ist bei mehrfachem Anwenden derselben Vorlage still fatal.
- *Die Menge der Vorlage uebernehmen.* Wuerde eine Aenderung ueberschreiben, die der Nutzer gerade von Hand gemacht hat.
- *Nachfragen, was gelten soll.* Bei sieben Artikeln sieben Rueckfragen. Fuer eine Zielgruppe, die maximale Einfachheit braucht, das Gegenteil von hilfreich.

**Konsequenz**
„Steht schon da, bleibt wie es ist" ist die Regel, die man im Laden im Kopf hat. Preis: Wer die Menge aus der Vorlage haben will, muss sie von Hand anpassen – ein seltener Fall gegenueber dem haeufigen, in dem eine Vorlage die Liste ergaenzen soll.

Zwei Feinheiten, die aus dem Kopf nicht folgen und deshalb im Test stehen: **Abgehaktes zaehlt nicht** – wer den Einkauf beendet hat, bekommt den Artikel wieder. Und die Vorlage prueft sich **auch gegen sich selbst**: Enthaelt sie denselben Artikel zweimal, landet er einmal auf der Liste.

Der Namensvergleich als zweiter Weg neben der Produkt-ID ist kein Luxus: Wird ein Produkt aus dem Katalog geloescht, bleibt der Listeneintrag als Text stehen (ADR-007) und haette keine Produkt-ID mehr. Ohne den Namensvergleich stuende er nach dem Anwenden doppelt da.

---

## ADR-039 – Die gemeldete Tastaturhoehe wird nachgerechnet, nicht geglaubt

**Datum:** 2026-08-26 · **Status:** Angenommen · **Ergaenzt ADR-035**

**Kontext**
Seit ADR-035 kommt die Tastaturhoehe aus dem `keyboardDidShow`-Ereignis von React Native. Dort ist sie als **dp** dokumentiert. Auf dem Emulator kam sie mehrfach in **Pixeln** an: 883 statt 336 bei einer Pixeldichte von 2,625. Als Abstand aufgetragen schob dieser Wert die Eingabeleiste unter den unteren Bildschirmrand – das Eingabefeld war weg, sobald die Tastatur aufging. Die App war damit in ihrer Hauptfunktion unbedienbar.

**Entscheidung**
Der gemeldete Wert wird nicht ungeprueft uebernommen. `keyboardHeightInDp` rechnet nach: Ein Wert, der mehr als 60 Prozent der Fensterhoehe beansprucht, kann keine dp-Angabe sein – dann sind es Pixel, und die Pixeldichte macht daraus wieder dp. Anschliessend wird auf dieselben 60 Prozent begrenzt.

**Verworfene Alternativen**
- *Dem Wert glauben.* Die Dokumentation sagt dp, das Geraet sagt manchmal etwas anderes. Wer sich hier auf die Dokumentation verlaesst, liefert eine App aus, die auf unbekannten Geraeten kein Eingabefeld zeigt.
- *Immer durch die Pixeldichte teilen.* Waere auf Geraeten, die korrekt dp liefern, um den Faktor der Dichte zu klein.
- *Ein fertiges Paket* (`react-native-keyboard-controller`). Loest das Problem, kostet aber eine Abhaengigkeit fuer zwanzig Zeilen.

**Konsequenz**
Zwei Absicherungen statt einer: Die Umrechnung trifft den bekannten Fall, die Begrenzung faengt jeden unbekannten. Im schlimmsten Fall sitzt die Leiste etwas zu hoch – sie verschwindet nie.

60 Prozent gelten nur, weil die App auf Hochformat festgelegt ist. Kaeme Querformat dazu, waere der Wert neu zu bestimmen.

**Was damit nicht behoben ist:** Auf dem Emulator feuert `keyboardDidShow` gelegentlich verzoegert. Bis dahin liegt die Leiste hinter der Tastatur. Auf dem Samsung Galaxy S24 trat das nie auf; die E2E-Flows warten deshalb an den betroffenen Stellen laenger, statt den Fehler zu verdecken. Sollte ein Tester das auf seinem Geraet sehen, ist das der Punkt, an dem weiterzusuchen ist.

---

## ADR-040 – V1 wird ohne OTA-Updates ausgeliefert

**Datum:** 2026-08-26 · **Status:** Angenommen · **Verschiebt FR-8.4**

**Kontext**
FR-8.4 sieht OTA-Updates vor, und der Auftraggeber hatte dem in der Erhebung zugestimmt. Umgesetzt wird das mit `expo-updates`: Die App fragt beim Start bei einem Dienst von Expo (USA) nach einer neuen Fassung ihres Programmcodes und uebertraegt dabei App-Version, Android-Version und – technisch unvermeidbar – die IP-Adresse. Listeninhalte nicht.

Vor dem Hinzufuegen des Pakets wurde die Frage noch einmal gestellt, weil sie den Ausgangspunkt des ganzen Projekts beruehrt: „Ich moechte nicht meine Daten an einem Unternehmen geben."

**Entscheidung**
V1 geht **ohne** OTA in den internen Test. `expo-updates` wird nicht hinzugefuegt.

**Begruendung**
OTA waere die **einzige** Stelle in V1 gewesen, an der die App von sich aus mit einem Server spricht. Ohne sie stimmt die Datenschutzerklaerung ohne jede Einschraenkung, das Data-Safety-Formular ist durchgehend mit „nein" zu beantworten (Aufgabe C-4 schrumpft von 45 auf 15 Minuten), und es gibt keinen Drittlandbezug.

Dem steht ein Nutzen gegenueber, der bei **zehn Testern aus Freundes- und Familienkreis** kaum ins Gewicht faellt: Der interne Play-Store-Test verteilt Aktualisierungen ohnehin innerhalb von Minuten bis Stunden. OTAs eigentlicher Vorteil – die Store-Pruefung zu umgehen – zaehlt erst bei vielen Nutzern und haeufigen Korrekturen.

**Verworfene Alternative**
*Wie geplant einrichten.* Waere vertretbar gewesen und ist ausdruecklich nicht falsch. Der Ausschlag gab, dass der Preis (eine Verbindung in die USA bei jedem Start, ein zusaetzlicher Abschnitt in der Datenschutzerklaerung, eine offene Compliance-Frage) fuer diese Nutzerzahl in keinem Verhaeltnis zum Gewinn steht.

**Konsequenz**
Aktualisierungen laufen ueber den internen Play-Store-Test. Ein Fehler, der einem Tester begegnet, braucht also einen neuen Build und einen neuen Upload.

Wiedervorlage nach den vier Wochen echter Nutzung: Zeigt sich, dass haeufig nachgebessert werden muss und der Store-Weg dabei stoert, ist die Abwaegung neu zu treffen – dann mit dem Wissen aus dem Alltag statt mit einer Vermutung.

Der Internetzugang bleibt im Manifest, weil eine Programmbibliothek ihn eintraegt. Ihn zu sperren wuerde die Entwicklungs-Builds unbrauchbar machen, die ihren Code vom Metro-Server laden. Die Datenschutzerklaerung nennt das ausdruecklich: Der Zugang steht im Manifest und wird nicht benutzt.

---

## ADR-041 – Das Store-Bundle enthält drei Architekturen, lokale Builds zwei

**Datum:** 2026-09-08 · **Status:** Angenommen · **Löst die offene Frage aus ADR-023**

**Kontext**
ADR-023 beschränkte den Build auf `arm64-v8a` und `x86_64` und senkte die Bauzeit damit von 2 h 48 min auf Minuten. Der Preis: `armeabi-v7a` fehlt, also alle 32-Bit-ARM-Geräte. ADR-023 hielt fest, dass vor der Store-Veröffentlichung neu zu entscheiden ist – jetzt ist der Zeitpunkt.

Die Frage stellt sich beim App Bundle anders als beim APK. Ein APK mit drei Architekturen ist für **jeden** Nutzer dreimal so groß. Ein Bundle nicht: Google zerlegt es und liefert jedem Gerät nur den Teil, der zu seinem Prozessor passt.

**Entscheidung**
Das Store-Bundle wird mit **allen drei** Architekturen gebaut, über ein eigenes Skript:

```
npm run bundle:android
```

`android/gradle.properties` bleibt unverändert bei zwei Architekturen. Der volle Satz wird nur an dieses eine Kommando übergeben (`-PreactNativeArchitectures=...`).

**Begründung**
Die einzigen Kosten sind Bauzeit, und die fällt selten an – ein Store-Upload alle paar Wochen, kein Vorgang im Minutentakt. Die tägliche Arbeit, `npm run android:release` und die zwölf E2E-Flows bleiben unangetastet schnell, weil sie weiter aus `gradle.properties` lesen.

Was gewonnen wird, ist kein technischer Vorteil, sondern das Vermeiden eines stillen Fehlers: Ohne `armeabi-v7a` sähe ein Tester mit einem älteren Telefon die App im Play Store **gar nicht erst** – und bekäme keine Fehlermeldung, sondern eine leere Suche. Das ist genau die Sorte Problem, die man im internen Test nicht findet, weil niemand meldet, was er nicht sieht.

**Verworfene Alternativen**
*`gradle.properties` dauerhaft auf drei Architekturen.* Ehrlicher, weil dann jeder Build dem Store-Build gleicht. Verworfen, weil es jeden E2E-Lauf verlangsamt – und die Läufe sind das, was die Qualität hält.

*Bei zwei bleiben.* Vertretbar: 64-Bit-ARM ist bei Telefonen ab etwa 2019 durchgängig. Verworfen, weil die Ersparnis nur die Bauzeit betrifft und der Verlust einen echten Nutzer treffen kann.

**Konsequenz**
Der erste Bundle-Build dauert deutlich länger als vier Minuten, weil `armeabi-v7a` einmal komplett durch den C++-Übersetzer muss. Danach greift der Zwischenspeicher.

Die beiden Wege können auseinanderlaufen: Was nur im Store-Bundle gebaut wird, wird von keinem E2E-Lauf berührt. Ein Fehler, der ausschließlich `armeabi-v7a` beträfe, fiele erst einem Tester auf. Das ist hinzunehmen – die Alternative wäre, alle Tests dreifach zu bauen.

---

## ADR-042 – Auslieferung als App Bundle, und damit hält Google den Signaturschlüssel

**Datum:** 2026-09-08 · **Status:** Angenommen

**Kontext**
Der Play Store nimmt für neue Apps kein APK mehr an, sondern ein **Android App Bundle**. Daran hängt eine Bedingung, die auf den ersten Blick nach einer Formalie aussieht und keine ist: Wer per Bundle ausliefert, muss **Play App Signing** benutzen. Google erzeugt und verwahrt dann den Schlüssel, mit dem die App am Ende signiert wird.

Das berührt den Satz, mit dem dieses Projekt angefangen hat: „Ich möchte nicht meine Daten an einem Unternehmen geben."

**Entscheidung**
V1 wird als App Bundle über Play App Signing ausgeliefert. Was lokal erzeugt wird, ist ein **Upload-Schlüssel**; er signiert nur den Weg vom Rechner zur Play Console. Den Schlüssel, mit dem die App auf den Geräten der Nutzer landet, hält Google.

**Begründung**
Es gibt hier nichts abzuwägen: Ohne Play App Signing kein Bundle, ohne Bundle keine neue App im Play Store, ohne Play Store kein interner Test (ADR-014). Der Zwang ist die Entscheidung.

Aufgeschrieben wird sie trotzdem, weil sie eine **Datenschutz-Zusage nicht berührt, aber danach aussieht**. Google bekommt keine Nutzerdaten – Listen, Artikel und Kaufhistorie bleiben unverändert auf dem Gerät. Google bekommt einen kryptografischen Schlüssel für das Programm. Diese Unterscheidung ist wichtig genug, um sie einmal ausgeschrieben zu haben, statt sie später verteidigen zu müssen.

**Verworfene Alternative**
*Verteilung als APK per Link.* Damit bliebe jeder Schlüssel im eigenen Haus. Bereits in ADR-014 verworfen, und aus dem stärkeren Grund: Die Installation aus unbekannten Quellen wäre für diese Zielgruppe die größte Hürde des ganzen Projekts. Ein Schlüssel bei Google ist der kleinere Preis als zehn Tester, die an einer Sicherheitswarnung scheitern.

**Konsequenz**
Der Upload-Schlüssel ist **ersetzbar**. Geht er verloren, setzt der Play-Support ihn zurück – die App bleibt aktualisierbar. Das ist der Unterschied zur alten APK-Welt, in der ein verlorener Schlüssel das Ende bedeutete. Die README hat das bis heute falsch beschrieben und ist mit diesem ADR berichtigt.

Trotzdem sichern: Ein Support-Fall kostet Tage, in denen kein Update ausgeliefert werden kann.

Der Schlüssel und sein Passwort gehören **nicht** ins Repository (CLAUDE.md). Der Build liest sie über `project.hasProperty(...)` aus `%USERPROFILE%\.gradle\gradle.properties`. Fehlen sie, signiert er mit dem Debug-Schlüssel weiter – E2E-Läufe und die manuelle Abnahme laufen also auch auf einem Rechner ohne eingerichteten Schlüssel.

---

## ADR-043 – Der Vorrat kennt nur „da" oder „nicht da" und füllt sich beim Abschließen des Einkaufs

**Datum:** 2026-10-27 · **Status:** Angenommen · **Eröffnet V2**

**Kontext**
Nach sieben Wochen Alltagsnutzung wünscht sich der Auftraggeber einen Vorrat: was gerade zu Hause ist, als Grundlage für zwei Dinge – nicht kaufen, was schon da ist, und kochen aus dem, was da ist (ADR-044). Vorrats-Apps scheitern fast immer an derselben Stelle: Sie verlangen, dass jede Entnahme gebucht wird. Das hält im Alltag niemand länger als zwei Wochen durch.

**Entscheidung**
Der Vorrat ist eine Menge von Produkten, mehr nicht. Eine eigene Tabelle `pantry` mit `product_id` als Schlüssel (Fremdschlüssel auf `products`, `ON DELETE CASCADE`) und `added_at`. Ein Produkt ist da, wenn eine Zeile existiert.

Hinein kommt alles Abgehakte **in derselben Transaktion wie „Einkauf abschließen"** – das kostet den Nutzer nichts. Heraus geht ein Produkt, wenn der Nutzer den Haken entfernt.

Der Vorrats-Screen zeigt nicht „was im Vorrat ist", sondern **„was du üblicherweise kaufst"**: alle Produkte mit Kaufhistorie, dazu alles, was gerade im Vorrat steht, nach Abteilungen gruppiert. Der Haken bedeutet „ist da". Darunter ein Knopf, der alle Fehlenden gesammelt auf die aktive Liste setzt. Ansicht und Pflege sind damit derselbe Screen, und die Pflege ist ein Ritual von einer Minute vor dem Einkauf – keine Buchführung.

**Verworfene Alternativen**
- *Mengen führen („2 l Milch").* Präzise, aber jede Entnahme müsste gebucht werden. Die Erfahrung mit Vorrats-Apps ist eindeutig.
- *Drei Stufen (voll, zur Neige, leer).* Ein Tipp mehr pro Artikel und Woche. Der Mehrwert – „bald nachkaufen" – ist genau das, was die Checkliste vor dem Einkauf ohnehin leistet.
- *Eine Spalte `in_pantry` an `products` statt einer Tabelle.* Weniger Schema, aber jeder Haken schriebe in die Katalogtabelle, und die beobachten mehrere Live-Abfragen (Katalog, Vorschläge). Eine eigene Tabelle löst nur ihre eigenen Abfragen aus.
- *Alles von Hand pflegen.* Doppelte Arbeit neben der Liste. Der Vorrat würde nach dem ersten vergessenen Eintrag unglaubwürdig und dann ignoriert.
- *„Aufgebraucht" setzt direkt auf die Liste.* Die Rückkopplung ist richtig gedacht, aber der Auftraggeber will sie nicht automatisch – der Knopf „Fehlende auf die Liste" erledigt es gesammelt und sichtbar.

**Konsequenz**
Nur Artikel **mit Produktbezug** gelangen in den Vorrat. Listeneinträge ohne `product_id` gibt es praktisch nur, wenn ein Produkt nachträglich gelöscht wurde (ADR-007) – der Fall ist hinzunehmen.

Wird ein Produkt gelöscht, verschwindet es aus dem Vorrat (CASCADE). Das ist gewollt: Der Vorrat ist eine Eigenschaft des Katalogprodukts, keine eigenständige Aufzeichnung.

„Üblich" heißt: innerhalb des Zeitfensters der Vorschläge gekauft (180 Tage, ADR-037). Was länger her ist und nicht mehr im Vorrat liegt, fällt von der Checkliste – es ist dann kein üblicher Artikel mehr. Das ist gewollt; eine Checkliste, die alles je Gekaufte führt, wird mit den Jahren so lang wie der Katalog.

Die Vorschläge beim Tippen zeigen „Im Vorrat" als Hinweis unter dem Treffer – und **blenden nichts aus**. Wer mehr kaufen will, soll das können, ohne mit der App zu streiten.

Die Sicherung nimmt die Tabelle mit; ältere Sicherungen bleiben lesbar (ADR-046).

---

## ADR-044 – Rezepte liegen neben den Vorlagen, nicht in ihnen

**Datum:** 2026-10-27 · **Status:** Angenommen · **Hebt das Nicht-Ziel „Rezepte, Wochenplan" aus PRD §6 für V2 auf**

**Kontext**
Eine Vorlage ist eine benannte Liste von Zutaten, die auf eine Einkaufsliste gesetzt wird und überspringt, was schon draufsteht (ADR-038). Ein Rezept ist – fast – dasselbe. Der Unterschied ist eine einzige Frage: *Was davon ist schon zu Hause?* Mit dem Vorrat (ADR-043) ist sie beantwortbar. Die Versuchung liegt nahe, Rezepte als Vorlagen mit einem Kennzeichen zu bauen.

**Entscheidung**
Eigene Tabellen `recipes` und `recipe_items`, im **gleichen Zuschnitt** wie `templates` und `template_items` (Name als Kopie, ADR-007; Produktbezug `SET NULL`; Positionen). Dazu `is_builtin` und eine optionale Notiz am Rezept, und eine dritte Tabelle `weekly_plan` mit nur den gewählten Rezept-IDs – keine Wochentage.

Die App liefert einen **Grundstock von rund 35 Alltagsgerichten** mit, deren Zutaten ausschließlich aus den 200 Katalogprodukten stammen. Ein Test prüft das. Mitgeliefertes ist veränderbar; die Sicherung heißt „Rezepte zurücksetzen" und arbeitet nach dem Muster von ADR-031.

Die Übersicht sortiert nach fehlenden Zutaten, „Alles da" zuerst. „Fehlendes auf die Liste" wendet die Regel aus ADR-038 an, erweitert um den Vorrat: Übersprungen wird, was offen auf der Liste steht **oder** im Vorrat liegt.

**Verworfene Alternativen**
- *Vorlagen um ein Kennzeichen `kind` erweitern.* Spart zwei Tabellen, aber Vorlagen und Rezepte haben verschiedene Lebensläufe: Vorlagen entstehen aus Listen, Rezepte werden angelegt; Rezepte haben einen Grundstock und ein Zurücksetzen, Vorlagen nicht; „Vorlage anwenden" darf den Vorrat nicht beachten, sonst fehlt im Wocheneinkauf plötzlich die Milch, weil noch ein Rest da war. Zwei Dinge, die sich nur ähneln, in einer Tabelle zu halten, kostet bei jeder Änderung ein „gilt das für beide?".
- *Rezepte aus dem Netz oder per KI.* Die App würde den Vorrat an einen Server schicken. Das bricht den Grundsatz des Projekts („Ich möchte nicht meine Daten an einem Unternehmen geben") und war dem Auftraggeber ausdrücklich keine Option.
- *Wochenplan mit Wochentagen.* Montag Bolognese, Dienstag Suppe – wird erfahrungsgemäß nach zwei Wochen ignoriert und ist dann Pflegeaufwand ohne Nutzen. Die Frage „was koche ich diese Woche" braucht keine Tage.
- *Kein Grundstock, nur eigene Rezepte.* Am ersten Tag wäre der Screen leer und das Versprechen „kochen aus dem Vorrat" unerfüllbar. Der Grundstock ist Starthilfe, bewusst langweilig, und darf gelöscht werden.

**Konsequenz**
Die Zutateneingabe benutzt **dasselbe Eingabefeld mit denselben Vorschlägen** wie die Liste – kein zweiter Weg, kein zweites Verhalten. Mengen sind optional.

Der Grundstock bindet sich an Katalognamen. Benennt der Nutzer „Hackfleisch" in „Rinderhack" um, bleibt die Verknüpfung über die Produkt-ID bestehen (ADR-031). Löscht er das Produkt, bleibt die Zutat als Text und zählt als „fehlt" – wie ein Listeneintrag ohne Produkt.

Die Warnung aus PRD §6 bleibt gültig: Rezepte können die App verdoppeln. Deshalb gibt es keine Zubereitungsschritte, keine Bilder, keine Portionen, keine Nährwerte. Ein Rezept ist eine Zutatenliste mit Namen und einer Notiz.

---

## ADR-045 – Das Widget ist ein lokales Expo-Modul in Kotlin, ohne neues Paket

**Datum:** 2026-10-27 · **Status:** Angenommen · **Hebt das Nicht-Ziel „Homescreen-Widget" aus PRD §6 für V2 auf**

**Kontext**
Ein Homescreen-Widget ist in Android eine `AppWidgetProvider`-Klasse mit XML-Layouts – nativer Code, den React Native nicht erzeugt. Zwei Dinge erschweren das in diesem Projekt: `android/` wird bei jedem `expo prebuild` neu erzeugt und ist nicht versioniert (ADR-023); und CLAUDE.md verlangt für jede neue Abhängigkeit eine Rückfrage.

**Entscheidung**
Ein **lokales Expo-Modul** unter `modules/to-shopping-widget/` mit `expo-module.config.json`. Expo bindet solche Module ohne weiteres Paket ein; sie überleben `prebuild`, weil sie außerhalb von `android/` liegen. Das Modul enthält den `AppWidgetProvider`, die Layouts und ein kleines Manifest-Fragment mit dem Receiver.

Das Widget zeigt die offenen Artikel der **zuletzt geöffneten Liste** (höchstes `last_opened_at`), höchstens fünf, dann „+ n weitere". Es liest dafür die SQLite-Datei der App **nur lesend** über Androids eigene `SQLiteDatabase`. Ein Tipp öffnet die Liste über den App-Link `toshopping://liste?listId=…`.

Aktualisierung: Android erlaubt periodisch frühestens alle 30 Minuten. Zusätzlich stellt das Modul der App eine Funktion `refreshWidget()` bereit, die nach jedem Schreibvorgang an Listen oder Artikeln aufgerufen wird.

**Verworfene Alternativen**
- *Das Paket `react-native-android-widget`.* Rendert Widgets aus React-Komponenten und spart das XML. Dafür eine neue Abhängigkeit mit eigener Build-Konfiguration, und die Daten kämen über einen Headless-JS-Task – die ganze JavaScript-Laufzeit, um vier Zeilen Text zu zeichnen. Für ein Lernprojekt ist der direkte Weg lehrreicher und für die App der leichtere.
- *Kotlin direkt in `android/` schreiben.* Weg beim nächsten Prebuild. Man könnte `android/` versionieren, aber ADR-023 hat das aus guten Gründen verworfen.
- *Ein Config-Plugin, das Kotlin-Dateien in `android/` kopiert.* Funktioniert, ist aber eine zweite, fragile Art, natives Zeug unterzubringen, während Expo mit lokalen Modulen eine erste und vorgesehene hat.
- *Abhaken im Widget.* Schreibt aus einem Receiver in die Datenbank, während die App dieselbe Datei offen haben kann. Lösbar, aber ein Konfliktfeld, das für einen ersten Wurf nicht sein muss. Vertagt, nicht verworfen.

**Konsequenz**
Das ist der **erste native Code im Projekt**. Er kennt den Datenbankpfad, den Dateinamen `to-shopping.db` und die Spalten von `lists` und `list_items`. Jede Schemaänderung an diesen beiden Tabellen hat ab jetzt eine zweite Stelle, die mitgeprüft werden muss – das steht in `architecture.md` §3.4 als Pflichtpunkt.

Maestro sieht Widgets nicht. Das Widget bekommt einen Abschnitt in `abnahme.md`; Gate 4 kann es nicht abdecken, Gate 5 muss es.

Ein Nutzer, der das Widget nie auf den Startbildschirm legt, merkt von alledem nichts. Es gibt keinen neuen Berechtigungseintrag im Manifest.

Das Widget öffnet die Datenbank mit einem **stummen Fehler-Handler**. Androids Standard-Handler löscht die Datei, sobald SQLite eine Beschädigung meldet – und eine solche Meldung kann hier auch ohne echten Schaden kommen, weil das Widget mitten in einen Schreibvorgang der App hineinlesen kann. Ohne den eigenen Handler könnte ein harmloser Lesefehler die Daten des Nutzers vernichten; mit ihm kommt der Fehler nur als Exception an, und das Widget behält seine alte Anzeige.

Das Widget liest **im selben Prozess wie die App, ohne Sperre**: Androids SQLite und das von expo-sqlite sind zwei Bibliotheken, die sich gegenseitig nicht sperren. Das Widget kann deshalb kurz einen halbfertigen Stand sehen; dann scheitert das Lesen, und die alte Anzeige bleibt. Ein eigener Prozess hätte das vermieden, weil dann die Dateisperren von SQLite greifen – aber expo-sqlite setzt kein `busy_timeout`, und ein Schreibvorgang der App könnte dann mit „database is locked“ scheitern. Zwischen einem kurz veralteten Widget und einem verlorenen Schreibvorgang in der App ist das Widget der kleinere Preis.

Die App nutzt **kein WAL** (Write-Ahead-Logging). Schaltet sie es je ein, ist der Nur-Lese-Zugriff des Widgets neu zu prüfen: Im WAL-Modus braucht auch ein Leser Schreibzugriff auf die `-shm`-Datei, und `OPEN_READONLY` verhält sich dann anders.

---

## ADR-046 – Die Sicherung bleibt abwärtskompatibel: fehlende Tabellen gelten als leer

**Datum:** 2026-10-27 · **Status:** Angenommen

**Kontext**
`parseBackup` verlangt bisher, dass **jede** Tabelle aus `BACKUP_TABLES` in der Datei steht, sonst gilt sie als unlesbar. Mit V2 kommen vier Tabellen hinzu (`pantry`, `recipes`, `recipe_items`, `weekly_plan`). Würden sie schlicht an die Liste gehängt, wäre jede Sicherung aus V1 wertlos – und genau diese Dateien liegen bei den Testern.

**Entscheidung**
`BACKUP_TABLES` wird in **Pflichttabellen** (die acht aus V1) und **optionale Tabellen** (alle neuen) geteilt. Fehlt eine optionale Tabelle in der Datei, gilt sie als leer. `version` des Formats bleibt bei 1, weil die Änderung verträglich ist. Die Prüfung `schemaVersion > aktuell` bleibt unverändert – sie schützt weiter davor, eine Datei aus einer neueren App einzuspielen.

**Verworfene Alternativen**
- *`version` auf 2 erhöhen und Version 1 ablehnen.* Ehrlich im Sinne der Regel aus `architecture.md` §5.2, aber die Regel meint *inkompatible* Änderungen. Eine Datei, der nur Tabellen fehlen, ist nicht inkompatibel – die Wiederherstellung kann sie vollständig verarbeiten.
- *Alte Dateien beim Einlesen umschreiben.* Unnötig: „fehlt = leer" ist dieselbe Information ohne Umschreibschritt.

**Konsequenz**
Eine wiederhergestellte V1-Sicherung hat einen leeren Vorrat und nur den Rezept-Grundstock. Das ist korrekt, nicht verlustbehaftet – es gab diese Daten nicht. Beim nächsten Abschließen eines Einkaufs füllt sich der Vorrat von selbst.

Damit der Grundstock nach einer V1-Wiederherstellung tatsächlich zurückkommt, braucht es einen Zusatz (T-14.6): Die Wiederherstellung **ersetzt** den Bestand, die Rezepttabelle ist danach leer – aber der Merker `recipes_seeded` in `app_state` steht noch, und `seedRecipesOnce` würde nie wieder säen. `parseBackup` meldet deshalb zusätzlich `missingOptional`, welche optionalen Tabellen in der Datei fehlten. Fehlte `recipes`, setzt `restoreBackup` den Merker **nach** seiner Transaktion auf `false`; beim nächsten Start sät `seedRecipesOnce`. Eine Datei mit vorhandener, aber leerer `recipes`-Tabelle lässt den Merker stehen – dort hat der Nutzer seine Gerichte bewusst gelöscht. `app_state` selbst bleibt aus der Sicherung ausgeschlossen; verworfen wurde, den Merker in die Sicherung aufzunehmen, weil er eine Geräte-Angabe ist und eine V1-Datei ihn ohnehin nicht hätte.

Jede weitere neue Tabelle kommt in die optionale Liste. Die Pflichtliste wächst nie mehr.

---

## ADR-047 – Rezepte bekommen nummerierte Schritte, aber nur Text; Grundzutaten zählen nicht als fehlend

**Datum:** 2026-10-27 · **Status:** Angenommen · **Ändert ADR-044 in einem Punkt**

**Kontext**
ADR-044 hat Zubereitungsschritte ausgeschlossen: „Ein Rezept ist eine Zutatenliste mit Namen und einer Notiz." Nach dem ersten Blick auf den Grundstock wünscht sich der Auftraggeber Schritte – und fragt nach Gewürzen, die im Grundstock fehlen. Der Tech Lead hat ein Freitextfeld empfohlen, der Auftraggeber hat sich für nummerierte Schritte entschieden. Das ist seine Entscheidung; dieses ADR hält fest, wie weit die Tür damit aufgeht.

Zu den Gewürzen zeigten die Zahlen zwei getrennte Probleme: Dem Katalog fehlen gängige Gewürze (Oregano, Curry, Zimt, Kümmel, Muskat), und Grundzutaten wie Salz, Pfeffer und Öl würden jedes Gericht als „3 fehlen" zeigen, bis der Vorrat sie kennt – weshalb der Grundstock Salz bisher gar nicht nennt.

**Entscheidung**
1. **Schritte:** Tabelle `recipe_steps` (`recipe_id` → CASCADE, `position`, `text` ≤ 500 Zeichen). In der Ansicht eine nummerierte Liste unter den Zutaten, im Bearbeiten Textfelder mit Pfeilen zum Umsortieren (ADR-028). **Die Grenze: Ein Schritt ist Text.** Keine Timer, keine Fotos, keine Portionen, keine Zutaten-Verknüpfung innerhalb eines Schritts. Wer das will, baut ein Kochbuch – und das ist weiterhin das Nicht-Ziel aus PRD §6.
2. **Grundvorrat:** Kennzeichen `is_staple` am **Produkt**, im Katalog umschaltbar. Eine Zutat, deren Produkt Grundvorrat ist, steht im Rezept, zählt aber nicht als fehlend und geht nicht automatisch auf die Liste. Mitgeliefert gesetzt für Salz, Pfeffer, Zucker, Mehl, Speiseöl, Olivenöl, Essig, Senf, Gemüsebrühe und die neuen Gewürze.
3. **Gewürze:** Rund zehn gängige Gewürze kommen in den Katalog, als Grundvorrat. Bestandsgeräte bekommen sie **einmalig** nachgesät (Merker `catalog_seed_version` in `app_state`), ohne dass gelöschte oder umbenannte Produkte angefasst werden (ADR-031).

**Verworfene Alternativen**
- *Ein Freitextfeld „Zubereitung".* Die Empfehlung: kleinste Form, kein neues Risiko. Vom Auftraggeber abgelehnt – er will die Schritte einzeln.
- *Grundzutaten nur im Text erwähnen.* Kein Schema, aber eine Zutatenliste, die lügt: „Salz" fehlt dann in der Liste, obwohl man es braucht.
- *Kennzeichen an der Zutat statt am Produkt.* Müsste in jedem Rezept neu gesetzt werden. Salz ist Grundvorrat, egal in welchem Gericht.
- *Neue Katalogprodukte bei jedem Start nachsäen.* Würde gelöschte mitgelieferte Produkte zurückbringen – genau das, was ADR-031 verbietet. Deshalb ein Versionsmerker.

**Konsequenz**
Der Rezeptteil wächst um eine Tabelle und einen Editor. Die Grenze „nur Text" ist der Preis dafür, dass er nicht weiterwächst; sie steht hier, damit die nächste Erweiterung begründet werden muss.

„Alles da" heißt ab jetzt: alles, was kein Grundvorrat ist, liegt im Vorrat. Wer Salz tatsächlich braucht, sieht es in der Zutatenliste mit eigenem Kennzeichen – und setzt es von Hand auf die Liste.

Nach einer Wiederherstellung aus einer älteren Sicherung fehlt das Kennzeichen an den Produkten; die Wiederherstellung setzt deshalb den Versionsmerker zurück, und der nächste Start trägt die mitgelieferten Grundvorrat-Kennzeichen erneut ein (nur bei Seed-Produkten, nur wo das Kennzeichen fehlt).

---

## ADR-048 – Rezepte filtern: nach Vorrat und nach gewählten Zutaten, Treffer bei mindestens einer

**Datum:** 2026-10-27 · **Status:** Angenommen

**Kontext**
Die Rezeptübersicht sortiert seit M14 nach fehlenden Zutaten, „Alles da" zuerst (FR-10.3). Nach dem ersten Tag mit V2 fehlte dem Auftraggeber trotzdem die Antwort auf „Was kann ich aus meinem Vorrat kochen?" – aus zwei Gründen: Vom Vorrat führt kein Weg zu den Rezepten, und die Übersicht zeigt immer alle Gerichte, auch die mit acht fehlenden Zutaten. Dazu ein dritter Wunsch: „Ich will die Zucchini wegbekommen – was geht damit?"

**Entscheidung**
1. Im Vorrat ein zweiter Knopf **„Was kann ich kochen?"**, der in die Rezeptübersicht führt.
2. Über der Rezeptliste drei Filter-Chips: **Alle · Alles da · Fast alles da** (höchstens eine fehlende Zutat, Grundvorrat zählt nicht – ADR-047). Die Wahl bleibt gemerkt (`app_state`, UI-Zustand im Sinne von ADR-020). Der Wochenplan oben ist vom Filter ausgenommen: Er ist Auswahl, kein Suchergebnis.
3. Ein vierter Chip **„Zutat wählen…"** öffnet eine Auswahl, die **nur Vorratsartikel** zeigt. Die Liste zeigt danach Gerichte, die **mindestens eine** der gewählten Zutaten verwenden, sortiert nach der Zahl der verwendeten gewählten Zutaten (absteigend), dann nach fehlenden Zutaten (aufsteigend), dann nach Name.

**Verworfene Alternativen**
- *Nur Gerichte mit allen gewählten Zutaten.* Exakter, aber bei zwei Zutaten in einem Grundstock von 35 Gerichten meist leer. Das Ziel ist, etwas aufzubrauchen, nicht ein bestimmtes Gericht zu finden – deshalb „mindestens eine", und die mit mehreren stehen oben.
- *Auswahl aus dem ganzen Katalog statt nur aus dem Vorrat.* Wer nach Gerichten mit Hummer sucht, den er nicht hat, sucht ein Kochbuch. Die Frage lautet „was kann ich mit dem kochen, was da ist" – also nur der Vorrat.
- *Die Auswahl im Vorrat-Screen selbst.* Dort sind die Zeilen schon Haken für „ist da"; ein zweiter Auswahlmodus auf denselben Zeilen wäre zweideutig. Die Auswahl gehört zu den Rezepten.
- *Filter als Suchfeld.* Eine Suche nach Namen ist etwas anderes und bei 35 plus eigenen Gerichten nicht nötig.

**Konsequenz**
Alles ist reine Logik über den vorhandenen Übersichtszeilen (`buildRecipeOverview`); keine neue Tabelle, keine Änderung an Repository-Schreibpfaden. Der Zutatenfilter reist als Routen-Parameter (`/rezepte?with=…`), damit Zurück und Neustart ihn verstehen.

Ein leerer Filter bekommt eine Erklärung statt einer leeren Fläche: „Nichts passt – stimmen die Haken im Vorrat?" mit dem Weg dorthin. Denn der häufigste Grund für „nichts da" ist ein Vorrat, der nie gepflegt wurde.

---

## Offene Entscheidungen (bewusst vertagt)

| Thema | Wann zu entscheiden | Was dann abzuwägen ist |
|---|---|---|
| OTA-Updates (FR-8.4) | nach vier Wochen Nutzung | siehe ADR-040: Wie oft wird nachgebessert, stoert der Store-Weg dabei? |
| Live-Sync und Backend | nach V1 | Anbieterwahl, anonyme Identität vs. Konto, Selbsthosting, Kontolöschungspflicht, laufende Kosten |
| iOS-Portierung | wenn Gerät und Budget vorhanden | Cloud-Build-Kosten, Share Extension, App-Store-Review |
| Crash-Reporting (Sentry EU) | bei öffentlicher Veröffentlichung | AVV, Datenschutzerklärung, Einwilligung |
| ~~Homescreen-Widget~~ | *entschieden: ADR-045, M15* | — |
| Barcode-Scan | V2 | Kameraberechtigung, Produktdatenquelle |
| Monetarisierung | nur bei öffentlicher Veröffentlichung | DSA-Händlerdaten werden dann öffentlich |
| Android Auto-Backup | jederzeit | siehe ADR-004 |
| Endgültiger App-Name | vor öffentlicher Veröffentlichung | Auffindbarkeit im Store |
| KI-Rezeptvorschläge aus dem Vorrat | nach vier Wochen mit M17, und erst nach der Frage, ob die App öffentlich wird | siehe unten: Daten verlassen das Gerät, Schlüsselfrage, Datenschutzerklärung – oder Gerätemodell mit unsicherer Qualität |

### Vertagt am 27. Oktober 2026: KI-Rezeptvorschläge

**Die Frage:** Eine KI, die aus dem Vorrat Gerichte vorschlägt – auch solche, die nicht im Grundstock oder unter den eigenen Rezepten stehen, und die Wünsche wie „etwas Schnelles ohne Fleisch" versteht.

**Was heute schon da ist (M17, ADR-048):** Treffer und Sortierung nach dem Vorrat, Filter „Alles da", Gerichte zu gewählten Zutaten. Deterministisch, in Millisekunden, ohne dass etwas das Gerät verlässt. Das deckt „was kann ich kochen" ab; was fehlt, ist nur das *Erfinden* neuer Gerichte.

**Die drei Wege und ihr Preis:**

| Weg | Aufwand | Preis |
|---|---|---|
| **Cloud-KI** (Claude, GPT o. ä.) | 2–3 Abende Code, 1 Abend Compliance | Der Vorrat geht an ein Unternehmen, meist in die USA. Die Datenschutzerklärung („baut keine Verbindung auf") und das Data-Safety-Formular („nein") müssten neu; Drittlandtransfer, Einwilligung. Ein API-Schlüssel darf nicht in die App – entweder bringt jeder Nutzer seinen eigenen mit (Hürde für die Tester) oder es braucht einen eigenen Server (Backend, Konten, Kosten – das Nicht-Ziel aus PRD §6). Kosten pro Anfrage. |
| **KI auf dem Gerät** (Gemini Nano auf dem S24, oder ein mitgeliefertes offenes Modell) | 1–2 Wochen, Ergebnis unsicher | Nichts verlässt das Gerät – der einzige Weg, der den Grundsatz hält. Aber: Gemini Nano nur auf wenigen Geräten und mit begrenzter Schnittstelle; ein eigenes Modell heißt 1–2 GB Download, langsam, auf Deutsch mittelmäßig, eine neue native Abhängigkeit. |
| **Keine KI, bessere Regeln** | erledigt (M17) | Erfindet nichts Neues. Für „was kann ich aus dem kochen, was da ist" reicht es. |

**Falls es je gebaut wird, dann nur so:** eigener Schlüssel des Nutzers, Funktion standardmäßig **aus**, ausdrücklich einzuschalten, und an der Stelle steht, was genau verschickt wird. Als eigenes ADR mit ehrlichem Preis – und sinnvoll erst, wenn entschieden ist, ob die App überhaupt öffentlich wird. Für zehn Tester aus Familie und Freundeskreis ist der Preis zu hoch für die eine Fähigkeit.
