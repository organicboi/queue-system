import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'printer_transport.dart';

/// Raw TCP to the printer's ESC/POS port (9100 on the ZY307 and effectively
/// every network ESC/POS printer). Pure `dart:io` — no package needed, which
/// is also why this is the default transport: it is the least that can break.
class NetworkPrinterTransport implements PrinterTransport {
  NetworkPrinterTransport({
    required this.host,
    this.port = 9100,
    this.connectTimeout = const Duration(seconds: 3),
  });

  final String host;
  final int port;
  final Duration connectTimeout;

  Socket? _socket;
  StreamSubscription<Uint8List>? _sub;
  final _incoming = StreamController<Uint8List>.broadcast();

  @override
  bool get isOpen => _socket != null;

  @override
  Future<void> open() async {
    if (isOpen) return;
    try {
      final socket = await Socket.connect(host, port, timeout: connectTimeout);
      socket.setOption(SocketOption.tcpNoDelay, true);
      _sub = socket.listen(
        _incoming.add,
        onError: (_) => close(),
        onDone: close,
        cancelOnError: true,
      );
      _socket = socket;
    } on SocketException catch (e) {
      throw PrinterTransportException('Cannot reach printer at $host:$port ($e)');
    } on TimeoutException {
      throw PrinterTransportException('Timed out connecting to $host:$port');
    }
  }

  @override
  Future<void> write(Uint8List bytes) async {
    final socket = _socket;
    if (socket == null) {
      throw PrinterTransportException('Printer socket is not open');
    }
    socket.add(bytes);
    await socket.flush();
  }

  @override
  Future<Uint8List> read({Duration timeout = const Duration(milliseconds: 800)}) async {
    try {
      return await _incoming.stream.first.timeout(timeout);
    } catch (_) {
      return Uint8List(0);
    }
  }

  @override
  Future<void> close() async {
    final socket = _socket;
    _socket = null;
    await _sub?.cancel();
    _sub = null;
    try {
      await socket?.close();
    } catch (_) {
      // Already gone — fine, that's what close() is for.
    }
  }
}
