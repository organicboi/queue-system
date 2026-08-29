import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';

import 'printer_settings.dart';
import 'ticket_capture_host.dart';
import 'ticket_widget.dart';

/// Dev-only helper: renders a ticket, thresholds it exactly like the real
/// print path, and writes the *black-and-white result* (not the original
/// colour capture) to a PNG on disk — so what gets eyeballed is what the
/// printer would actually produce. Called from the admin settings screen's
/// "Preview ticket" action, gated to debug builds only.
///
/// This exists because the build plan is explicit that the raster pipeline
/// must be checked by eye before it's ever pointed at real hardware.
Future<File?> saveTicketPreviewPng({
  required TicketData data,
  required PaperWidth paper,
}) async {
  if (!kDebugMode) return null;

  final widthDots = paper.printableDots;
  final captured = await TicketCaptureHost.capture(
    buildTicketWidget(data: data, widthDots: widthDots),
    width: widthDots.toDouble(),
  );

  final bwPixels = _blackAndWhiteRgba(
    width: captured.width,
    height: captured.height,
    rgba: captured.rgba,
    threshold: 0.62,
  );

  final completer = Completer<ui.Image>();
  ui.decodeImageFromPixels(
    bwPixels,
    captured.width,
    captured.height,
    ui.PixelFormat.rgba8888,
    completer.complete,
  );
  final image = await completer.future;
  final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
  if (byteData == null) return null;

  final dir = await _previewDir();
  final file = File('${dir.path}/ticket_preview.png');
  await file.writeAsBytes(byteData.buffer.asUint8List(), flush: true);
  debugPrint('[ticket preview] wrote ${file.path}');
  return file;
}

Future<Directory> _previewDir() async {
  final dir = Directory('${Directory.systemTemp.path}/vibequeue_kiosk');
  if (!await dir.exists()) await dir.create(recursive: true);
  return dir;
}

Uint8List _blackAndWhiteRgba({
  required int width,
  required int height,
  required Uint8List rgba,
  required double threshold,
}) {
  final out = Uint8List(width * height * 4);
  for (var i = 0; i < width * height; i++) {
    final o = i * 4;
    final r = rgba[o];
    final g = rgba[o + 1];
    final b = rgba[o + 2];
    final a = rgba[o + 3] / 255.0;
    final rr = r * a + 255 * (1 - a);
    final gg = g * a + 255 * (1 - a);
    final bb = b * a + 255 * (1 - a);
    final lum = (0.299 * rr + 0.587 * gg + 0.114 * bb) / 255.0;
    final v = lum < threshold ? 0 : 255;
    out[o] = v;
    out[o + 1] = v;
    out[o + 2] = v;
    out[o + 3] = 255;
  }
  return out;
}
