import 'dart:typed_data';

import 'native_printer_channel.dart';
import 'printer_transport.dart';

/// USB printer-class transport. ESC/POS printers enumerate as USB *printer
/// class* (interface class 0x07), not CDC/serial — the reason this goes
/// through a purpose-built platform channel instead of a generic
/// `usb_serial`-style package, which only sees CDC devices.
class UsbPrinterTransport implements PrinterTransport {
  UsbPrinterTransport({required this.deviceName});

  final String deviceName;
  bool _open = false;

  @override
  bool get isOpen => _open;

  @override
  Future<void> open() async {
    final granted = await NativePrinterChannel.requestUsbPermission(deviceName);
    if (!granted) {
      throw PrinterTransportException(
        'USB permission was not granted for the printer',
      );
    }
    await NativePrinterChannel.openUsb(deviceName);
    _open = true;
  }

  @override
  Future<void> write(Uint8List bytes) async {
    if (!_open) throw PrinterTransportException('USB printer is not open');
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
