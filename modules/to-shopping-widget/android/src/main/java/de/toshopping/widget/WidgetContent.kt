package de.toshopping.widget

/**
 * Was das Widget anzeigen soll - getrennt davon, wie es gezeichnet wird
 * (WidgetViews) und woher es kommt (ListReader). So bleibt jede der drei
 * Dateien fuer sich lesbar.
 */
internal sealed class WidgetContent {
  /** Datenbank fehlt (App nie gestartet) oder es gibt keine einzige Liste. */
  object NoList : WidgetContent()

  /**
   * Die zuletzt geoeffnete Liste.
   *
   * names enthaelt hoechstens ListReader.MAX_ITEMS Eintraege, openCount zaehlt
   * alle offenen - die Differenz ist das "+ n weitere".
   */
  data class OpenItems(
    val listId: String,
    val listName: String,
    val names: List<String>,
    val openCount: Int,
  ) : WidgetContent()
}
