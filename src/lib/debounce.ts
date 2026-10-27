/**
 * Entprellen: Viele Ausloeser kurz hintereinander werden zu einem einzigen
 * Aufruf, der erst nach einer Ruhepause kommt ("letzter gewinnt").
 *
 * Eine kleine Klasse statt einer Bibliothek (CLAUDE.md: keine neue
 * Abhaengigkeit) und statt eines Hooks, damit sie ohne React pruefbar ist.
 * Die Zeit kommt aus setTimeout - in den Tests also aus Jests Fake-Timern.
 */
export class Debouncer {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly action: () => void,
    private readonly delayMs: number,
  ) {}

  /**
   * Plant den Aufruf in `delayMs`. Ist schon einer geplant, wird er auf
   * `delayMs` ab jetzt verschoben - zwei Ausloeser in der Wartezeit ergeben
   * also einen Aufruf, nicht zwei.
   */
  trigger(): void {
    this.schedule();
  }

  /**
   * Verschiebt einen schon geplanten Aufruf, plant aber selbst keinen.
   *
   * Fuer Ereignisse, die allein keinen Aufruf rechtfertigen, aber anzeigen,
   * dass "noch etwas im Gange ist" (siehe widgetRefresh.ts).
   */
  postpone(): void {
    if (this.timer !== null) {
      this.schedule();
    }
  }

  /** Verwirft einen geplanten Aufruf. Danach ist nichts mehr offen. */
  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Ob gerade ein Aufruf geplant ist. */
  get pending(): boolean {
    return this.timer !== null;
  }

  private schedule(): void {
    this.cancel();
    this.timer = setTimeout(() => {
      // Zuerst zuruecksetzen: Loest die Aktion selbst wieder etwas aus,
      // soll das als neuer Ausloeser zaehlen und nicht verschluckt werden.
      this.timer = null;
      this.action();
    }, this.delayMs);
  }
}
