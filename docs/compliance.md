# Compliance – To-Shopping

**Version:** 1.0
**Stand:** 2026-08-18
**Geltungsbereich:** Deutschland / EU, Auslieferung über Google Play

> **Kein Rechtsrat.** Diese Datei ist eine Arbeitsgrundlage: Sie hält fest, welche Pflichten bei dieser konkreten App absehbar greifen und was dafür zu tun ist. Bei einer öffentlichen Veröffentlichung mit Monetarisierung sollte ein Blick von jemandem mit juristischer Qualifikation darauf fallen.

---

## 1. Ausgangslage – warum dieser Block klein bleibt

Die Architekturentscheidungen aus dem Discovery haben den überwiegenden Teil der üblichen Pflichten entfallen lassen:

| Entfällt, weil … | Folge |
|---|---|
| kein Backend, keine Konten (ADR-002) | keine Auftragsverarbeitung, keine AVV, keine Kontolöschungspflicht, keine Nutzerverwaltung |
| keine Werbung, keine Käufe (ADR-015) | keine Werbe-ID, kein Einwilligungsbanner, keine AGB, kein Widerrufsrecht, keine DSA-Händlerdaten |
| kein Crash-Reporting-SDK (ADR-011) | kein Drittlandtransfer durch Telemetrie |
| keine Benachrichtigungen, kein Standort, keine Kamera (ADR-012) | keine Laufzeitberechtigungen, keine Berechtigungsbegründung im Store |
| keine KI-Funktionen | EU AI Act nicht einschlägig (siehe Abschnitt 7) |

**Was übrig bleibt, sind im Kern drei Dinge:** eine Datenschutzerklärung mit URL, die Formulare in der Play Console, und die ehrliche Behandlung der beiden Stellen, an denen doch Daten fließen (OTA-Updates und Fehlerberichte).

---

## 2. Datenschutzrechtliche Einordnung

### 2.1 Welche Daten verarbeitet die App?

| Datenart | Wo | Fließt sie an den Entwickler oder Dritte? |
|---|---|---|
| Listen, Artikel, Mengen, Notizen | ausschließlich lokal auf dem Gerät | nein |
| Produktkatalog, Kategorien, Vorlagen | ausschließlich lokal | nein |
| Kaufhistorie (Produkt, Menge, Datum) | ausschließlich lokal | nein |
| Sicherungs- und Teilen-Dateien | dort, wohin der Nutzer sie selbst schickt | nur durch aktives Handeln des Nutzers |
| **OTA-Update-Abfrage** | Expo-Server (USA) | **ja** – siehe 2.2 |
| **Fehlerbericht** | lokal gespeichert | **nur wenn der Nutzer ihn selbst verschickt** – siehe 2.3 |

Personenbezogene Daten im engeren Sinn entstehen durch die App nicht. Der Nutzer *kann* welche eintragen (eine Notiz „Geschenk für Oma Schmidt"), aber diese Daten verlassen das Gerät nicht.

### 2.2 Der OTA-Update-Abruf – die relevante Stelle

Beim Start prüft die App über EAS Update, ob ein Update vorliegt (ADR-013). Dabei werden an Expo-Server übermittelt:

- IP-Adresse (technisch unvermeidbar bei jedem Verbindungsaufbau)
- Angaben zu App-Version, Laufzeitversion, Plattform und Kanal

**Das ist der einzige regelmäßige ausgehende Datenverkehr der App.** Er ist:

- **erforderlich**, um Sicherheits- und Fehlerkorrekturen auszuliefern (Rechtsgrundlage: berechtigtes Interesse, Art. 6 Abs. 1 lit. f DSGVO),
- ein **Drittlandtransfer** in die USA, der in der Datenschutzerklärung zu nennen ist,
- **nicht abschaltbar**, ohne OTA aufzugeben.

→ Aufgabe **C-2** und **C-3**.

### 2.3 Fehlerberichte

Der Bericht (Zeitstempel, App-Version, Android-Version, Gerätemodell, Fehlermeldung, Aufrufkette) wird lokal gespeichert. Erst wenn der Nutzer „An den Entwickler senden" drückt und einen Kanal wählt, verlässt er das Gerät.

Ab dem Moment, in dem der Bericht beim Entwickler ankommt, ist der Entwickler dafür **Verantwortlicher** im Sinne der DSGVO. Praktische Folgen bei zehn Testern: Berichte nicht länger als nötig aufbewahren, nicht weitergeben, in der Datenschutzerklärung erwähnen.

### 2.4 Rolle nach DSGVO

Solange die App rein lokal arbeitet, findet **keine Verarbeitung durch den Entwickler** statt – der Nutzer verarbeitet seine eigenen Daten auf seinem eigenen Gerät. Verantwortlicher wird der Entwickler nur für: den OTA-Abruf (2.2) und eingehende Fehlerberichte (2.3).

**Sobald Live-Sync kommt (ADR-003), ändert sich das grundlegend:** Dann ist der Entwickler Verantwortlicher für alle Listeninhalte aller Nutzer, braucht einen AVV mit dem Hosting-Anbieter, eine erweiterte Datenschutzerklärung, ein Löschkonzept und eine Kontolöschungsfunktion. Das ist bei der Entscheidung über Sync einzupreisen.

---

## 3. Datenschutzerklärung

Google Play verlangt für die Store-Eintragung eine **öffentlich erreichbare URL** zur Datenschutzerklärung. Sie muss ohne Login erreichbar sein und darf nicht in einem PDF versteckt liegen.

### 3.1 Hosting

**Empfehlung: GitHub Pages.** Kostenlos, dauerhaft erreichbar, keine eigene Domain nötig, Änderungen sind versioniert.

Verworfene Alternativen: eigene Domain (Kosten, keine 0 €), Notion/Google Docs (URL-Stabilität und Erreichbarkeit ohne Login unzuverlässig).

> **Achtung, oft übersehen:** Die URL muss die **Anschrift des Verantwortlichen** enthalten. Bei einer Privatperson ist das die Privatanschrift. Wer das vermeiden will, braucht eine ladungsfähige Alternative. Bei einem rein internen Test mit zehn bekannten Personen ist das Risiko überschaubar; **vor einer öffentlichen Veröffentlichung ist es bewusst zu entscheiden.**

### 3.2 Inhalt – Gliederung

1. Verantwortlicher (Name, Anschrift, E-Mail)
2. Grundsatz: Alle Inhalte der App werden ausschließlich lokal auf dem Gerät gespeichert. Es gibt keine Benutzerkonten und keine Übertragung von Listeninhalten an den Entwickler.
3. Automatische Updates (OTA): welche Daten, an wen, warum, Drittlandbezug, Rechtsgrundlage
4. Fehlerberichte: nur auf ausdrückliche Handlung des Nutzers, Inhalt, Aufbewahrung
5. Teilen und Sichern: Daten verlassen das Gerät nur, wenn der Nutzer sie selbst über eine andere App verschickt; für diese App gilt deren Datenschutzerklärung
6. Berechtigungen: Die App fordert keine Laufzeitberechtigungen an
7. Keine Werbung, kein Tracking, keine Analyse, keine Profilbildung
8. Betroffenenrechte (Auskunft, Löschung, Beschwerde bei der Aufsichtsbehörde) und wie sie hier praktisch aussehen: Löschung = App deinstallieren
9. Google Play als Vertriebsweg: Google verarbeitet eigenständig Daten, Verweis auf Googles Datenschutzerklärung
10. Stand und Änderungsdatum

→ Aufgabe **C-2**.

---

## 4. Google-Play-Pflichten

### 4.1 Data-Safety-Formular

Verpflichtend für jede App, unabhängig von der Testspur.

| Frage | Antwort für To-Shopping |
|---|---|
| Werden Daten erhoben oder geteilt? | Listeninhalte: **nein** |
| Werden Daten übertragen? | Nur die technische Update-Abfrage (App-Version, Gerätetyp, IP) |
| Verschlüsselte Übertragung? | ja (HTTPS) |
| Können Nutzer Löschung verlangen? | Ja – Deinstallation löscht alle Daten |

> **Offener Punkt, ehrlich zu prüfen (Aufgabe C-4):** Ob die EAS-Update-Abfrage im Data-Safety-Formular als „Datenerhebung" zu deklarieren ist, hängt davon ab, ob die übertragenen Angaben dort gespeichert oder nur flüchtig verarbeitet werden. Vor dem Ausfüllen ist die aktuelle Expo-Dokumentation zu diesem Punkt zu lesen und die Antwort danach zu richten. **Im Zweifel deklarieren** – eine zu vorsichtige Angabe kostet nichts, eine falsche Angabe ist ein Verstoß gegen die Play-Richtlinien.

### 4.2 Altersfreigabe (IARC-Fragebogen)

Keine Gewalt, keine Werbung, keine Nutzerinteraktion, keine Käufe, keine Standortweitergabe, keine nutzergenerierten Inhalte, die andere sehen. Erwartetes Ergebnis: **USK ab 0 / PEGI 3**.

Die Frage nach dem Teilen nutzergenerierter Inhalte ist wahrheitsgemäß zu beantworten: Nutzer können Listen als Datei verschicken, aber **nicht innerhalb der App** – es gibt keine Plattform, keine Sichtbarkeit für Dritte, keine Moderationspflicht.

### 4.3 Zielgruppe und Kinder

Zielgruppe: Erwachsene. Die App ist **nicht** für Kinder gestaltet und fällt damit nicht unter die „Families"-Richtlinien.

### 4.4 Händlerstatus (DSA)

Die Play Console verlangt eine Erklärung, ob man als **Händler** (Trader) auftritt. Eine kostenlose App ohne Werbung und ohne Käufe wird von einer Privatperson veröffentlicht → **Nicht-Händler**. Die Anschrift bleibt dann im Store nicht öffentlich sichtbar.

> **Merksatz für später:** Sobald Werbung oder In-App-Käufe hinzukommen, kippt der Status. Dann werden Name und Anschrift des Entwicklers im Store **öffentlich sichtbar**. Das ist ein Grund, Monetarisierung nicht nebenbei zu entscheiden.

### 4.5 Zugang zur Produktionsspur

> **Zu prüfen, bevor eine öffentliche Veröffentlichung geplant wird (Aufgabe C-8):** Google verlangt von neueren **privaten** Entwicklerkonten vor der Freischaltung der Produktionsspur einen geschlossenen Test mit einer Mindestzahl an Testern über einen Mindestzeitraum. Ob und in welcher Ausprägung das für dieses Konto gilt, hängt vom Erstellungsdatum des Kontos ab und ist in der Play Console direkt nachzusehen. **Für den internen Test ist das irrelevant** – der ist davon nicht betroffen.

### 4.6 Berechtigungen

V1 fordert **keine** Laufzeitberechtigung an.

**Stand nach M8 (2026-08-26).** Das erzeugte Manifest wurde geprüft. Gefunden und behandelt:

| Berechtigung | Herkunft | Entscheidung |
|---|---|---|
| `INTERNET` | Expo-Vorlage | **bleibt** – technische Voraussetzung für OTA, keine gefährliche Berechtigung |
| `VIBRATE` | `expo-haptics` | **bleibt** – das kurze Klopfen beim Abhaken (FR-3.2), keine Nutzerzustimmung nötig |
| `READ_EXTERNAL_STORAGE` | `expo-file-system` | **entfernt** über `android.blockedPermissions` |
| `WRITE_EXTERNAL_STORAGE` | `expo-file-system` | **entfernt** über `android.blockedPermissions` |
| `SYSTEM_ALERT_WINDOW` | Expo-Vorlage | **entfernt** – wird nur vom Entwickler-Menü gebraucht, und `expo-dev-client` ist nicht Teil des Projekts |
| `de.toshopping.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | React Native | **bleibt** – app-eigene Signaturberechtigung, für andere Apps nicht sichtbar |

Die beiden Speicherberechtigungen kamen mit `expo-file-system` herein. Die App braucht sie nicht: Geteilte Dateien werden in das **eigene** Zwischenspeicherverzeichnis geschrieben, empfangene Dateien über `content://`-Adressen gelesen, die der Absender freigibt. Beides kommt ohne Speicherberechtigung aus.

Geprüft wird das **zusammengeführte** Manifest des Release-Builds (`android/app/build/intermediates/merged_manifest/release/`), nicht die Vorlage – nur dort ist zu sehen, was am Ende im APK steht.

→ Aufgabe **C-6** bleibt offen für den Zeitpunkt vor dem Store-Upload: Die Prüfung ist bei **jeder** neuen Bibliothek zu wiederholen. Sie ist nicht einmalig erledigt, sondern gehört zur Abnahme jeder Abhängigkeit.

---

## 5. Impressum, AGB, Widerruf

| Pflicht | Gilt für V1? | Begründung |
|---|---|---|
| Impressum (§ 5 DDG) | **nein** | Kein geschäftsmäßiges Angebot; kostenlose App ohne Werbung und ohne Käufe, verteilt an einen bekannten Personenkreis |
| AGB | **nein** | Kein Vertragsverhältnis, keine Leistungspflichten, keine Konten |
| Widerrufsbelehrung | **nein** | Kein entgeltlicher Vertrag |

Alle drei kehren zurück, sobald Geld fließt oder Werbung eingebunden wird.

---

## 6. Urheberrecht und Inhalte

- **Produktkatalog:** Die 150–200 Produktnamen sind Gattungsbegriffe („Milch", „Butter", „Toilettenpapier"). **Regel: keine Markennamen** im mitgelieferten Katalog – weder „Nutella" noch „Coca-Cola". Der Nutzer darf selbst eintragen, was er will; ausgeliefert wird nur Neutrales.
- **Icon und Grafiken:** ausschließlich selbst erstellt oder unter freier Lizenz mit dokumentierter Herkunft.
- **Schriften:** nur die Systemschrift bzw. die von Material 3 vorgesehene freie Schrift.
- **Keine Produktbilder** (Nicht-Ziel im PRD) – das erspart die gesamte Bildrechtefrage.

---

## 7. EU AI Act

**Nicht einschlägig.** Die App enthält kein KI-System. Das Vorschlagsranking (Architektur, Abschnitt 4.2) ist eine offengelegte Formel aus Häufigkeit, Aktualität und Trefferqualität – klassische Statistik, kein maschinelles Lernen, kein Modell, keine automatisierte Entscheidung mit Rechtswirkung.

Dass der Code mit KI-Unterstützung *entwickelt* wird, ist rechtlich unerheblich – der AI Act regelt KI **in** Produkten, nicht Werkzeuge bei der Herstellung.

Käme später eine echte KI-Funktion hinzu (z. B. Rezept-zu-Einkaufsliste über ein Sprachmodell), wären Transparenzpflichten und eine erneute Einordnung zu prüfen.

---

## 8. Offene Aufgaben

Fälligkeit: **IT** = vor dem internen Test · **ÖV** = vor öffentlicher Veröffentlichung

| ID | Aufgabe | Fällig | Aufwand |
|---|---|---|---|
| **C-1** | Verantwortlichen-Angaben festlegen (Name, Anschrift, Kontakt-E-Mail für die Datenschutzerklärung) | IT | 15 min |
| **C-2** | Datenschutzerklärung nach der Gliederung in 3.2 verfassen – **Entwurf liegt in [`datenschutz.md`](datenschutz.md)**, es fehlen nur die Angaben aus C-1 | IT | 1–2 h |
| **C-3** | Datenschutzerklärung auf GitHub Pages veröffentlichen, URL in die Play Console eintragen | IT | 30 min |
| **C-4** | Expo-Dokumentation zum Datenumfang von EAS Update prüfen und das Data-Safety-Formular danach ausfüllen | IT | 45 min |
| **C-5** | IARC-Fragebogen zur Altersfreigabe ausfüllen | IT | 20 min |
| **C-6** | Erzeugtes Android-Manifest auf ungewollte Berechtigungen prüfen und bereinigen – **durchgeführt in M12**: `READ_/WRITE_EXTERNAL_STORAGE` (aus expo-file-system) und `SYSTEM_ALERT_WINDOW` (aus der Expo-Vorlage) sind über `android.blockedPermissions` entfernt. Im Release-Manifest stehen nur noch `INTERNET`, `VIBRATE` und eine app-interne Signaturberechtigung. Vor jedem Upload und nach jedem neuen Paket zu wiederholen – Befehl im README | IT | 20 min |
| **C-7** | Händlerstatus in der Play Console als Nicht-Händler erklären | IT | 10 min |
| **C-8** | Prüfen, welche Testanforderungen für dieses Entwicklerkonto vor der Produktionsspur gelten | ÖV | 15 min |
| **C-9** | Store-Eintrag: Beschreibung, Screenshots, Feature-Grafik | ÖV | 2 h |
| **C-10** | Datenschutzerklärung überarbeiten, falls Crash-Reporting (Sentry EU) hinzukommt – inkl. AVV | ÖV | 1 h |
| **C-11** | Entscheidung Anschrift: Privatadresse veröffentlichen oder Alternative | ÖV | – |
| **C-12** | Bei Sync: vollständige Neubewertung – AVV, Löschkonzept, Kontolöschung, erweiterte Datenschutzerklärung | bei Sync | 1 Tag+ |

---

## Verweise

- Produktdefinition und Nicht-Ziele: [`PRD.md`](PRD.md)
- Technische Grundlage, insbesondere Abschnitt 6 (Netzwerkverhalten): [`architecture.md`](architecture.md)
- Begründungen, insbesondere ADR-002, ADR-011, ADR-013, ADR-015: [`decisions.md`](decisions.md)
