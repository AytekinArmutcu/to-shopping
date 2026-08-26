# Datenschutzerklärung für To-Shopping

> **Entwurf – vor der Veröffentlichung auszufüllen und zu prüfen.**
>
> Drei Dinge fehlen und können nur vom Verantwortlichen ergänzt werden
> (Compliance-Aufgabe **C-1**): Name, Anschrift und Kontakt-E-Mail. Sie sind
> unten als `[…]` markiert.
>
> Ein weiterer Punkt ist offen (**C-4**): Abschnitt 3 beschreibt die
> automatischen Updates. Ob und in welcher Form die Update-Abfrage im
> Data-Safety-Formular als Datenerhebung zu deklarieren ist, hängt von der
> aktuellen Expo-Dokumentation ab. **Solange OTA-Updates nicht eingerichtet
> sind, ist Abschnitt 3 ersatzlos zu streichen** – eine Datenschutzerklärung,
> die mehr behauptet, als geschieht, ist genauso falsch wie eine, die
> verschweigt.
>
> Dieser Entwurf ist keine Rechtsberatung. Er folgt der Gliederung aus
> `compliance.md`, Abschnitt 3.2.
>
> **Stand dieses Entwurfs:** 26. August 2026

---

## 1. Verantwortlicher

Verantwortlich für die Datenverarbeitung im Sinne der DSGVO ist:

```
[Vor- und Nachname]
[Straße und Hausnummer]
[Postleitzahl und Ort]
Deutschland

E-Mail: [kontakt@example.de]
```

## 2. Grundsatz: Deine Daten bleiben auf deinem Gerät

To-Shopping ist eine Einkaufslisten-App **ohne Konto und ohne Server**.

Alle Inhalte, die du in der App anlegst – Listen, Artikel, Mengen, Notizen,
Produkte, Kategorien und deine Kaufhistorie – werden ausschließlich in einer
Datenbank **auf deinem Gerät** gespeichert. Sie werden nicht an den
Entwickler und nicht an Dritte übertragen.

Es gibt keine Registrierung, keine Anmeldung und kein Benutzerkonto.

## 3. Automatische Updates

> *Dieser Abschnitt gilt nur, wenn OTA-Updates eingerichtet sind. Andernfalls
> ersatzlos streichen.*

Die App prüft beim Start, ob eine neue Fassung ihres Programmcodes vorliegt.
Diese Abfrage geht an einen Dienst des Anbieters **Expo** (Expo, Inc., USA).

- **Übertragen werden:** die installierte App-Version, die Plattform
  (Android), die Version des Betriebssystems und – technisch unvermeidbar –
  deine IP-Adresse.
- **Nicht übertragen werden:** Listeninhalte, Produktnamen, Notizen oder
  irgendetwas anderes, das du in der App eingegeben hast.
- **Zweck:** Fehlerbehebungen und Verbesserungen ausliefern, ohne dass du ein
  Update aus dem Play Store installieren musst.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an
  der Fehlerfreiheit und Sicherheit der App).
- **Drittlandbezug:** Die Verarbeitung findet in den USA statt. Die
  Übertragung erfolgt verschlüsselt (HTTPS).

## 4. Fehlerberichte

Stürzt die App ab, schreibt sie einen technischen Bericht **auf dein Gerät**.
Er enthält den Zeitpunkt, die App-Version, die Android-Version, das
Gerätemodell, die Fehlermeldung und die technische Aufrufkette. Höchstens die
letzten 20 Berichte werden aufbewahrt.

**Diese Berichte werden nicht automatisch versendet.** Sie verlassen dein
Gerät nur, wenn du in der App unter *Diagnose* ausdrücklich „An den
Entwickler senden" auswählst. Dann öffnet sich das Teilen-Menü deines
Telefons, und du entscheidest selbst, ob und worüber du den Bericht
verschickst.

Die Berichte enthalten **keine Listeninhalte und keine Produktnamen**.

Es wird kein Fehlerdienst eines Drittanbieters eingesetzt.

## 5. Teilen und Sichern

Die App kann Listen und vollständige Sicherungen als Datei erzeugen und an das
Teilen-Menü deines Telefons übergeben.

Ob und wohin diese Datei geht, entscheidest ausschließlich du. Der Entwickler
erhält sie nicht. Sobald du die Datei über eine andere App verschickst – etwa
einen Messenger, eine E-Mail-App oder einen Cloud-Speicher – gilt für diesen
Vorgang die Datenschutzerklärung der jeweiligen App.

## 6. Berechtigungen

Die App fordert **keine Laufzeitberechtigungen** an. Kein Zugriff auf
Standort, Kamera, Kontakte, Mikrofon oder Dateien.

Im Android-Manifest stehen lediglich zwei technische Einträge: Internetzugang
(für die Update-Abfrage aus Abschnitt 3) und Vibration (für die kurze
Rückmeldung beim Abhaken).

## 7. Keine Werbung, kein Tracking

Die App enthält:

- keine Werbung,
- kein Tracking und keine Analyse-Werkzeuge,
- keine Profilbildung,
- keine In-App-Käufe,
- keine Weitergabe von Daten an Dritte zu Werbezwecken.

## 8. Deine Rechte

Nach der DSGVO hast du das Recht auf Auskunft, Berichtigung, Löschung,
Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch.

In der Praxis sieht das bei dieser App so aus:

- **Auskunft und Übertragbarkeit:** Alle deine Daten liegen auf deinem Gerät.
  Über *Sicherung* kannst du sie jederzeit vollständig als Datei exportieren.
- **Löschung:** Deinstalliere die App. Damit sind alle Daten gelöscht. Es gibt
  keine Kopie beim Entwickler, die zu löschen wäre.
- **Beschwerde:** Du kannst dich bei einer Datenschutz-Aufsichtsbehörde
  beschweren, in der Regel bei der Behörde deines Bundeslandes.

Für Anliegen erreichst du den Verantwortlichen unter der in Abschnitt 1
genannten E-Mail-Adresse.

## 9. Google Play als Vertriebsweg

Die App wird über Google Play verteilt. Google verarbeitet dabei eigenständig
Daten – etwa zu Installation, Aktualisierung und Absturzstatistik des
Play-Store-Dienstes. Darauf hat der Entwickler dieser App keinen Einfluss.

Es gilt die Datenschutzerklärung von Google:
<https://policies.google.com/privacy>

## 10. Stand und Änderungen

Diese Datenschutzerklärung hat den Stand **[Datum der Veröffentlichung]**.

Ändert sich die App so, dass diese Angaben nicht mehr stimmen, wird die
Erklärung angepasst und das Datum aktualisiert.
