package de.toshopping.widget

import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Die Bruecke zur App: stellt JavaScript genau eine Funktion bereit,
 * refreshWidget() (ADR-045). Der Name "ToShoppingWidget" muss zu
 * src/ToShoppingWidgetModule.ts passen.
 */
class ToShoppingWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ToShoppingWidget")

    Function("refreshWidget") { refreshWidget() }
  }

  private fun refreshWidget() {
    val context = appContext.reactContext?.applicationContext ?: return
    try {
      ToShoppingWidgetProvider.requestUpdate(context)
    } catch (e: RuntimeException) {
      // Ein Widget, das nicht nachzieht, ist aergerlich; ein Abhaken, das
      // deswegen in der App mit Fehler endet, waere schlimmer. Deshalb
      // wird hier nichts an JavaScript weitergereicht.
      Log.w("ToShoppingWidget", "Widget-Update fehlgeschlagen", e)
    }
  }
}
