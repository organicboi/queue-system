package com.vibequeue.school_kiosk

import android.Manifest
import android.app.Activity
import android.app.PendingIntent
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.PluginRegistry.RequestPermissionsResultListener
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID
import java.util.concurrent.Executors

/**
 * Backs `lib/src/printing/transport/native_printer_channel.dart`. Two jobs
 * Dart's `dart:io` cannot do on Android: enumerate/talk to a USB *printer
 * class* device (interface class 0x07 — not the CDC/serial class a generic
 * USB-serial plugin looks for), and open a classic Bluetooth SPP socket.
 *
 * Holds exactly one open connection at a time (USB xor Bluetooth) — this app
 * only ever has one printer configured per device, so a handle-per-connection
 * API would be complexity with no caller that needs it.
 */
class PrinterPlugin :
    FlutterPlugin,
    ActivityAware,
    MethodChannel.MethodCallHandler,
    RequestPermissionsResultListener {
    companion object {
        private const val TAG = "PrinterPlugin"
        private const val CHANNEL = "com.vibequeue.school_kiosk/printer"
        private const val ACTION_USB_PERMISSION = "com.vibequeue.school_kiosk.USB_PERMISSION"
        private const val BLUETOOTH_PERMISSION_REQUEST_CODE = 4321
        private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    }

    private var channel: MethodChannel? = null
    private var activity: Activity? = null
    private var activityBinding: ActivityPluginBinding? = null
    private val io = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())

    // ── USB state ────────────────────────────────────────────
    private var usbConnection: UsbDeviceConnection? = null
    private var usbOut: UsbEndpoint? = null
    private var usbIn: UsbEndpoint? = null
    private var usbInterface: UsbInterface? = null

    // ── Bluetooth state ──────────────────────────────────────
    private var btSocket: BluetoothSocket? = null
    private var btOut: OutputStream? = null
    private var btIn: InputStream? = null

    private var pendingUsbPermission: MethodChannel.Result? = null
    private var usbPermissionReceiver: BroadcastReceiver? = null
    private var pendingBtPermission: MethodChannel.Result? = null

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        channel = MethodChannel(binding.binaryMessenger, CHANNEL)
        channel?.setMethodCallHandler(this)
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        channel?.setMethodCallHandler(null)
        channel = null
        closeAll()
    }

    override fun onAttachedToActivity(binding: ActivityPluginBinding) {
        activity = binding.activity
        activityBinding = binding
        binding.addRequestPermissionsResultListener(this)
    }

    override fun onDetachedFromActivityForConfigChanges() = detachActivity()
    override fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding) {
        activity = binding.activity
        activityBinding = binding
        binding.addRequestPermissionsResultListener(this)
    }
    override fun onDetachedFromActivity() = detachActivity()

    private fun detachActivity() {
        activityBinding?.removeRequestPermissionsResultListener(this)
        activityBinding = null
        activity = null
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ): Boolean {
        if (requestCode != BLUETOOTH_PERMISSION_REQUEST_CODE) return false
        val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
        pendingBtPermission?.success(granted)
        pendingBtPermission = null
        return true
    }

    /**
     * BLUETOOTH_CONNECT is a runtime permission from API 31 onward — without
     * requesting it, `listBonded`/`openBt` would silently return nothing
     * forever (see the SecurityException catch in `listBonded`). Below 31,
     * the legacy BLUETOOTH/BLUETOOTH_ADMIN manifest permissions are enough
     * and there is nothing to request at runtime.
     */
    private fun requestBluetoothPermission(result: MethodChannel.Result) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            result.success(true)
            return
        }
        val act = activity
        if (act == null) {
            result.success(false)
            return
        }
        if (ContextCompat.checkSelfPermission(act, Manifest.permission.BLUETOOTH_CONNECT) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            result.success(true)
            return
        }
        pendingBtPermission = result
        ActivityCompat.requestPermissions(
            act,
            arrayOf(Manifest.permission.BLUETOOTH_CONNECT),
            BLUETOOTH_PERMISSION_REQUEST_CODE,
        )
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "listUsb" -> result.success(listUsb())
            "listBonded" -> result.success(listBonded())
            "requestUsbPermission" -> requestUsbPermission(call.argument<String>("deviceName")!!, result)
            "requestBluetoothPermission" -> requestBluetoothPermission(result)
            "openUsb" -> io.execute { runCatching { openUsb(call.argument<String>("deviceName")!!) }
                .fold({ main.post { result.success(null) } }, { e -> main.post { result.error("usb_open_failed", e.message, null) } }) }
            "openBt" -> io.execute { runCatching { openBt(call.argument<String>("address")!!) }
                .fold({ main.post { result.success(null) } }, { e -> main.post { result.error("bt_open_failed", e.message, null) } }) }
            "write" -> {
                // Dart sends a Uint8List, which the standard codec delivers
                // here as a `byte[]` — not a `List<Int>`. Accept either.
                val bytes = when (val raw = call.argument<Any>("bytes")) {
                    is ByteArray -> raw
                    is List<*> -> ByteArray(raw.size) { (raw[it] as Number).toByte() }
                    else -> {
                        result.error("write_failed", "bytes must be a byte array", null)
                        return
                    }
                }
                io.execute { runCatching { writeBytes(bytes) }
                    .fold({ main.post { result.success(null) } }, { e -> main.post { result.error("write_failed", e.message, null) } }) }
            }
            "read" -> {
                val timeoutMs = call.argument<Int>("timeoutMs") ?: 800
                io.execute { runCatching { readBytes(timeoutMs) }
                    .fold({ bytes -> main.post { result.success(bytes.map { it.toInt() and 0xFF }) } },
                          { e -> main.post { result.error("read_failed", e.message, null) } }) }
            }
            "close" -> { closeAll(); result.success(null) }
            else -> result.notImplemented()
        }
    }

    // ── USB ──────────────────────────────────────────────────

    private fun usbManager(): UsbManager =
        activity!!.getSystemService(Context.USB_SERVICE) as UsbManager

    /** Interface class 0x07 = printer — what ESC/POS USB printers enumerate as. */
    private fun listUsb(): List<Map<String, Any?>> {
        val manager = usbManager()
        val all = manager.deviceList.values
        Log.d(TAG, "listUsb: ${all.size} USB device(s) attached")
        all.forEach { d ->
            val ifaces = (0 until d.interfaceCount).joinToString(", ") { i ->
                val f = d.getInterface(i)
                "#${f.id}(cls=${f.interfaceClass},sub=${f.interfaceSubclass},proto=${f.interfaceProtocol},eps=${f.endpointCount})"
            }
            Log.d(TAG, "  ${d.deviceName} vid=${d.vendorId} pid=${d.productId} name=${d.productName} ifaces=[$ifaces]")
        }
        return all
            .filter { device -> (0 until device.interfaceCount).any { device.getInterface(it).interfaceClass == UsbConstants.USB_CLASS_PRINTER } }
            .map { device ->
                mapOf(
                    "deviceName" to device.deviceName,
                    "vendorId" to device.vendorId,
                    "productId" to device.productId,
                    "label" to (device.productName ?: "USB printer (${device.vendorId}:${device.productId})"),
                )
            }
    }

    private fun requestUsbPermission(deviceName: String, result: MethodChannel.Result) {
        val manager = usbManager()
        val device = manager.deviceList[deviceName]
        if (device == null) {
            result.success(false)
            return
        }
        if (manager.hasPermission(device)) {
            result.success(true)
            return
        }
        val act = activity ?: run {
            result.success(false)
            return
        }
        pendingUsbPermission = result
        // The USB permission dialog delivers its result through this
        // PendingIntent, so it must stay MUTABLE (the system fills in
        // EXTRA_DEVICE / EXTRA_PERMISSION_GRANTED). Android 14 (U / API 34)
        // then requires the wrapped Intent to be *explicit* — an implicit
        // MUTABLE PendingIntent throws IllegalArgumentException — so scope it
        // to our own package.
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_MUTABLE
        } else {
            0
        }
        val intent = Intent(ACTION_USB_PERMISSION).setPackage(act.packageName)
        val pendingIntent = PendingIntent.getBroadcast(act, 0, intent, flags)

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                if (intent.action != ACTION_USB_PERMISSION) return
                val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                pendingUsbPermission?.success(granted)
                pendingUsbPermission = null
                context.unregisterReceiver(this)
                usbPermissionReceiver = null
            }
        }
        usbPermissionReceiver = receiver
        val filter = IntentFilter(ACTION_USB_PERMISSION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            act.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            act.registerReceiver(receiver, filter)
        }
        manager.requestPermission(device, pendingIntent)
    }

    private fun openUsb(deviceName: String) {
        closeAll()
        val manager = usbManager()
        val device: UsbDevice = manager.deviceList[deviceName]
            ?: throw IllegalStateException("USB printer is no longer attached")
        Log.d(TAG, "openUsb: vid=${device.vendorId} pid=${device.productId} " +
            "name=${device.productName} interfaces=${device.interfaceCount}")
        if (!manager.hasPermission(device)) {
            throw IllegalStateException("USB permission was not granted")
        }

        val printerIfaces = (0 until device.interfaceCount)
            .map { device.getInterface(it) }
            .filter { it.interfaceClass == UsbConstants.USB_CLASS_PRINTER }
        if (printerIfaces.isEmpty()) {
            throw IllegalStateException("No printer-class interface on this USB device")
        }

        val connection = manager.openDevice(device)
            ?: throw IllegalStateException(
                "Could not open USB device — another app or the Android print service may be holding it")

        // A multifunction printer can expose several class-7 interfaces (and
        // unidirectional vs bidirectional alt-settings); take the first one
        // that actually has a bulk OUT endpoint rather than assuming index 0.
        var iface: UsbInterface? = null
        var out: UsbEndpoint? = null
        var inEp: UsbEndpoint? = null
        for (candidate in printerIfaces) {
            var o: UsbEndpoint? = null
            var i: UsbEndpoint? = null
            for (e in 0 until candidate.endpointCount) {
                val ep = candidate.getEndpoint(e)
                Log.d(TAG, "  iface#${candidate.id} alt=${candidate.alternateSetting} " +
                    "ep addr=0x%02x type=${ep.type} dir=${ep.direction}".format(ep.address))
                if (ep.type != UsbConstants.USB_ENDPOINT_XFER_BULK) continue
                if (ep.direction == UsbConstants.USB_DIR_OUT) o = ep
                if (ep.direction == UsbConstants.USB_DIR_IN) i = ep
            }
            if (o != null) { iface = candidate; out = o; inEp = i; break }
        }

        val claimed = iface
        if (claimed == null || out == null) {
            connection.close()
            throw IllegalStateException("USB printer exposes no bulk OUT endpoint on any printer interface")
        }
        if (!connection.claimInterface(claimed, true)) {
            connection.close()
            throw IllegalStateException(
                "Could not claim the USB printer interface — turn off the built-in print " +
                "service (Settings ▸ Connected devices ▸ Printing) and retry")
        }

        usbConnection = connection
        usbInterface = claimed
        usbOut = out
        usbIn = inEp
        Log.d(TAG, "openUsb: ready on iface#${claimed.id}, bulkIn=${inEp != null}")
    }

    // ── Bluetooth ────────────────────────────────────────────

    /**
     * Only ever connects to an already-paired device (see discovery.dart for
     * why this never runs a scan). Device-class filtering for the *listing*
     * is deliberately loose: clone thermal printers report inconsistent
     * Bluetooth class codes, so hiding anything the OS doesn't tag as
     * "printer" would just hide the very device the installer is looking
     * for — better to show every paired device and let a human pick.
     */
    private fun listBonded(): List<Map<String, Any?>> {
        val adapter = BluetoothAdapter.getDefaultAdapter() ?: return emptyList()
        if (!adapter.isEnabled) return emptyList()
        val bonded: Set<BluetoothDevice> = try { adapter.bondedDevices } catch (e: SecurityException) { emptySet() }
        return bonded.map { device ->
            mapOf(
                "address" to device.address,
                "name" to (runCatching { device.name }.getOrNull() ?: device.address),
            )
        }
    }

    private fun openBt(address: String) {
        closeAll()
        val adapter = BluetoothAdapter.getDefaultAdapter()
            ?: throw IllegalStateException("Bluetooth is not available on this device")
        val device = adapter.getRemoteDevice(address)
        val socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
        adapter.cancelDiscovery()
        socket.connect()
        btSocket = socket
        btOut = socket.outputStream
        btIn = socket.inputStream
    }

    // ── Shared I/O ───────────────────────────────────────────

    private fun writeBytes(bytes: ByteArray) {
        val usbC = usbConnection
        val ep = usbOut
        if (usbC != null && ep != null) {
            val sent = usbC.bulkTransfer(ep, bytes, bytes.size, 5000)
            Log.d(TAG, "usb bulkTransfer: requested=${bytes.size} sent=$sent")
            if (sent < 0) {
                throw IllegalStateException(
                    "USB bulk transfer failed (sent=$sent) — the printer did not accept the data")
            }
            return
        }
        val out = btOut
        if (out != null) {
            out.write(bytes)
            out.flush()
            return
        }
        throw IllegalStateException("No printer connection is open")
    }

    private fun readBytes(timeoutMs: Int): ByteArray {
        val usbC = usbConnection
        val ep = usbIn
        if (usbC != null && ep != null) {
            val buffer = ByteArray(64)
            val read = usbC.bulkTransfer(ep, buffer, buffer.size, timeoutMs)
            return if (read > 0) buffer.copyOf(read) else ByteArray(0)
        }
        val input = btIn
        if (input != null) {
            return try {
                if (input.available() <= 0) {
                    Thread.sleep(minOf(timeoutMs, 300).toLong())
                }
                val available = input.available()
                if (available <= 0) return ByteArray(0)
                val buffer = ByteArray(available)
                val read = input.read(buffer)
                if (read > 0) buffer.copyOf(read) else ByteArray(0)
            } catch (e: Exception) {
                ByteArray(0)
            }
        }
        return ByteArray(0)
    }

    private fun closeAll() {
        try { usbInterface?.let { usbConnection?.releaseInterface(it) } } catch (_: Exception) {}
        try { usbConnection?.close() } catch (_: Exception) {}
        usbConnection = null
        usbInterface = null
        usbOut = null
        usbIn = null

        try { btSocket?.close() } catch (_: Exception) {}
        btSocket = null
        btOut = null
        btIn = null

        usbPermissionReceiver?.let { receiver ->
            try { activity?.unregisterReceiver(receiver) } catch (_: Exception) {}
        }
        usbPermissionReceiver = null
    }
}
