import 'dart:typed_data';

/// A byte pipe to a printer. `network_transport.dart` is pure Dart; the USB
/// and Bluetooth implementations are thin wrappers around a platform channel
/// backed by `PrinterPlugin.kt` (Android only — ESC/POS printers speak the USB
/// *printer* class, which Dart's `dart:io` cannot reach directly).
abstract class PrinterTransport {
  Future<void> open();

  Future<void> write(Uint8List bytes);

  /// Best-effort read with a short timeout, for status queries. Returns an
  /// empty buffer on timeout rather than throwing — a printer that doesn't
  /// answer a status query is common and not itself a failure.
  Future<Uint8List> read({Duration timeout = const Duration(milliseconds: 800)});

  Future<void> close();

  bool get isOpen;
}

class PrinterTransportException implements Exception {
  PrinterTransportException(this.message);
  final String message;

  @override
  String toString() => 'PrinterTransportException: $message';
}
