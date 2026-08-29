import 'package:flutter/services.dart';

/// Dart side of the Android platform channel backed by `PrinterPlugin.kt`.
/// One physical connection at a time — opening a new one closes whatever was
/// open before, which matches how this app actually uses it (one printer per
/// device). Anything network-only never touches this channel at all.
class NativePrinterChannel {
  NativePrinterChannel._();
  static const _channel = MethodChannel('com.vibequeue.school_kiosk/printer');

  /// USB devices currently attached whose interface looks like a printer
  /// (interface class 7) — see `PrinterPlugin.kt#listUsb`.
  static Future<List<UsbPrinterCandidate>> listUsb() async {
    final raw = await _channel.invokeMethod<List<dynamic>>('listUsb') ?? const [];
    return raw
        .cast<Map<dynamic, dynamic>>()
        .map(UsbPrinterCandidate.fromMap)
        .toList();
  }

  /// Already-paired Bluetooth devices (no scan — see discovery.dart for why).
  static Future<List<BluetoothPrinterCandidate>> listBonded() async {
    final raw = await _channel.invokeMethod<List<dynamic>>('listBonded') ?? const [];
    return raw
        .cast<Map<dynamic, dynamic>>()
        .map(BluetoothPrinterCandidate.fromMap)
        .toList();
  }

  static Future<bool> requestUsbPermission(String deviceName) async {
    final granted = await _channel
        .invokeMethod<bool>('requestUsbPermission', {'deviceName': deviceName});
    return granted ?? false;
  }

  /// BLUETOOTH_CONNECT is a runtime permission from Android 12 onward —
  /// without it, [listBonded] would silently return nothing forever. A no-op
  /// returning true on older Android, where the manifest-declared legacy
  /// permissions are already enough.
  static Future<bool> requestBluetoothPermission() async {
    final granted = await _channel.invokeMethod<bool>('requestBluetoothPermission');
    return granted ?? false;
  }

  static Future<void> openUsb(String deviceName) =>
      _channel.invokeMethod('openUsb', {'deviceName': deviceName});

  static Future<void> openBluetooth(String address) =>
      _channel.invokeMethod('openBt', {'address': address});

  static Future<void> write(List<int> bytes) =>
      _channel.invokeMethod('write', {'bytes': bytes});

  static Future<List<int>> read(int timeoutMs) async {
    final raw = await _channel
        .invokeMethod<List<dynamic>>('read', {'timeoutMs': timeoutMs});
    return raw?.cast<int>() ?? const [];
  }

  static Future<void> close() => _channel.invokeMethod('close');
}

class UsbPrinterCandidate {
  const UsbPrinterCandidate({
    required this.deviceName,
    required this.vendorId,
    required this.productId,
    required this.label,
  });

  final String deviceName;
  final int vendorId;
  final int productId;
  final String label;

  factory UsbPrinterCandidate.fromMap(Map<dynamic, dynamic> map) {
    return UsbPrinterCandidate(
      deviceName: map['deviceName'] as String? ?? '',
      vendorId: (map['vendorId'] as num?)?.toInt() ?? 0,
      productId: (map['productId'] as num?)?.toInt() ?? 0,
      label: map['label'] as String? ?? 'USB printer',
    );
  }
}

class BluetoothPrinterCandidate {
  const BluetoothPrinterCandidate({required this.address, required this.name});

  final String address;
  final String name;

  factory BluetoothPrinterCandidate.fromMap(Map<dynamic, dynamic> map) {
    return BluetoothPrinterCandidate(
      address: map['address'] as String? ?? '',
      name: map['name'] as String? ?? 'Bluetooth printer',
    );
  }
}
