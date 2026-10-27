# To-Shopping

Eine Einkaufslisten-App für Android, die sich merkt, was der Nutzer kauft – damit die Liste nie wieder von vorne geschrieben werden muss.
Alle Daten bleiben lokal auf dem Gerät: kein Backend, keine Konten, kein Tracking. Geteilt wird über Dateien im Android-Teilen-Menü.
Es ist ein Lernprojekt: Der Code entsteht KI-gestützt, das Ziel des Auftraggebers ist zu verstehen, **warum** etwas so gebaut wurde.

## Kommandos

```bash
npm start           # Expo-Entwicklungsserver
npm run android     # lokaler Android-Build auf dem angeschlossenen Gerät
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint + Prettier
npm test            # Jest
npm run e2e         # Maestro-Flows
npm run db:generate # Drizzle-Migration nach einer Schemaänderung erzeugen
```

## Quality Gates

Eine Aufgabe ist erst fertig, wenn **alle fünf** Punkte erfüllt sind:

1. `npm run typecheck` grün
2. `npm run lint` grün
3. `npm test` grün – Unit-Tests sind **verpflichtend** für jede Datei `features/*/logic.ts`
4. `npm run e2e` grün
5. Manuelle Abnahme auf dem Samsung Galaxy S24, **hell und dunkel**

Nie „sollte funktionieren" behaupten. Prüfungen ausführen und die echte Ausgabe zeigen.

## Arbeitsweise

- Abnahme erfolgt **pro Meilenstein**, nicht pro Task (siehe `docs/roadmap.md`).
- Zu jedem abgeschlossenen Meilenstein gehört eine schriftliche Erklärung: **was wurde gebaut, warum so, welche Alternative gab es.** Das ist das eigentliche Lernziel, kein Beiwerk.
- Führt eine Aufgabe zu einer neuen Architekturentscheidung, kommt ein ADR in `docs/decisions.md` dazu.
- Widersprechen, wenn ein Wunsch den V1-Umfang sprengt, gegen ein Nicht-Ziel verstößt oder eine getroffene Entscheidung untergräbt.

## Code-Konventionen

**Schichten – verbindlich:**

```
Screen (app/) → Repository (features/*/repository.ts) → Drizzle → SQLite
                       ↑
                 Logic (features/*/logic.ts) – rein, ohne DB, voll getestet
```

1. **Screens greifen nie direkt auf die Datenbank zu.** Nur über Repository-Funktionen.
2. **Fachlogik kennt die Datenbank nicht.** Sortierung, Ranking, Formatprüfung sind reine Funktionen: Eingabe rein, Ergebnis raus.
3. **Der Zustand-Store hält keine Daten.** Nur UI-Zustand (aktive Liste, „erledigte anzeigen", Suchtext). Daten kommen aus der DB.
4. **Kein sichtbarer Text im Code.** Alle Texte in `src/i18n/locales/de.json`.
5. **Keine Testdateien unter `app/`.** Alles dort ist eine Route und wird ins App-Bundle gebündelt – eine Testdatei bringt die App zum Absturz, ohne dass Typecheck, Lint oder Unit-Tests etwas merken. Tests liegen neben ihrem Code in `src/`.

**Weitere Regeln:**

- TypeScript strict. Kein `any`, kein `@ts-ignore` ohne begründeten Kommentar.
- Zusammengesetzte Schreibvorgänge laufen in einer **Transaktion** (Einkauf abschließen, Import, Wiederherstellung).
- **Migrationen werden nie nachträglich geändert**, auch nicht während der Entwicklung. Nur neue ergänzen.
- Feste Einheiten als TypeScript-Union, nicht als Tabelle: `stueck | g | kg | ml | l | packung | bund | dose`.
- Listeneinträge speichern den Produktnamen als **Kopie** (siehe ADR-007). Bewusste Denormalisierung, nicht korrigieren.
- Jedes Bedienelement: mindestens 48 × 48 dp, `accessibilityLabel`, und jede Wischgeste hat eine Antipp-Alternative.
- Material-3-Farbrollen nicht mit eigenen Farbwerten überschreiben.
- Keine neue Abhängigkeit ohne Rückfrage. Insbesondere: kein Analytics-, Crash- oder Werbe-SDK.
- Keine Secrets im Repo. `.env` ist ignoriert, `.env.example` gepflegt.

## Grenzen von V1

Nicht bauen, auch nicht „schnell nebenbei": Live-Sync, Konten, iOS, Widget, Barcode-Scan, Benachrichtigungen, Standort, Werbung, In-App-Käufe, Crash-Reporting bei Dritten, Cloud-Backup, Produktbilder, Preise, Rezepte, englische Texte.

Vollständige Liste mit Begründungen: `docs/PRD.md`, Abschnitt 6.

## Dokumentation

| Datei | Inhalt |
|---|---|
| `docs/PRD.md` | Problem, Zielgruppe, User-Flows, Anforderungen (FR-1 bis FR-8 für V1, FR-9 bis FR-11 für V2), Nicht-Ziele, Erfolgskriterien |
| `docs/architecture.md` | Stack, Datenmodell, Algorithmen, Dateiformate, Ordnerstruktur |
| `docs/decisions.md` | 47 ADRs: warum so, was wurde verworfen, was kostet es |
| `docs/compliance.md` | Datenschutz, Play-Console-Pflichten, offene Aufgaben C-1 bis C-12 |
| `docs/datenschutz.md` | Entwurf der Datenschutzerklärung (C-2), Lücken mit `[…]` markiert |
| `docs/abnahme.md` | Prüfliste für die manuelle Abnahme (Gate 5) |
| `docs/store-eintrag.md` | Texte und fertige Formularantworten für die Play Console |
| `docs/roadmap.md` | 16 Meilensteine (M0–M12 V1, M13–M15 V2), Tasks mit Akzeptanzkriterien |

Inhalte gehören in `docs/`. Diese Datei bleibt schlank und verweist.
