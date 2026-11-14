# Datenschutzerklärung für To-Shopping

> **Entwurf – vor der Veröffentlichung auszufüllen und zu prüfen.**
>
> Drei Dinge fehlen und können nur vom Verantwortlichen ergänzt werden
> (Compliance-Aufgabe **C-1**): Name, Anschrift und Kontakt-E-Mail. Sie sind
> unten als `[…]` markiert.
>
> V1 wird **ohne OTA-Updates** ausgeliefert (ADR-040). Damit gibt es keine
> einzige Stelle, an der diese App von sich aus mit einem Server spricht. Der
> frühere Abschnitt zu automatischen Updates ist deshalb entfallen. Käme OTA
> später dazu, wäre er wieder aufzunehmen – zusammen mit Compliance-Aufgabe
> C-4.
>
> Dieser Entwurf ist keine Rechtsberatung. Er folgt der Gliederung aus
> `compliance.md`, Abschnitt 3.2.
>
> **Veröffentlichte Fassung:** `docs/index.html`, Abschnitt „Datenschutzerklärung"
> (Anker `#datenschutz`). Ändert sich der Text, ändert er sich in beiden
> Dateien – diese hier ist die, die im Repository gelesen wird, die HTML-Seite
> die, die veröffentlicht wird.
>
> **Stand dieses Entwurfs:** 14. November 2026 (V2: Vorrat, Rezepte, Widget,
> Abschnitt zur Webseite)

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
Produkte, Kategorien, Vorrat, Rezepte, Wochenplan und deine Kaufhistorie –
werden ausschließlich in einer Datenbank **auf deinem Gerät** gespeichert. Sie
werden nicht an den Entwickler und nicht an Dritte übertragen.

Es gibt keine Registrierung, keine Anmeldung und kein Benutzerkonto.

Das Widget für den Startbildschirm liest die offenen Artikel direkt aus dieser
Datenbank auf deinem Gerät. Auch dafür wird keine Verbindung aufgebaut.

## 3. Fehlerberichte

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

## 4. Teilen und Sichern

Die App kann Listen und vollständige Sicherungen als Datei erzeugen und an das
Teilen-Menü deines Telefons übergeben.

Ob und wohin diese Datei geht, entscheidest ausschließlich du. Der Entwickler
erhält sie nicht. Sobald du die Datei über eine andere App verschickst – etwa
einen Messenger, eine E-Mail-App oder einen Cloud-Speicher – gilt für diesen
Vorgang die Datenschutzerklärung der jeweiligen App.

## 5. Berechtigungen

Die App fordert **keine Laufzeitberechtigungen** an. Kein Zugriff auf
Standort, Kamera, Kontakte, Mikrofon oder Dateien. Auch das Widget braucht
keine Berechtigung.

Im Android-Manifest stehen lediglich zwei technische Einträge: Vibration (für
die kurze Rückmeldung beim Abhaken) und Internetzugang.

Der Internetzugang wird von der App **nicht genutzt**. Er steht im Manifest,
weil eine der eingesetzten Programmbibliotheken ihn dort einträgt. Die App
baut von sich aus keine Verbindung auf – es gibt keinen Server, keine
Update-Abfrage und keine Statistik.

## 6. Keine Werbung, kein Tracking

Die App enthält:

- keine Werbung,
- kein Tracking und keine Analyse-Werkzeuge,
- keine Profilbildung,
- keine In-App-Käufe,
- keine Weitergabe von Daten an Dritte zu Werbezwecken.

## 7. Deine Rechte

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

Der Verantwortliche hat keinen Zugriff auf deine Daten und kann dir deshalb
auch keine Auskunft darüber geben – es liegt schlicht nichts vor.

## 8. Google Play als Vertriebsweg

Die App wird über Google Play verteilt. Google verarbeitet dabei eigenständig
Daten – etwa zu Installation, Aktualisierung und Absturzstatistik des
Play-Store-Dienstes. Darauf hat der Entwickler dieser App keinen Einfluss.

Es gilt die Datenschutzerklärung von Google:
<https://policies.google.com/privacy>

## 9. Diese Webseite

Diese Seite wird über GitHub Pages ausgeliefert. Beim Abruf verarbeitet GitHub
technisch notwendige Verbindungsdaten wie die IP-Adresse; es gilt die
[Datenschutzerklärung von GitHub](https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement).
Die Seite selbst setzt keine Cookies, lädt keine fremden Inhalte nach und
misst nichts. Die Wahl zwischen hell und dunkel wird nur in deinem Browser
gespeichert.

## 10. Stand und Änderungen

Diese Datenschutzerklärung hat den Stand **[Datum der Veröffentlichung]**.

Ändert sich die App so, dass diese Angaben nicht mehr stimmen, wird die
Erklärung angepasst und das Datum aktualisiert.
