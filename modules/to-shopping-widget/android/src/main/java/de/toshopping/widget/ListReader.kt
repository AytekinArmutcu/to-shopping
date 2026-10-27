package de.toshopping.widget

import android.content.Context
import android.database.DatabaseErrorHandler
import android.database.DatabaseUtils
import android.database.sqlite.SQLiteDatabase
import android.util.Log
import java.io.File

/**
 * Liest die offenen Artikel der zuletzt geoeffneten Liste - nur lesend
 * (FR-11.5, ADR-045).
 *
 * Diese Datei ist die zweite Stelle im Projekt, die das Schema kennt: Wer
 * lists oder list_items umbaut, muss die drei Abfragen hier mitpruefen.
 */
internal object ListReader {
  private const val TAG = "ToShoppingWidget"

  // Ablageort wie in expo-sqlite (SQLiteModule.kt, "defaultDatabaseDirectory"):
  // <filesDir>/SQLite/<Name>. Bewusst nicht context.getDatabasePath() - das
  // zeigt auf <dataDir>/databases/, und dort liegt die Datei der App nicht.
  private const val DATABASE_DIRECTORY = "SQLite"

  // Muss zu DATABASE_NAME in src/db/client.ts passen.
  private const val DATABASE_NAME = "to-shopping.db"

  /** Mehr Zeilen hat das Layout nicht. */
  const val MAX_ITEMS = 5

  // SQLite sortiert NULL als kleinsten Wert, bei DESC landen nie geoeffnete
  // Listen also von selbst hinten. "NULLS LAST" saehe deutlicher aus, kennt
  // das System-SQLite von Android aber erst ab Version 3.30 (Android 11 hat
  // 3.28, die App laeuft ab Android 7) - die Abfrage wuerde dort scheitern.
  private const val SQL_LAST_OPENED_LIST =
    "SELECT id, name FROM lists ORDER BY last_opened_at DESC, created_at DESC LIMIT 1"

  private const val SQL_OPEN_ITEM_NAMES =
    "SELECT name FROM list_items WHERE list_id = ? AND is_checked = 0 " +
      "ORDER BY position LIMIT $MAX_ITEMS"

  private const val SQL_OPEN_ITEM_COUNT =
    "SELECT COUNT(*) FROM list_items WHERE list_id = ? AND is_checked = 0"

  // Androids Standard-Handler LOESCHT die Datenbankdatei, sobald SQLite
  // "beschaedigt" meldet. Das kann hier auch ohne echten Schaden passieren:
  // Das Widget liest mit dem SQLite des Systems, die App schreibt mit dem
  // eigenen von expo-sqlite - zwei Bibliotheken im selben Prozess sperren
  // sich gegenseitig nicht, das Widget kann also eine halb geschriebene
  // Seite erwischen. Ein leerer Handler laesst die Datei in Ruhe; der Fehler
  // kommt trotzdem als Exception an und wird unten abgefangen.
  private val KEEP_FILE_ON_ERROR = DatabaseErrorHandler { }

  /**
   * Liefert den Inhalt fuer das Widget, oder null, wenn das Lesen gerade
   * nicht klappt (Datei gesperrt, Migration laeuft noch, ...). Bei null bleibt
   * die bisherige Anzeige stehen - besser ein paar Minuten alt als ein
   * falsches "Noch keine Liste".
   */
  fun read(context: Context): WidgetContent? {
    val file = File(File(context.filesDir, DATABASE_DIRECTORY), DATABASE_NAME)
    // App noch nie gestartet: keine Datei, kein Fehler.
    if (!file.exists()) return WidgetContent.NoList

    return try {
      // OPEN_READONLY: Das Widget schreibt nie, auch nicht versehentlich.
      // NO_LOCALIZED_COLLATORS: Sonst legt Android beim Oeffnen gern eine
      // eigene Tabelle android_metadata an - in einer fremden Datenbank
      // hat sie nichts verloren.
      SQLiteDatabase.openDatabase(
        file.path,
        null,
        SQLiteDatabase.OPEN_READONLY or SQLiteDatabase.NO_LOCALIZED_COLLATORS,
        KEEP_FILE_ON_ERROR,
      ).use { db -> query(db) }
    } catch (e: RuntimeException) {
      // Vor allem SQLiteException (gesperrt, Tabelle fehlt noch, weil die
      // Migration laeuft). Bewusst aber jede RuntimeException: Der Receiver
      // laeuft im Prozess der App, eine Exception hier wuerde die App
      // mitreissen - womoeglich, waehrend der Nutzer gerade darin einkauft.
      Log.w(TAG, "Datenbank fuer das Widget nicht lesbar", e)
      null
    }
  }

  private fun query(db: SQLiteDatabase): WidgetContent {
    val (listId, listName) = db.rawQuery(SQL_LAST_OPENED_LIST, null).use { cursor ->
      if (!cursor.moveToFirst()) return WidgetContent.NoList
      cursor.getString(0) to cursor.getString(1)
    }

    val args = arrayOf(listId)
    val names = db.rawQuery(SQL_OPEN_ITEM_NAMES, args).use { cursor ->
      buildList {
        while (cursor.moveToNext()) add(cursor.getString(0))
      }
    }
    val openCount = DatabaseUtils.longForQuery(db, SQL_OPEN_ITEM_COUNT, args).toInt()

    // Zwei getrennte Abfragen koennen sich bei einem gleichzeitigen
    // Schreibvorgang widersprechen; dann lieber kein negatives "+ n".
    return WidgetContent.OpenItems(listId, listName, names, maxOf(openCount, names.size))
  }
}
