import 'dart:typed_data';

import 'native_printer_channel.dart';
import 'printer_transport.dart';

/// Classic Bluetooth SPP transport, for the (very common) thermal printers
/// that aren't the network-first ZY307. Only ever connects to an
/// already-paired device — see discovery.dart for why this never runs a scan.
class BluetoothPrinterTransport implements PrinterTransport {
  BluetoothPrinterTransport({required this.address});

  final String address;
  bool _open = false;

  @override
  bool get isOpen => _open;

  @override
  Future<void> open() async {
    final granted = await NativePrinterChannel.requestBluetoothPermission();
    if (!granted) {
      throw PrinterTransportException('Bluetooth permission was not granted');
    }
    await NativePrinterChannel.openBluetooth(address);
    _open = true;
  }

  @override
  Future<void> write(Uint8List bytes) async {
    if (!_open) throw PrinterTransportException('Bluetooth printer is not open');
    await NativePrinterChannel.write(bytes);
  }

  @override
  Future<Uint8List> read({Duration timeout = const Duration(milliseconds: 800)}) async {
    final bytes = await NativePrinterChannel.read(timeout.inMilliseconds);
    return Uint8List.fromList(bytes);
  }

  @override
  Future<void> close() async {
    _open = false;
    await NativePrinterChannel.close();
  }
}
