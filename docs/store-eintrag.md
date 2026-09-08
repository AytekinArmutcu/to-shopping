# Store-Eintrag und Play-Console-Formulare

Alles zum Kopieren. Reihenfolge entspricht der, in der die Play Console fragt.

Grafiken liegen in [`../store/`](../store/), die Compliance-Begründungen in
[`compliance.md`](compliance.md).

---

## 1. App anlegen

| Feld | Wert |
|---|---|
| App-Name | `To-Shopping` |
| Standardsprache | Deutsch (Deutschland) – `de-DE` |
| App oder Spiel | App |
| Kostenlos oder kostenpflichtig | **Kostenlos** |

> Der Name ist für den internen Test in Ordnung. Vor einer öffentlichen
> Veröffentlichung steht er noch einmal zur Debatte – siehe „Offene
> Entscheidungen" in [`decisions.md`](decisions.md): Auffindbarkeit im Store.
> **Kostenlos ist unumkehrbar:** Eine kostenlose App lässt sich später nicht in
> eine kostenpflichtige umwandeln. Das ist hier gewollt (ADR-015).

---

## 2. Händlerstatus (C-7) — zuerst erledigen

**Nicht-Händler.**

Kostenlose App, keine Werbung, keine In-App-Käufe, veröffentlicht von einer
Privatperson (ADR-015). Als Händler würden Name und Anschrift im Store
öffentlich sichtbar – deshalb steht dieser Punkt vor allen anderen.

---

## 3. Store-Eintrag

### Kurzbeschreibung (max. 80 Zeichen)

```
Einkaufsliste, die sich merkt, was du kaufst. Ohne Konto, alles bleibt lokal.
```

*77 Zeichen.*

### Vollständige Beschreibung (max. 4000 Zeichen)

```
To-Shopping ist eine Einkaufsliste für Menschen, die jede Woche ungefähr
dasselbe kaufen – und es trotzdem jedes Mal neu tippen müssen.

Die App merkt sich, was du kaufst. Nach ein paar Einkäufen stehen deine
üblichen Artikel oben, sobald du das Eingabefeld antippst. Nicht alphabetisch,
sondern nach dem, was du wirklich nimmst.

ALLES BLEIBT AUF DEINEM TELEFON

Kein Konto. Keine Anmeldung. Kein Server. Deine Listen, Mengen, Notizen und
deine Kaufhistorie liegen in einer Datenbank auf deinem Gerät und werden
nirgendwohin übertragen. Die App baut von sich aus keine einzige Verbindung
ins Netz auf.

Kein Tracking, keine Analyse, keine Werbung, keine In-App-Käufe.

IM LADEN

• Abhaken mit einem Wisch oder einem Tipp – beides geht
• Die Liste ist nach deinem Ladenlayout sortiert, nicht nach Alphabet
• Die Reihenfolge der Abteilungen stellst du selbst ein
• Alles mit dem Daumen erreichbar, einhändig, mit Einkaufswagen in der anderen
• Versehentlich abgehakt? Rückgängig, in Ruhe

ZU HAUSE

• Artikel eintippen, Vorschläge erscheinen sofort
• Oder aus dem mitgelieferten Produktkatalog wählen
• Mengen und Einheiten: Stück, Gramm, Kilo, Milliliter, Liter, Packung, Bund,
  Dose
• Notizen pro Artikel („die kleine Packung")
• Vorlagen für den Wocheneinkauf – einmal anlegen, mit einem Tippen anwenden
• Mehrere Listen nebeneinander

TEILEN UND SICHERN

Eine Liste lässt sich als Datei über das Teilen-Menü verschicken – an wen du
willst, worüber du willst. Wer die App auch hat, übernimmt sie mit einem
Tippen. Wer nicht, bekommt trotzdem einen lesbaren Text.

Für den Umzug auf ein neues Telefon: Sicherung erstellen, Datei aufbewahren,
auf dem neuen Gerät zurückspielen. Du entscheidest, wo die Datei liegt – die
App schiebt nichts in eine Cloud.

BARRIEREFREIHEIT

Vollständig mit dem Screenreader bedienbar, große Systemschriften werden
mitgetragen, heller und dunkler Modus, alle Bedienelemente mindestens 48 dp.

DEUTSCH

Die App ist auf Deutsch, und zwar durchgehend – nicht übersetzt.
```

*Rund 1750 Zeichen.*

### Grafiken

| Was | Datei | Größe |
|---|---|---|
| App-Symbol | `store/icon-512.png` | 512 × 512, ohne Transparenz |
| Feature-Grafik | `store/feature-graphic.png` | 1024 × 500 |

Beide erzeugt von `store/grafiken.py` aus den Farben in `src/theme/index.ts`.

### Screenshots

Aufgenommen auf dem Galaxy S24 (1080 × 2340), hergestellt von
`store/screenshots.yaml`. Play verlangt mindestens zwei; die Reihenfolge unten
erzählt eine Geschichte und ist die empfohlene.

| # | Datei | Was es zeigt |
|---|---|---|
| 1 | `screenshot-1-liste.png` | Die gefüllte Liste, nach Abteilungen sortiert |
| 2 | `screenshot-2-menge.png` | Menge, Einheit und Notiz an einem Artikel |
| 3 | `screenshot-3-einkauf.png` | Mitten im Einkauf: offen und erledigt nebeneinander |
| 4 | `screenshot-4-ladenlayout.png` | Die Reihenfolge des eigenen Marktes |
| 5 | `screenshot-5-uebersicht.png` | Mehrere Listen nebeneinander |
| 6 | `screenshot-6-katalog.png` | Der mitgelieferte Produktkatalog |
| 7 | `screenshot-7-vorschlaege.png` | Nach dem Einkauf: die üblichen Verdächtigen |

Dieselben sieben im Dunkelmodus als `dunkel-*.png`. Für den Store reicht ein
Satz – der helle wirkt im Play Store freundlicher. Der dunkle liegt bei, weil
er beweist, dass FR-7.2 hält.

> **Falls die Console die Seitenverhältnisse bemängelt:** Das S24 nimmt mit
> 1:2,17 auf, Google dokumentiert 9:16 bis 16:9. In der Praxis nimmt die
> Console hohe Telefonbilder an. Sollte sie hier zicken, sind die Bilder mit
> Rändern auf 1080 × 1920 zu bringen – sagen, dann mache ich das.

> **Bild 7 zeigt die Tastatur**, und das ist Absicht: Es beweist nebenbei, dass
> das Eingabefeld über der Tastatur stehen bleibt (Punkt 1 aus
> [`abnahme.md`](abnahme.md), der Punkt mit dem größten Risiko).

---

## 4. App-Inhalte

### 4.1 Datenschutzerklärung (C-3)

URL eintragen. Quelle: `docs/datenschutz.html`, veröffentlicht über GitHub Pages.

> **Noch offen:** Die Erklärung braucht eine ladungsfähige Anschrift, und die
> Seite ist danach weltweit sichtbar. Entscheidung C-11 steht aus.

### 4.2 App-Zugriff

**Alle Funktionen sind ohne besonderen Zugriff verfügbar.**

Es gibt keine Anmeldung, keinen Zugangscode, keine gesperrten Bereiche. Google
braucht also keine Testzugangsdaten.

### 4.3 Werbung

**Nein, die App enthält keine Werbung.**

### 4.4 Data Safety (C-4)

| Frage | Antwort |
|---|---|
| Erhebt oder teilt deine App Nutzerdaten? | **Nein** |
| Werden Daten übertragen? | **Nein** |
| Datenlöschung anfordern? | Deinstallation löscht alles |

Begründung und die beiden Randfälle (geteilte Dateien, Fehlerbericht) stehen in
[`compliance.md`](compliance.md), Abschnitt 4.1. Kurz: Beide sind keine Erhebung
durch die App, weil sie ausschließlich durch eine Handlung des Nutzers geschehen.

### 4.5 Inhaltseinstufung, IARC (C-5)

Kategorie: **Dienstprogramme / Produktivität**

| Frage | Antwort |
|---|---|
| Gewalt, Schrecken, Sexualität, Drogen, Glücksspiel | durchgehend nein |
| Enthält die App In-App-Käufe? | nein |
| Können Nutzer miteinander interagieren? | **nein** |
| Wird der Standort geteilt? | nein |
| Können Nutzer Inhalte teilen, die andere sehen? | siehe unten |

> **Der einzige Punkt, der Nachdenken verlangt:** Nutzer *können* eine Liste als
> Datei verschicken. Aber nicht **innerhalb** der App – die App übergibt die Datei
> an das Teilen-Menü des Telefons und ist damit fertig. Es gibt keine Plattform,
> keine Sichtbarkeit für Dritte, keinen Feed, nichts zu moderieren.
> Die wahrheitsgemäße Antwort ist deshalb **nein** auf „nutzergenerierte Inhalte,
> die andere Nutzer sehen können".

Erwartetes Ergebnis: **USK ab 0 / PEGI 3.**

### 4.6 Zielgruppe und Inhalte

| Frage | Antwort |
|---|---|
| Altersgruppen | **18 und älter** |
| Ist die App für Kinder gestaltet? | **Nein** |

Damit greifen die „Families"-Richtlinien nicht.

### 4.7 Die restlichen Erklärungen

| Formular | Antwort |
|---|---|
| Nachrichten-App (SMS) | nein |
| Regierungs-App | nein |
| Finanzfunktionen | nein |
| Gesundheits-App | nein |
| Datensicherheit für Kinder | entfällt |

---

## 5. Interner Test

1. **Testerliste anlegen** – E-Mail-Adressen der Google-Konten. Es müssen die
   Adressen sein, mit denen die Tester im Play Store angemeldet sind, sonst
   sehen sie die App nicht.
2. **Release erstellen**, `app-release.aab` hochladen.
3. **Play App Signing bestätigen** – kommt beim ersten Upload automatisch
   (ADR-042).
4. **Versionshinweise** (`de-DE`):

```
Erste Fassung für den internen Test.

Listen anlegen, Artikel hinzufügen, einkaufen, teilen und sichern – alles
funktioniert. Vorschläge werden mit jedem abgeschlossenen Einkauf besser;
am Anfang sind sie noch leer.

Bitte meldet alles, was sich falsch anfühlt, nicht nur das, was abstürzt.
```

5. **Rollout starten.**
6. **Opt-in-Link** aus der Console kopieren und an die Tester schicken. Ohne
   diesen Link finden sie die App nicht – sie ist im Store nicht suchbar.

> Die Tester müssen den Link **einmal im Browser öffnen** und zustimmen, bevor
> der Play Store ihnen die App anbietet. Das ist der Schritt, an dem
> erfahrungsgemäß die meisten hängen bleiben – schreib ihn dazu.

---

## 6. Nicht für den internen Test nötig

Diese Aufgaben stehen in [`compliance.md`](compliance.md) auf **ÖV** und warten
auf eine öffentliche Veröffentlichung: C-8 (Testanforderungen der
Produktionsspur), C-10 (Crash-Reporting), C-11 (Anschrift – **hier aber schon
relevant**, weil die Datenschutzerklärung veröffentlicht wird).
