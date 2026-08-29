import 'dart:async';

import 'package:flutter/foundation.dart';

import '../config/app_config.dart';
import 'print_job.dart';

/// A printer target. The real implementation (render-to-bitmap → ESC/POS raster
/// → transport) lands in step 5 of the plan; for now [DebugPrinter] just logs.
///
/// Ticket rendering MUST follow the render-to-bitmap strategy from
/// lib/school/printTicket.ts — per-tenant logo, Arabic shaping, exact dot math
/// all rule out ESC/POS text mode. The known target hardware is a ZY307
/// (80 mm / 576–572 dots, ESC/POS, USB + serial + LAN + WiFi, auto-cutter) —
/// see "ZY307 usb lan, wifi.pdf" at the repo root. That means network printing
/// to raw TCP port 9100, not Bluetooth SPP; confirm with the product owner.
abstract class Printer {
  Future<PrintResult> print(PrintJob job);

  /// Whether the printer is currently reachable. Drives the on-screen
  /// paper-out / offline banner — an unattended kiosk has nobody to notice a
  /// silent failure.
  bool get isReady;

  Future<void> dispose();
}

/// No hardware. Logs the job and always succeeds. Wired up until step 5.
class DebugPrinter implements Printer {
  @override
  bool get isReady => true;

  @override
  Future<PrintResult> print(PrintJob job) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    debugPrint(
      '[DebugPrinter] would print ${job.token.tokenCode} '
      '(${job.department.nameEn}) priority=${job.token.isPriority}',
    );
    return PrintResult.printed;
  }

  @override
  Future<void> dispose() async {}
}

/// Serialises [PrintJob]s so a slow print never blocks the next tap (the web
/// kiosk's print-queue behaviour). Enqueue returns immediately; failures are
/// reported via [onResult] and never bubble to the tap handler.
class PrintQueue {
  PrintQueue(this._printer, {this.onResult});

  final Printer _printer;
  final void Function(PrintJob job, PrintResult result)? onResult;

  final _pending = <PrintJob>[];
  bool _draining = false;

  void enqueue(PrintJob job) {
    _pending.add(job);
    unawaited(_drain());
  }

  Future<void> _drain() async {
    if (_draining) return;
    _draining = true;
    try {
      while (_pending.isNotEmpty) {
        final job = _pending.removeAt(0);
        PrintResult result;
        try {
          result = await _printer.print(job);
        } catch (_) {
          result = PrintResult.failed;
        }
        onResult?.call(job, result);
        if (result == PrintResult.failed) {
          // Brief pause so a flapping connection doesn't spin the queue.
          await Future<void>.delayed(AppConfig.retryInterval);
        }
      }
    } finally {
      _draining = false;
    }
  }
}
