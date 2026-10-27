package de.toshopping.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent

/**
 * Der Receiver, den Android fuer das Widget aufruft - alle 30 Minuten
 * (to_shopping_widget_info.xml), beim Platzieren und nach refreshWidget()
 * aus der App.
 *
 * Laeuft im Prozess der App. Ein eigener Prozess (android:process) haette
 * saubere Dateisperren zwischen Widget und App gebracht, aber auch die
 * Kehrseite: Liest das Widget gerade, bekaeme ein Schreibvorgang der App
 * "database is locked", denn expo-sqlite wartet nicht auf Sperren. Ein
 * kurzzeitig falsch gelesenes Widget ist das kleinere Uebel als ein
 * gescheitertes Abhaken in der App.
 */
class ToShoppingWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    // null = gerade nicht lesbar: alte Anzeige stehen lassen, das naechste
    // Update holt es nach.
    val content = ListReader.read(context) ?: return
    // Alle Instanzen zeigen dieselbe Liste, ein RemoteViews reicht fuer alle.
    appWidgetManager.updateAppWidget(appWidgetIds, WidgetViews.build(context, content))
  }

  companion object {
    /**
     * Stoesst ein Update aller platzierten Widgets an.
     *
     * Als Broadcast statt direktem Zeichnen: Der Aufruf kommt aus dem
     * JavaScript-Thread nach einem Schreibvorgang. Der Broadcast kehrt sofort
     * zurueck, gelesen und gezeichnet wird spaeter in onUpdate - derselbe Weg
     * wie beim periodischen Update durch Android, es gibt also nur einen.
     */
    fun requestUpdate(context: Context) {
      val manager = AppWidgetManager.getInstance(context) ?: return
      val ids = manager.getAppWidgetIds(ComponentName(context, ToShoppingWidgetProvider::class.java))
      // Kein Widget platziert: nichts zu tun, kein Broadcast, kein Lesen.
      if (ids.isEmpty()) return

      val intent = Intent(context, ToShoppingWidgetProvider::class.java)
        .setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
        .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
      context.sendBroadcast(intent)
    }
  }
}
