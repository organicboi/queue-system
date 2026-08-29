import 'dart:convert';

/// How the printer is physically reached.
enum PrinterTransportKind {
  network,
  usb,
  bluetooth,
  none;

  String get storageValue => name;

  static PrinterTransportKind fromStorage(String? value) {
    for (final kind in PrinterTransportKind.values) {
      if (kind.name == value) return kind;
    }
    return PrinterTransportKind.none;
  }

  String get label => switch (this) {
        PrinterTransportKind.network => 'Network (LAN / WiFi)',
        PrinterTransportKind.usb => 'USB',
        PrinterTransportKind.bluetooth => 'Bluetooth',
        PrinterTransportKind.none => 'Not configured',
      };
}

/// Roll width fitted to the printer. Determines the raster width in dots at
/// 8 dots/mm (see `ticket_raster.dart` and `lib/school/printTicket.ts` for the
/// web-side equivalent math).
enum PaperWidth {
  mm58,
  mm80;

  int get printableDots => switch (this) {
        PaperWidth.mm58 => 384,
        PaperWidth.mm80 => 576,
      };

  double get printableMm => switch (this) {
        PaperWidth.mm58 => 48,
        PaperWidth.mm80 => 72,
      };

  double get rollMm => switch (this) {
        PaperWidth.mm58 => 58,
        PaperWidth.mm80 => 80,
      };

  String get label => switch (this) {
        PaperWidth.mm58 => '58 mm / 384 dots',
        PaperWidth.mm80 => '80 mm / 576 dots',
      };

  String get storageValue => switch (this) {
        PaperWidth.mm58 => '58',
        PaperWidth.mm80 => '80',
      };

  static PaperWidth fromStorage(String? value) =>
      value == '58' ? PaperWidth.mm58 : PaperWidth.mm80;
}

/// Everything the printing pipeline needs, persisted as one JSON blob in
/// [DeviceConfig] under the `device.printer` key so adding a field never
/// means another shared_preferences migration.
class PrinterSettings {
  const PrinterSettings({
    this.transport = PrinterTransportKind.none,
    this.paper = PaperWidth.mm80,
    this.hasCutter = true,
    this.networkHost,
    this.networkPort = 9100,
    this.usbDeviceName,
    this.bluetoothAddress,
    this.bluetoothName,
    this.label,
  });

  final PrinterTransportKind transport;
  final PaperWidth paper;
  final bool hasCutter;

  final String? networkHost;
  final int networkPort;

  /// Android `UsbDevice.deviceName` (a stable path like `/dev/bus/usb/001/002`
  /// while attached) — re-resolved by vendor/product id on each connect
  /// attempt since the path can change across replugs.
  final String? usbDeviceName;

  final String? bluetoothAddress;
  final String? bluetoothName;

  /// Friendly name shown in settings, e.g. "ZY307 (192.168.1.87)".
  final String? label;

  bool get isConfigured =>
      transport != PrinterTransportKind.none &&
      switch (transport) {
        PrinterTransportKind.network =>
          (networkHost ?? '').trim().isNotEmpty,
        PrinterTransportKind.usb => (usbDeviceName ?? '').trim().isNotEmpty,
        PrinterTransportKind.bluetooth =>
          (bluetoothAddress ?? '').trim().isNotEmpty,
        PrinterTransportKind.none => false,
      };

  PrinterSettings copyWith({
    PrinterTransportKind? transport,
    PaperWidth? paper,
    bool? hasCutter,
    String? networkHost,
    int? networkPort,
    String? usbDeviceName,
    String? bluetoothAddress,
    String? bluetoothName,
    String? label,
  }) {
    return PrinterSettings(
      transport: transport ?? this.transport,
      paper: paper ?? this.paper,
      hasCutter: hasCutter ?? this.hasCutter,
      networkHost: networkHost ?? this.networkHost,
      networkPort: networkPort ?? this.networkPort,
      usbDeviceName: usbDeviceName ?? this.usbDeviceName,
      bluetoothAddress: bluetoothAddress ?? this.bluetoothAddress,
      bluetoothName: bluetoothName ?? this.bluetoothName,
      label: label ?? this.label,
    );
  }

  Map<String, dynamic> toJson() => {
        'transport': transport.storageValue,
        'paper': paper.storageValue,
        'hasCutter': hasCutter,
        'networkHost': networkHost,
        'networkPort': networkPort,
        'usbDeviceName': usbDeviceName,
        'bluetoothAddress': bluetoothAddress,
        'bluetoothName': bluetoothName,
        'label': label,
      };

  factory PrinterSettings.fromJson(Map<String, dynamic> json) {
    return PrinterSettings(
      transport: PrinterTransportKind.fromStorage(json['transport'] as String?),
      paper: PaperWidth.fromStorage(json['paper'] as String?),
      hasCutter: json['hasCutter'] as bool? ?? true,
      networkHost: json['networkHost'] as String?,
      networkPort: (json['networkPort'] as num?)?.toInt() ?? 9100,
      usbDeviceName: json['usbDeviceName'] as String?,
      bluetoothAddress: json['bluetoothAddress'] as String?,
      bluetoothName: json['bluetoothName'] as String?,
      label: json['label'] as String?,
    );
  }

  static PrinterSettings decode(String? raw) {
    if (raw == null || raw.trim().isEmpty) return const PrinterSettings();
    try {
      return PrinterSettings.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return const PrinterSettings();
    }
  }

  String encode() => jsonEncode(toJson());
}
