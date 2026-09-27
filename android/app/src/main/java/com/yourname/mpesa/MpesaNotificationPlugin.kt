package com.yourname.mpesa

import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.graphics.drawable.IconCompat
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

    @PluginMethod
    fun show(call: PluginCall) {
        val title = call.getString("title") ?: "MPESA"
        val body = call.getString("body") ?: ""
        val notifId = call.getInt("id") ?: (System.currentTimeMillis() % 1000000).toInt()

        try {
            val icon = IconCompat.createWithResource(context, R.drawable.ic_profile_avatar)

            val sender = Person.Builder()
                .setName(title)
                .setIcon(icon)
                .build()

            val me = Person.Builder().setName("Me").build()

            val style = NotificationCompat.MessagingStyle(me)
                .addMessage(body, System.currentTimeMillis(), sender)

            val openIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("openMessages", true)
            }

            val pendingIntent = PendingIntent.getActivity(
                context,
                notifId,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = NotificationCompat.Builder(context, "messages")
                .setSmallIcon(R.drawable.ic_notification_person)
                .setStyle(style)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setContentIntent(pendingIntent)
                .build()

            NotificationManagerCompat.from(context).notify(notifId, notification)
            call.resolve()
        } catch (e: SecurityException) {
            call.reject("Notification permission not granted", e)
        }
    }

    @PluginMethod
    fun consumeOpenMessages(call: PluginCall) {
        val ret = JSObject()
        ret.put("open", pendingOpenMessages)
        pendingOpenMessages = false
        call.resolve(ret)
    }
}