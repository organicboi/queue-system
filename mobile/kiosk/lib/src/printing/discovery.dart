import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';

import 'printer_settings.dart';
import 'transport/native_printer_channel.dart';

/// One thing discovery found, in whichever transport it was found on. The
/// setup wizard renders these as they stream in rather than waiting for every
/// probe to finish, so the common case — one printer, one transport — feels
/// instant instead of waiting out the slowest probe (the network sweep).
class DiscoveredPrinter {
  const DiscoveredPrinter({
    required this.transport,
    required this.label,
    this.networkHost,
    this.usbDeviceName,
    this.bluetoothAddress,
  });

  final PrinterTransportKind transport;
  final String label;
  final String? networkHost;
  final String? usbDeviceName;
  final String? bluetoothAddress;

  PrinterSettings applyTo(PrinterSettings base) => base.copyWith(
        transport: transport,
        label: label,
        networkHost: networkHost,
        usbDeviceName: usbDeviceName,
        bluetoothAddress: bluetoothAddress,
      );
}

/// Runs the USB / Bluetooth / network probes concurrently and yields each hit
/// as soon as it's found. USB and Bluetooth are near-instant (enumeration
/// only); the network sweep is the slow one (~3-4s on a /24) and is what
/// determines how long the stream stays open.
Stream<DiscoveredPrinter> discoverPrinters() {
  final controller = StreamController<DiscoveredPrinter>();

  Future<void> run() async {
    final probes = <Future<void>>[
      _discoverUsb(controller),
      _discoverBluetooth(controller),
      _discoverNetwork(controller),
    ];
    await Future.wait(probes);
    await controller.close();
  }

  unawaited(run());
  return controller.stream;
}

Future<void> _discoverUsb(StreamController<DiscoveredPrinter> out) async {
  try {
    final devices = await NativePrinterChannel.listUsb();
    for (final d in devices) {
      out.add(DiscoveredPrinter(
        transport: PrinterTransportKind.usb,
        label: '${d.label} (USB)',
        usbDeviceName: d.deviceName,
      ));
    }
  } catch (e) {
    debugPrint('[discovery] USB probe failed: $e');
  }
}

Future<void> _discoverBluetooth(StreamController<DiscoveredPrinter> out) async {
  try {
    final granted = await NativePrinterChannel.requestBluetoothPermission();
    if (!granted) return;
    final devices = await NativePrinterChannel.listBonded();
    for (final d in devices) {
      out.add(DiscoveredPrinter(
        transport: PrinterTransportKind.bluetooth,
        label: '${d.name} (Bluetooth)',
        bluetoothAddress: d.address,
      ));
    }
  } catch (e) {
    debugPrint('[discovery] Bluetooth probe failed: $e');
  }
}

/// Sweeps the device's own /24 on port 9100 — the ESC/POS network-print port
/// almost every network thermal printer, including the ZY307, listens on.
/// No `network_info_plus` needed: `NetworkInterface.list()` already gives the
/// tablet's own IPv4, which is enough to derive the subnet to sweep.
Future<void> _discoverNetwork(StreamController<DiscoveredPrinter> out) async {
  try {
    final interfaces = await NetworkInterface.list(
      type: InternetAddressType.IPv4,
      includeLoopback: false,
      includeLinkLocal: false,
    );
    final subnets = <String>{};
    for (final iface in interfaces) {
      for (final addr in iface.addresses) {
        final parts = addr.address.split('.');
        if (parts.length == 4) {
          subnets.add('${parts[0]}.${parts[1]}.${parts[2]}');
        }
      }
    }
    if (subnets.isEmpty) return;

    const port = 9100;
    const perAttemptTimeout = Duration(milliseconds: 400);
    const maxInFlight = 32;

    for (final subnet in subnets) {
      final hosts = List.generate(254, (i) => '$subnet.${i + 1}');
      var index = 0;

      Future<void> worker() async {
        while (index < hosts.length) {
          final host = hosts[index++];
          try {
            final socket = await Socket.connect(host, port,
                timeout: perAttemptTimeout);
            await socket.close();
            out.add(DiscoveredPrinter(
              transport: PrinterTransportKind.network,
              label: '$host:$port (Network)',
              networkHost: host,
            ));
          } catch (_) {
            // No listener at this address — the overwhelmingly common case,
            // not a problem.
          }
        }
      }

      await Future.wait(List.generate(maxInFlight, (_) => worker()));
    }
  } catch (e) {
    debugPrint('[discovery] Network probe failed: $e');
  }
}
