package com.vibequeue.school_kiosk

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Auto-launches the app after the device reboots — the manifest already
 * declares `RECEIVE_BOOT_COMPLETED` (see AndroidManifest.xml); this is the
 * receiver that was left as a TODO alongside it. A kiosk/display tablet that
 * loses power overnight must come back up on its own with nobody there to
 * unlock and tap the launcher icon.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        val launch = Intent(context, MainActivity::class.java)
        launch.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP
        )
        context.startActivity(launch)
    }
}
