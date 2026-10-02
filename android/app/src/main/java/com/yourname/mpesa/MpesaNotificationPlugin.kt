package com.yourname.mpesa

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "MpesaNotification")
class MpesaNotificationPlugin : Plugin() {

    companion object {
        @JvmStatic
        var pendingOpenMessages = false
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "messages",
                "Messages",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "MPESA message notifications"
            }

            val manager = context.getSystemService(
                NotificationManager::class.java
            )

            manager.createNotificationChannel(channel)
        }
    }

    @PluginMethod
    fun show(call: PluginCall) {

        // Make sure the notification channel exists
        createNotificationChannel()

        val title = call.getString("title") ?: "MPESA"
        val body = call.getString("body") ?: ""
        val notifId = call.getInt("id")
            ?: (System.currentTimeMillis() % 1000000).toInt()

        try {
            val style = NotificationCompat.BigTextStyle()
                .bigText(body)

            val openIntent = Intent(
                context,
                MainActivity::class.java
            ).apply {
                flags =
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP

                putExtra("openMessages", true)
            }

            val pendingIntent = PendingIntent.getActivity(
                context,
                notifId,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or
                PendingIntent.FLAG_IMMUTABLE
            )

            val notification =
                NotificationCompat.Builder(
                    context,
                    "messages"
                )
                    .setSmallIcon(
                        R.drawable.ic_notification_person
                    )
                    .setStyle(style)
                    .setAutoCancel(true)
                    .setPriority(
                        NotificationCompat.PRIORITY_HIGH
                    )
                    .setCategory(
                        NotificationCompat.CATEGORY_MESSAGE
                    )
                    .setContentIntent(pendingIntent)
                    .setDefaults(
                        NotificationCompat.DEFAULT_ALL
                    )
                    .build()

            NotificationManagerCompat
                .from(context)
                .notify(notifId, notification)

            call.resolve()

        } catch (e: SecurityException) {
            call.reject(
                "Notification permission not granted",
                e
            )
        } catch (e: Exception) {
            call.reject(
                "Failed to show notification: ${e.message}",
                e
            )
        }
    }

    @PluginMethod
    fun consumeOpenMessages(call: PluginCall) {
        val ret = JSObject()

        ret.put(
            "open",
            pendingOpenMessages
        )

        pendingOpenMessages = false

        call.resolve(ret)
    }
}