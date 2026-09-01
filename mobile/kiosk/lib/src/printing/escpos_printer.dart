import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';

import '../models/school_settings.dart';
import 'escpos.dart';
import 'print_job.dart';
import 'printer.dart';
import 'printer_settings.dart';
import 'ticket_raster.dart';
import 'ticket_widget.dart';
import 'transport/bluetooth_transport.dart';
import 'transport/network_transport.dart';
import 'transport/printer_transport.dart';
import 'transport/usb_transport.dart';

/// Real printer: renders each ticket to a 1-bit raster and sends it over
/// whichever transport [settings] selects. Owns exactly one connection and
/// reconnects on demand — a kiosk left running for weeks will see its socket
/// drop or the printer sleep, and there's nobody there to power-cycle it.
class EscPosPrinter implements Printer {
  EscPosPrinter({
    required this.settings,
    required this.branchInfo,
    ui.Image? logo,
  }) : _logo = logo;

  final PrinterSettings settings;
  final BranchTicketInfo branchInfo;
  final ui.Image? _logo;

  PrinterTransport? _transport;
  bool _lastReady = true;

  /// The exception text from the most recent [printCalibration] failure, so
  /// the setup wizard can show the operator the actual reason instead of a
  /// catch-all "could not print". Null after a success.
  String? lastCalibrationError;

  @override
  bool get isReady => _lastReady;

  PrinterTransport _buildTransport() {
    switch (settings.transport) {
      case PrinterTransportKind.network:
        return NetworkPrinterTransport(
          host: settings.networkHost ?? '',
          port: settings.networkPort,
        );
      case PrinterTransportKind.usb:
        return UsbPrinterTransport(deviceName: settings.usbDeviceName ?? '');
      case PrinterTransportKind.bluetooth:
        return BluetoothPrinterTransport(address: settings.bluetoothAddress ?? '');
      case PrinterTransportKind.none:
        throw PrinterTransportException('No printer configured');
    }
  }

  Future<PrinterTransport> _ensureOpen() async {
    var transport = _transport;
    if (transport != null && transport.isOpen) return transport;
    transport = _buildTransport();
    await transport.open();
    _transport = transport;
    return transport;
  }

  @override
  Future<PrintAttempt> print(PrintJob job) async {
    if (!settings.isConfigured) {
      _lastReady = false;
      return PrintAttempt.failure(PrintFailureReason.unreachable);
    }

    try {
      final transport = await _ensureOpen();

      // Best-effort pre-flight status check. Some clones don't answer at all
      // — in that case treat the printer as ready and let the actual write
      // surface any real failure, rather than blocking a working printer on
      // a status byte it never sends.
      final paperCheck = await _checkPaper(transport);
      if (paperCheck != null) {
        _lastReady = false;
        return PrintAttempt.failure(paperCheck);
      }

      final data = TicketData(
        schoolNameEn: branchInfo.schoolNameEn,
        schoolNameAr: branchInfo.schoolNameAr,
        tokenCode: job.token.tokenCode,
        departmentNameEn: job.department.nameEn,
        departmentNameAr: job.department.nameAr,
        isPriority: job.token.isPriority,
        footerEn: branchInfo.ticketFooterEn,
        footerAr: branchInfo.ticketFooterAr,
        issuedAt: DateTime.now(),
        waitingAhead: job.waitingAhead,
        logo: _logo,
      );

      final bytes = await buildTicketPrintStream(
        data: data,
        paper: settings.paper,
        hasCutter: settings.hasCutter,
      );

      await transport.write(bytes);
      _lastReady = true;
      return PrintAttempt.ok;
    } on PrinterTransportException catch (e) {
      debugPrint('[EscPosPrinter] transport error: $e');
      _lastReady = false;
      // A failed write likely means a dead connection — drop it so the next
      // job reconnects from scratch instead of retrying a broken socket.
      await _transport?.close();
      _transport = null;
      return PrintAttempt.failure(PrintFailureReason.unreachable);
    } catch (e) {
      debugPrint('[EscPosPrinter] unexpected error: $e');
      _lastReady = false;
      return PrintAttempt.failure(PrintFailureReason.unknown);
    }
  }

  Future<PrintFailureReason?> _checkPaper(PrinterTransport transport) async {
    try {
      await transport.write(EscPos.queryPaperStatus());
      final reply = await transport.read(timeout: const Duration(milliseconds: 500));
      if (reply.isEmpty) return null; // no reply — don't block on it
      final status = PaperStatus.fromByte(reply.last);
      if (status.paperOut) return PrintFailureReason.outOfPaper;
      if (status.coverOpen) return PrintFailureReason.coverOpen;
      return null;
    } catch (_) {
      return null; // status query itself failing isn't a print failure
    }
  }

  /// Sends the calibration ruler ticket (see `buildCalibrationWidget`) so the
  /// installer can confirm the fitted paper width during setup.
  Future<PrintAttempt> printCalibration() async {
    try {
      final transport = await _ensureOpen();
      final widthDots = settings.paper.printableDots;
      final bytes = await rasterizeWidgetToEscPos(
        widget: buildCalibrationWidget(widthDots: widthDots),
        widthDots: widthDots,
        hasCutter: settings.hasCutter,
      );
      await transport.write(bytes);
      _lastReady = true;
      lastCalibrationError = null;
      return PrintAttempt.ok;
    } catch (e, st) {
      _lastReady = false;
      lastCalibrationError = e is PrinterTransportException ? e.message : e.toString();
      debugPrint('[EscPosPrinter] calibration failed: $e\n$st');
      return PrintAttempt.failure(PrintFailureReason.unreachable);
    }
  }

  @override
  Future<void> dispose() async {
    await _transport?.close();
    _transport = null;
  }
}

/// The branch-level fields a ticket needs, distinct from [SchoolSettings] so
/// the printer doesn't depend on the full bootstrap DTO shape.
class BranchTicketInfo {
  const BranchTicketInfo({
    required this.schoolNameEn,
    required this.schoolNameAr,
    required this.ticketFooterEn,
    required this.ticketFooterAr,
  });

  final String schoolNameEn;
  final String schoolNameAr;
  final String ticketFooterEn;
  final String ticketFooterAr;

  factory BranchTicketInfo.fromSettings(SchoolSettings? settings) => BranchTicketInfo(
        schoolNameEn: settings?.schoolNameEn ?? '',
        schoolNameAr: settings?.schoolNameAr ?? '',
        ticketFooterEn: settings?.ticketFooterEn ?? '',
        ticketFooterAr: settings?.ticketFooterAr ?? '',
      );
}
