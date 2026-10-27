package de.toshopping.widget

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews

/**
 * Baut aus einem WidgetContent die RemoteViews, die der Launcher zeichnet.
 *
 * Jeder Aufruf setzt JEDE View vollstaendig (Text und Sichtbarkeit): Der
 * Launcher wendet die RemoteViews auf ein frisch aufgeblasenes Layout an,
 * ein Zustand vom letzten Mal ist nicht verlaesslich vorhanden.
 *
 * Farben setzt der Code nie - sie kommen aus dem Layout, damit der Launcher
 * zwischen values und values-night waehlen kann.
 */
internal object WidgetViews {
  // Schema aus app.json ("scheme"), Route und Parameter aus ADR-030.
  private const val APP_SCHEME = "toshopping"
  private const val LIST_ROUTE = "liste"
  private const val LIST_ID_PARAM = "listId"

  private val ITEM_VIEW_IDS = intArrayOf(
    R.id.to_shopping_widget_item_1,
    R.id.to_shopping_widget_item_2,
    R.id.to_shopping_widget_item_3,
    R.id.to_shopping_widget_item_4,
    R.id.to_shopping_widget_item_5,
  )

  fun build(context: Context, content: WidgetContent): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.to_shopping_widget)

    when (content) {
      is WidgetContent.NoList -> {
        // Ohne Liste gibt es keinen Listennamen; der App-Name zeigt, wozu
        // das Widget gehoert.
        views.showText(R.id.to_shopping_widget_title, context.applicationInfo.loadLabel(context.packageManager))
        views.showText(R.id.to_shopping_widget_message, context.getString(R.string.to_shopping_widget_no_list))
        ITEM_VIEW_IDS.forEach { views.setViewVisibility(it, View.GONE) }
        views.setViewVisibility(R.id.to_shopping_widget_more, View.GONE)
      }

      is WidgetContent.OpenItems -> {
        views.showText(R.id.to_shopping_widget_title, content.listName)

        if (content.names.isEmpty()) {
          views.showText(R.id.to_shopping_widget_message, context.getString(R.string.to_shopping_widget_no_items))
        } else {
          views.setViewVisibility(R.id.to_shopping_widget_message, View.GONE)
        }

        ITEM_VIEW_IDS.forEachIndexed { index, viewId ->
          val name = content.names.getOrNull(index)
          if (name == null) views.setViewVisibility(viewId, View.GONE) else views.showText(viewId, name)
        }

        val hidden = content.openCount - content.names.size
        if (hidden > 0) {
          // Zahl zweimal: einmal zur Wahl der Form (one/other), einmal fuer %d.
          val more = context.resources.getQuantityString(R.plurals.to_shopping_widget_more, hidden, hidden)
          views.showText(R.id.to_shopping_widget_more, more)
        } else {
          views.setViewVisibility(R.id.to_shopping_widget_more, View.GONE)
        }
      }
    }

    val listId = (content as? WidgetContent.OpenItems)?.listId
    openAppIntent(context, listId)?.let { views.setOnClickPendingIntent(android.R.id.background, it) }
    return views
  }

  private fun RemoteViews.showText(viewId: Int, text: CharSequence) {
    setTextViewText(viewId, text)
    setViewVisibility(viewId, View.VISIBLE)
  }

  /**
   * Tipp auf das Widget: mit Liste deren Bildschirm (toshopping://liste?listId=...),
   * ohne Liste einfach die App.
   *
   * Ohne Liste bewusst der Launch-Intent und nicht "toshopping://" ohne Pfad:
   * Er ist genau das, was auch das App-Symbol ausloest. Beim Kaltstart landet
   * Expo Router damit auf der Startroute "/", und index.tsx leitet ohne Liste
   * auf die Uebersicht weiter, wo "Neue Liste" wartet. Laeuft die App schon,
   * kommt sie einfach nach vorn. Ein leerer Link dagegen wuerde bei laufender
   * App als Navigation nach "/" verarbeitet und legte die Weiterleitung auf
   * den bestehenden Verlauf - ein zweiter Weg mit eigenen Randfaellen fuer
   * denselben Zweck.
   */
  private fun openAppIntent(context: Context, listId: String?): PendingIntent? {
    val intent = if (listId != null) {
      val uri = Uri.Builder()
        .scheme(APP_SCHEME)
        .authority(LIST_ROUTE)
        .appendQueryParameter(LIST_ID_PARAM, listId)
        .build()
      // setPackage: Der Link soll in dieser App landen und nie einen
      // Auswahldialog oeffnen, auch wenn eine andere App dasselbe Schema
      // beansprucht.
      Intent(Intent.ACTION_VIEW, uri).setPackage(context.packageName)
    } else {
      context.packageManager.getLaunchIntentForPackage(context.packageName)
    } ?: return null

    // Der Start kommt vom Launcher, nicht aus einer Activity der App - ohne
    // NEW_TASK haette die Activity keine Aufgabe, in der sie laufen kann.
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    // IMMUTABLE: Der Launcher darf den Intent ausloesen, aber nicht
    // veraendern. Ab Android 12 Pflicht, vorher schlicht die sichere Wahl.
    return PendingIntent.getActivity(
      context,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }
}
