import 'dart:async';

import 'package:flutter/foundation.dart';

import '../config/app_config.dart';
import 'print_job.dart';

/// A printer target. [DebugPrinter] is the no-hardware stand-in used before a
/// device is provisioned with a real one; [EscPosPrinter] (escpos_printer.dart)
/// is the real implementation — render-to-bitmap, then one of the three
/// [PrinterTransport]s.
abstract class Printer {
  Future<PrintAttempt> print(PrintJob job);

  /// Whether the printer is currently reachable. Drives the on-screen
  /// paper-out / offline banner — an unattended kiosk has nobody to notice a
  /// silent failure.
  bool get isReady;

  Future<void> dispose();
}

/// No hardware. Logs the job and always succeeds. Used until a printer is
/// configured, and in tests.
class DebugPrinter implements Printer {
  @override
  bool get isReady => true;

  @override
  Future<PrintAttempt> print(PrintJob job) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    debugPrint(
      '[DebugPrinter] would print ${job.data.tokenCode} '
      '(${job.data.departmentNameEn}) priority=${job.data.isPriority}',
    );
    return PrintAttempt.ok;
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
  final void Function(PrintJob job, PrintAttempt attempt)? onResult;

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
        PrintAttempt attempt;
        try {
          attempt = await _printer.print(job);
        } catch (_) {
          attempt = PrintAttempt.failure(PrintFailureReason.unreachable);
        }
        onResult?.call(job, attempt);
        if (attempt.isFailure) {
          // Brief pause so a flapping connection doesn't spin the queue.
          await Future<void>.delayed(AppConfig.retryInterval);
        }
      }
    } finally {
      _draining = false;
    }
  }
}
