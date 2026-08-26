# Manuelle Abnahme

Gate 5 aus `CLAUDE.md`: Was nur ein Mensch mit dem Gerät in der Hand beurteilen
kann. Die zwölf E2E-Flows prüfen, **ob** etwas funktioniert – diese Liste
prüft, ob es sich gut anfühlt.

Reihenfolge ist Absicht: Die riskantesten Punkte stehen oben.

---

## Vorbereitung

- [ ] Aktueller Release-Build installiert (`npm run android:release`)
- [ ] Telefon **nicht** im Stromsparmodus (verfälscht Animationen)

---

## 1. Tastatur — der wichtigste Punkt

Der Mechanismus dahinter wurde zweimal geändert (ADR-035, ADR-039), und beide
Male ohne Gerät. Auf dem Emulator trat der Fehler auf, auf dem S24 nie.

- [ ] Liste öffnen, unten ins Eingabefeld tippen
- [ ] **Das Eingabefeld bleibt sichtbar**, direkt über der Tastatur
- [ ] Ein paar Buchstaben tippen — die Vorschläge erscheinen darüber, nicht dahinter
- [ ] Einen Artikel antippen → Detailzeile öffnet sich → in die Notiz tippen
      → Notizfeld bleibt sichtbar
- [ ] In der Übersicht: „Neue Liste" → das Namensfeld im Dialog ist erreichbar
- [ ] Produkte → Suchfeld → Tastatur verdeckt die Trefferliste nicht

> Sollte hier etwas verschwinden: sofort melden. Das ist der Fehler, der die
> App in ihrer Hauptfunktion unbenutzbar macht.

## 2. Große Systemschrift

Einstellungen → Anzeige → Schriftgröße auf die **größte** Stufe.

- [ ] Listenzeilen: Namen brechen um statt abgeschnitten zu werden
- [ ] Ladenlayout: Kategorienamen vollständig lesbar, Zeilen wachsen mit
- [ ] Detailzeile: das Mengenfeld zeigt auch „1500" vollständig
- [ ] Übersicht: „3 offen" steht unter dem Listennamen, nicht abgeschnitten
- [ ] Knöpfe sind weiterhin sicher zu treffen

Danach Schriftgröße zurückstellen.

## 3. Dark Mode

Einstellungen → Anzeige → Dunkles Design **ein**.

- [ ] **Beim App-Start blitzt keine weiße Fläche auf** (in M12 behoben)
- [ ] Jeder Screen: kein heller Hintergrund mit heller Schrift
- [ ] Durchgestrichene Artikel bleiben lesbar
- [ ] Der grüne Akzent ist erkennbar, nicht grell
- [ ] Dialoge und Menüs sind dunkel, nicht weiß

Dasselbe im hellen Modus durchgehen.

## 4. Anfassen — Gefühl statt Funktion

- [ ] Über einen Artikel wischen: Der Strich wächst wie mit einem Stift von
      links nach rechts, nicht sprunghaft
- [ ] Das haptische Klopfen ist spürbar, aber nicht aufdringlich
- [ ] Zurückwischen (Haken entfernen) fühlt sich leichter an als Abhaken
- [ ] **Einhändig, Daumen:** Eingabefeld, Abhaken und „Einkauf abschließen"
      sind ohne Umgreifen erreichbar
- [ ] Ladenlayout: Zeile am Griff **gedrückt halten**, dann ziehen. Die anderen
      Zeilen weichen sichtbar aus, die gezogene liegt mit Schatten obenauf
- [ ] „Rückgängig" nach dem Abhaken: Bleibt der Hinweis lang genug stehen, um
      ihn in Ruhe zu treffen? (In M12 von 4 auf 7 Sekunden verlängert)

## 5. Teilen an ein zweites Gerät — FR-6.1 bis FR-6.3

Braucht ein zweites Telefon mit installierter App.

- [ ] Liste → Menü → „Liste teilen" → der Hinweis auf die Kopie erscheint
      **einmalig**
- [ ] Über WhatsApp an das zweite Gerät schicken
- [ ] Dort: Ist der **lesbare Text** in der Nachricht brauchbar? (Das ist der
      Fall für Empfänger ohne App)
- [ ] Datei antippen → öffnet sich To-Shopping mit einer Vorschau?
      **Falls nicht:** In der App auf „Liste empfangen" gehen und die Datei
      selbst auswählen — das ist der vorgesehene zweite Weg (ADR-032)
- [ ] Nach dem Übernehmen: neue Liste mit Datum im Namen, alle Artikel da,
      Mengen und Notizen stimmen

## 6. Sicherung — die Gegenmaßnahme zu Risiko R3

**Der wichtigste Test überhaupt, und der einzige, der nicht automatisiert ist.**

- [ ] Mehrere Listen mit Artikeln anlegen, ein paar Einkäufe abschließen
- [ ] Übersicht → Menü → Sicherung → „Sicherung erstellen"
- [ ] Datei **an einen sicheren Ort** schicken (eigene Cloud, E-Mail an sich selbst)
- [ ] **App deinstallieren**
- [ ] App neu installieren
- [ ] Sicherung → „Datei auswählen" → die gesicherte Datei
- [ ] Die Warnung nennt Zeilenzahl und Datum
- [ ] Nach dem Zurückspielen: **alle Listen, Artikel, Mengen, Notizen,
      Ladenlayouts und Vorlagen sind wieder da**

## 7. Katalog und Vorlagen

- [ ] Produkte → ein mitgeliefertes Produkt umbenennen, es bleibt umbenannt
- [ ] Ein Produkt löschen, das auf einer Liste steht → der Listeneintrag bleibt
- [ ] „Katalog zurücksetzen" → gelöschte mitgelieferte Produkte sind zurück,
      **eigene Produkte unangetastet**
- [ ] Liste → Menü → „Als Vorlage speichern"
- [ ] Auf eine Liste anwenden, auf der schon etwas davon steht → nichts doppelt

## 8. Vorschläge — nur über Wochen beurteilbar

Nicht heute abzuhaken. Nach ein paar echten Einkäufen:

- [ ] Beim Antippen des leeren Feldes stehen die richtigen Artikel oben
- [ ] Beim Tippen von „mil" kommt zuerst die Milch, die **du** kaufst
- [ ] Etwas, das lange her ist, rutscht spürbar nach unten

---

## Ergebnis

| | |
|---|---|
| Datum | |
| Gerät, Android-Version | |
| Punkte 1–7 abgehakt | |
| Gefundene Mängel | |

Gefundene Mängel gehören als Notiz gesammelt, nicht sofort behoben — außer
Punkt 1 und 6, die sind blockierend.
