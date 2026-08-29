import 'dart:typed_data';

import 'package:flutter/widgets.dart';

import 'escpos.dart';
import 'printer_settings.dart';
import 'ticket_capture_host.dart';
import 'ticket_widget.dart';

/// Renders 8 dots per mm — the ZY307's documented head resolution, and the
/// same figure `lib/school/printTicket.ts` uses for the 58 mm roll. It is the
/// standard density for 203 dpi thermal heads generally, so this holds for
/// both paper widths, only the dot *count* differs (see `PaperWidth`).
const double dotsPerMm = 8;

/// Anything darker than this fraction of white becomes a printed dot. Mirrors
/// `LOGO_THRESHOLD` in `lib/school/printTicket.ts` — chosen for flat shapes
/// (logos, bold type), where a hard cutoff keeps edges crisp.
const double defaultThreshold = 0.62;

/// End-to-end: build the ticket widget, capture it off-screen, threshold it
/// to 1-bit, and return the full ESC/POS byte stream ready to hand to a
/// [PrinterTransport] — init, raster, feed, and (if configured) cut.
Future<Uint8List> buildTicketPrintStream({
  required TicketData data,
  required PaperWidth paper,
  required bool hasCutter,
}) {
  final widthDots = paper.printableDots;
  return rasterizeWidgetToEscPos(
    widget: buildTicketWidget(data: data, widthDots: widthDots),
    widthDots: widthDots,
    hasCutter: hasCutter,
  );
}

/// Shared by [buildTicketPrintStream] and the setup wizard's calibration
/// print (`buildCalibrationWidget`) — anything that needs to go from "a
/// Flutter widget" to "bytes a printer transport can write" goes through
/// here.
Future<Uint8List> rasterizeWidgetToEscPos({
  required Widget widget,
  required int widthDots,
  required bool hasCutter,
}) async {
  final captured = await TicketCaptureHost.capture(
    widget,
    width: widthDots.toDouble(),
  );

  final bitmap = _thresholdToBitmap(
    width: captured.width,
    height: captured.height,
    rgba: captured.rgba,
    threshold: defaultThreshold,
  );

  final out = BytesBuilder();
  out.add(EscPos.init());
  out.add(EscPos.raster(
    widthDots: captured.width,
    heightDots: captured.height,
    bitmap: bitmap,
  ));
  // An auto-cutter needs less trailing feed than a tear-bar roll — the cutter
  // itself sits right at the print head, while a human tearing against a bar
  // needs the content clear of it first.
  out.add(EscPos.feed(hasCutter ? 2 : 6));
  if (hasCutter) out.add(EscPos.partialCut());
  return out.toBytes();
}

/// Converts straight RGBA8888 pixels to a 1-bit-per-pixel, MSB-first bitmap —
/// the packing `GS v 0` expects. Composites onto white via the alpha channel
/// first: a transparent logo PNG's alpha must not read as black, which is
/// exactly the bug `prepareTicketLogo` in `printTicket.ts` guards against on
/// the web side.
Uint8List _thresholdToBitmap({
  required int width,
  required int height,
  required Uint8List rgba,
  required double threshold,
}) {
  final bytesPerRow = (width + 7) ~/ 8;
  final out = Uint8List(bytesPerRow * height);

  for (var y = 0; y < height; y++) {
    final rowOffset = y * width * 4;
    final rowByteOffset = y * bytesPerRow;
    for (var x = 0; x < width; x++) {
      final i = rowOffset + x * 4;
      final r = rgba[i];
      final g = rgba[i + 1];
      final b = rgba[i + 2];
      final a = rgba[i + 3] / 255.0;

      final rr = r * a + 255 * (1 - a);
      final gg = g * a + 255 * (1 - a);
      final bb = b * a + 255 * (1 - a);
      final lum = (0.299 * rr + 0.587 * gg + 0.114 * bb) / 255.0;

      if (lum < threshold) {
        final byteIndex = rowByteOffset + (x >> 3);
        final bit = 7 - (x & 7);
        out[byteIndex] |= 1 << bit;
      }
    }
  }
  return out;
}
