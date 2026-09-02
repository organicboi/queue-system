import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

/// Everything the ticket needs to render. [logo] is a pre-decoded image
/// rather than a URL: the print pipeline must never depend on a network
/// fetch completing inside the tight off-screen capture window, so the
/// kiosk loads and caches the school's logo once (see `loadTicketLogo`
/// below) and hands the same decoded image to every ticket after that.
class TicketData {
  const TicketData({
    required this.schoolNameEn,
    required this.schoolNameAr,
    required this.tokenCode,
    required this.departmentNameEn,
    required this.departmentNameAr,
    required this.isPriority,
    required this.footerEn,
    required this.footerAr,
    required this.issuedAt,
    this.waitingAhead,
    this.logo,
    this.publicUrl,
  });

  final String schoolNameEn;
  final String schoolNameAr;
  final String tokenCode;
  final String departmentNameEn;
  final String departmentNameAr;
  final bool isPriority;
  final String footerEn;
  final String footerAr;
  final DateTime issuedAt;

  /// How many visitors are still in front of this one. Null leaves the line
  /// off the ticket entirely — see [PrintJob.waitingAhead].
  final int? waitingAhead;
  final ui.Image? logo;

  /// The public tracking page's URL for this ticket, or null to leave the QR
  /// off entirely — mirrors [waitingAhead]'s null convention. Set only when
  /// KioskBootstrap.publicTrackingEnabled is true; see
  /// BranchTicketInfo.fromBootstrap in escpos_printer.dart for where it's
  /// derived.
  final String? publicUrl;
}

/// Fetches and decodes a logo once, for reuse across every ticket printed in
/// this session. Never throws — a missing/slow logo must not stop printing;
/// callers get `null` and the ticket prints without one.
Future<ui.Image?> loadTicketLogo(String url) async {
  if (url.trim().isEmpty) return null;
  try {
    final provider = NetworkImage(url);
    final completer = Completer<ui.Image>();
    final stream = provider.resolve(const ImageConfiguration());
    late ImageStreamListener listener;
    listener = ImageStreamListener(
      (info, _) {
        completer.complete(info.image);
        stream.removeListener(listener);
      },
      onError: (error, stack) {
        completer.completeError(error, stack);
        stream.removeListener(listener);
      },
    );
    stream.addListener(listener);
    return await completer.future.timeout(const Duration(seconds: 8));
  } catch (_) {
    return null;
  }
}

// Sizes are in dots (1 logical px == 1 dot at pixelRatio 1.0 capture — see
// ticket_raster.dart). Chosen for legibility on a 576-dot (80mm) head; they
// scale down proportionally fine on the 384-dot (58mm) width since the
// layout itself, not just the font sizes, is driven by `widthDots`.
//
// Sized against the 58mm roll, which is the tighter of the two: at 384 dots
// the content box is 384 - 2*s(20) = 357 dots ~= 45mm. A bold sans runs about
// 0.6em per character, so a name only starts wrapping past ~20 characters at
// _schoolFontSize. Wrapping is the safe failure here — `Text` soft-wraps and
// the roll is cut to length, so a long name costs paper, never letters.
const double _logoMaxHeightDots = 110;
const double _tokenFontSize = 150;
const double _schoolFontSize = 44;
const double _departmentFontSize = 40;
const double _footerFontSize = 26;
const double _metaFontSize = 28;
const double _aheadFontSize = 26;
const double _qrCaptionFontSize = 22;
// Fixed physical size (26mm at the head's 8 dots/mm — see dotsPerMm in
// ticket_raster.dart), not a fraction of widthDots: a real printed ticket
// came back unscannable at the old width-proportional size on 58mm paper.
// At ECC level M a ~45-char tracking URL is a 33-module code; 208 dots
// across that clears ~0.8mm per module, comfortably inside typical
// scan-reliability guidance. Independent of s() for the same reason it was
// before — TicketCaptureHost captures at pixelRatio 1.0 and
// _thresholdToBitmap hard-binarises the whole ticket afterwards, so any
// sub-pixel edges from the QR's own vector paint are cleaned up the same way
// the logo and text are; only the physical size matters here, not alignment
// to the 576-dot baseline.
const double _qrDots = 208;

/// Wording kept identical to `qrCaptionLine()` in lib/school/printTicket.ts.
({String en, String ar}) qrCaptionLine() {
  return (en: 'Scan to track your turn', ar: 'امسح لمتابعة دورك');
}

/// The line the visitor is actually looking for: how many people are still in
/// front of them. Wording is kept identical to `waitingAheadLine()` in
/// lib/school/printTicket.ts so the browser kiosk and this one print the same
/// ticket.
///
/// Arabic is phrased as a count ("the number of people waiting before you") on
/// purpose: it takes any number without the singular/dual/plural agreement a
/// "N people" phrasing would need.
({String en, String ar}) waitingAheadLine(int count) {
  if (count <= 0) {
    return (en: 'You are next in line', ar: 'أنت التالي في الطابور');
  }
  return (
    en: count == 1 ? '1 person waiting before you' : '$count people waiting before you',
    ar: 'عدد المنتظرين قبلك: $count',
  );
}

Widget buildTicketWidget({required TicketData data, required int widthDots}) {
  final scale = widthDots / 576; // baseline designed at 80mm/576 dots
  double s(double v) => v * scale;

  final ahead = data.waitingAhead;
  final aheadLine = ahead == null ? null : waitingAheadLine(ahead);

  return Padding(
    padding: EdgeInsets.symmetric(horizontal: s(20), vertical: s(28)),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        if (data.logo != null) ...[
          ConstrainedBox(
            constraints: BoxConstraints(maxHeight: s(_logoMaxHeightDots)),
            child: RawImage(image: data.logo, fit: BoxFit.contain),
          ),
          SizedBox(height: s(16)),
        ],
        Text(
          data.schoolNameEn,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: s(_schoolFontSize),
            fontWeight: FontWeight.w700,
            color: Colors.black,
            height: 1.15,
          ),
        ),
        if (data.schoolNameAr.trim().isNotEmpty)
          Padding(
            padding: EdgeInsets.only(top: s(4)),
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: Text(
                data.schoolNameAr,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: s(_schoolFontSize),
                  fontWeight: FontWeight.w700,
                  color: Colors.black,
                  height: 1.3,
                ),
              ),
            ),
          ),
        SizedBox(height: s(18)),
        Container(height: s(2), width: double.infinity, color: Colors.black),
        SizedBox(height: s(18)),
        if (data.isPriority)
          Container(
            margin: EdgeInsets.only(bottom: s(10)),
            padding: EdgeInsets.symmetric(horizontal: s(16), vertical: s(6)),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.black, width: s(2)),
              borderRadius: BorderRadius.circular(s(6)),
            ),
            child: Text(
              'PRIORITY',
              style: TextStyle(
                fontSize: s(_footerFontSize),
                fontWeight: FontWeight.w800,
                letterSpacing: s(2),
                color: Colors.black,
              ),
            ),
          ),
        Text(
          data.tokenCode,
          style: TextStyle(
            fontSize: s(_tokenFontSize),
            fontWeight: FontWeight.w900,
            height: 1.0,
            color: Colors.black,
            letterSpacing: s(2),
          ),
        ),
        SizedBox(height: s(14)),
        Text(
          data.departmentNameEn,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: s(_departmentFontSize),
            fontWeight: FontWeight.w600,
            color: Colors.black,
          ),
        ),
        if (data.departmentNameAr.trim().isNotEmpty)
          Directionality(
            textDirection: TextDirection.rtl,
            child: Text(
              data.departmentNameAr,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: s(_departmentFontSize),
                fontWeight: FontWeight.w600,
                color: Colors.black,
              ),
            ),
          ),
        // Boxed like the PRIORITY tag, and for the same reason: on a 1-bit
        // thermal head a rule is the only emphasis that survives, and this is
        // the line the visitor re-reads while they wait.
        if (aheadLine != null) ...[
          SizedBox(height: s(16)),
          Container(
            width: double.infinity,
            padding: EdgeInsets.symmetric(horizontal: s(12), vertical: s(10)),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.black, width: s(2)),
              borderRadius: BorderRadius.circular(s(6)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  aheadLine.en,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: s(_aheadFontSize),
                    fontWeight: FontWeight.w800,
                    color: Colors.black,
                    height: 1.2,
                  ),
                ),
                Directionality(
                  textDirection: TextDirection.rtl,
                  child: Text(
                    aheadLine.ar,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: s(_aheadFontSize),
                      fontWeight: FontWeight.w800,
                      color: Colors.black,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
        SizedBox(height: s(20)),
        Container(height: s(2), width: double.infinity, color: Colors.black),
        SizedBox(height: s(16)),
        Text(
          _formatTimestamp(data.issuedAt),
          style: TextStyle(fontSize: s(_metaFontSize), color: Colors.black87),
        ),
        if (data.footerEn.trim().isNotEmpty)
          Padding(
            padding: EdgeInsets.only(top: s(12)),
            child: Text(
              data.footerEn,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: s(_footerFontSize), color: Colors.black87),
            ),
          ),
        if (data.footerAr.trim().isNotEmpty)
          Padding(
            padding: EdgeInsets.only(top: s(4)),
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: Text(
                data.footerAr,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: s(_footerFontSize), color: Colors.black87),
              ),
            ),
          ),
        if (data.publicUrl != null && data.publicUrl!.trim().isNotEmpty) ...[
          SizedBox(height: s(16)),
          QrImageView(
            data: data.publicUrl!,
            size: _qrDots,
            padding: EdgeInsets.zero,
            backgroundColor: Colors.white,
            // M, not H: H forces enough extra modules on a ~45-char URL to
            // print unscannably dense at a size that still fits the ticket.
            errorCorrectionLevel: QrErrorCorrectLevel.M,
            gapless: true,
          ),
          SizedBox(height: s(6)),
          Text(
            qrCaptionLine().en,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: s(_qrCaptionFontSize),
              fontWeight: FontWeight.w700,
              color: Colors.black,
            ),
          ),
          Padding(
            padding: EdgeInsets.only(top: s(2)),
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: Text(
                qrCaptionLine().ar,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: s(_qrCaptionFontSize),
                  fontWeight: FontWeight.w700,
                  color: Colors.black,
                ),
              ),
            ),
          ),
          // Scan-failure fallback: costs a few mm of paper, saves a support
          // call from someone whose camera can't get a lock on it.
          Padding(
            padding: EdgeInsets.only(top: s(4)),
            child: Text(
              data.publicUrl!.replaceFirst(RegExp(r'^https?://'), ''),
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: s(20), color: Colors.black87),
            ),
          ),
        ],
      ],
    ),
  );
}

String _formatTimestamp(DateTime dt) {
  final local = dt.toLocal();
  String two(int v) => v.toString().padLeft(2, '0');
  final hour12 = local.hour % 12 == 0 ? 12 : local.hour % 12;
  final ampm = local.hour >= 12 ? 'PM' : 'AM';
  return '${two(local.day)}/${two(local.month)}/${local.year} '
      '${two(hour12)}:${two(local.minute)} $ampm';
}

/// A ruler-style ticket for the setup wizard's printer calibration step: it
/// marks every 8-dot (1mm) increment across the full head width so the
/// installer can read off exactly how far the printer actually reached and
/// confirm 58mm vs 80mm — far more reliable than any ESC/POS status query.
Widget buildCalibrationWidget({required int widthDots}) {
  final marks = <Widget>[];
  for (var mm = 0; mm * 8 <= widthDots; mm += 10) {
    marks.add(Positioned(
      left: (mm * 8).toDouble(),
      top: 0,
      child: SizedBox(
        width: 40,
        child: Text('$mm', style: const TextStyle(fontSize: 14, color: Colors.black)),
      ),
    ));
  }
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: 16),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const Text(
          'PRINTER CALIBRATION',
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.black),
        ),
        const SizedBox(height: 4),
        const Text(
          'Ruler marks every 10mm. Note the last one that printed.',
          style: TextStyle(fontSize: 14, color: Colors.black87),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: widthDots.toDouble(),
          height: 26,
          child: Stack(children: marks),
        ),
        Container(width: widthDots.toDouble(), height: 4, color: Colors.black),
        SizedBox(height: 16, width: widthDots.toDouble()),
      ],
    ),
  );
}
