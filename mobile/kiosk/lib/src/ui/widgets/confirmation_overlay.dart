import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../i18n/copy.dart';
import '../../models/school_department.dart';
import '../../models/school_token.dart';
import '../../printing/ticket_widget.dart' show qrCaptionLine;
import '../dept_icon.dart';
import '../theme.dart';

/// The moment that matters for a parent: their number, big and unmistakable.
/// Covers the service area, auto-dismisses, and can be dismissed with a tap
/// anywhere — an anxious visitor should not have to find a button.
///
/// When the branch has public tracking on for this token ([publicUrl] is
/// non-null — same gate `escpos_printer.dart` uses for the printed ticket's
/// QR), the token card moves to the left and a second card appears to its
/// right with an on-screen QR and a progress bar counting down [linger],
/// which is the whole reason the overlay stays up for [linger] instead of
/// the shorter no-QR default — long enough to actually raise a phone and
/// scan before it disappears. Either way, the "next customer" button and the
/// tap-anywhere gesture let it be skipped early — a visitor who's already
/// walked off shouldn't hold the kiosk hostage for the next one.
///
/// Sizing is derived from the available height so it stays whole on a short
/// viewport (dev phone in landscape) as well as the 1366×768 kiosk.
class ConfirmationOverlay extends StatefulWidget {
  const ConfirmationOverlay({
    super.key,
    required this.token,
    required this.department,
    required this.lang,
    required this.copy,
    required this.onDismiss,
    this.publicUrl,
    this.linger = const Duration(seconds: 3),
  });

  final SchoolToken token;
  final SchoolDepartment department;
  final String lang;
  final KioskCopy copy;
  final VoidCallback onDismiss;

  /// The tracking-page URL to render as a QR, or null when public tracking
  /// isn't on for this branch/token — in which case no QR card is shown at
  /// all and the layout is exactly the single-card confirmation it always
  /// was.
  final String? publicUrl;

  /// How long this overlay stays up before auto-dismissing (set by the
  /// caller — see `AppConfig.heroLinger` / `AppConfig.qrLinger`). Also drives
  /// the QR card's countdown bar, so the two are always in lockstep.
  final Duration linger;

  @override
  State<ConfirmationOverlay> createState() => _ConfirmationOverlayState();
}

class _ConfirmationOverlayState extends State<ConfirmationOverlay>
    with TickerProviderStateMixin {
  late final AnimationController _in = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 260),
  )..forward();

  // Only exists when there's a QR to count down for — no point ticking a
  // controller nobody reads.
  late final AnimationController? _countdown = widget.publicUrl != null
      ? (AnimationController(vsync: this, duration: widget.linger)..forward())
      : null;

  @override
  void dispose() {
    _in.dispose();
    _countdown?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // The ink variant, not the raw pick: this number is set on white, where
    // a pale admin colour would be unreadable. (The service cards use
    // `departmentFill` for the opposite reason — white on the colour.)
    final color = departmentInk(departmentColor(widget.department.color));
    final curve = CurvedAnimation(parent: _in, curve: Curves.easeOutBack);
    final hasQr = widget.publicUrl != null;

    return Positioned.fill(
      child: GestureDetector(
        onTap: widget.onDismiss,
        behavior: HitTestBehavior.opaque,
        child: Container(
          color: KioskPalette.bg,
          child: LayoutBuilder(
            builder: (context, box) {
              final h = box.maxHeight.isFinite ? box.maxHeight : 680.0;
              final w = box.maxWidth.isFinite ? box.maxWidth : 1024.0;
              // Number scales with the panel; spacing scales with it too so a
              // short viewport tightens instead of overflowing. The FittedBox
              // is the final guard.
              final tokenFont = (h * 0.24).clamp(46.0, 168.0);
              final gap = (h * 0.028).clamp(6.0, 24.0);
              final pad = (h * 0.04).clamp(12.0, 40.0);

              // Side by side once there's room for both cards to breathe;
              // otherwise the QR card drops beneath the token card rather
              // than squeezing either one unreadable.
              final sideBySide = hasQr && w >= 760;
              final tokenCardWidth = hasQr
                  ? (sideBySide ? w * 0.34 : w * 0.62).clamp(300.0, 520.0)
                  : (w * 0.62).clamp(320.0, 760.0);
              final qrCardWidth = (sideBySide ? w * 0.24 : w * 0.62)
                  .clamp(260.0, 380.0);

              final tokenCard = _TokenCard(
                width: tokenCardWidth,
                gap: gap,
                tokenFont: tokenFont,
                token: widget.token,
                department: widget.department,
                lang: widget.lang,
                copy: widget.copy,
                departmentColor: color,
                onDismiss: widget.onDismiss,
              );

              final cards = hasQr
                  ? (sideBySide
                      ? Row(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            tokenCard,
                            SizedBox(width: gap * 1.6),
                            _QrCard(
                              width: qrCardWidth,
                              gap: gap,
                              publicUrl: widget.publicUrl!,
                              lang: widget.lang,
                              copy: widget.copy,
                              countdown: _countdown!,
                            ),
                          ],
                        )
                      : Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            tokenCard,
                            SizedBox(height: gap * 1.2),
                            _QrCard(
                              width: qrCardWidth,
                              gap: gap,
                              publicUrl: widget.publicUrl!,
                              lang: widget.lang,
                              copy: widget.copy,
                              countdown: _countdown!,
                            ),
                          ],
                        ))
                  : tokenCard;

              return FadeTransition(
                opacity: _in,
                child: ScaleTransition(
                  scale: Tween(begin: 0.96, end: 1.0).animate(curve),
                  child: SingleChildScrollView(
                    padding: EdgeInsets.all(pad),
                    child: ConstrainedBox(
                      constraints: BoxConstraints(minHeight: h - pad * 2),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          cards,
                          SizedBox(height: gap * 0.9),
                          Text(
                            widget.copy.tapAnywhere,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 14,
                              color: KioskPalette.inkFaint,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

/// The original single card: checkmark, token code, department/priority
/// chips, and the button that skips the rest of the linger. Unchanged in
/// content from before the QR card existed — only its width is now handed
/// in rather than computed locally, so it can shrink to make room.
class _TokenCard extends StatelessWidget {
  const _TokenCard({
    required this.width,
    required this.gap,
    required this.tokenFont,
    required this.token,
    required this.department,
    required this.lang,
    required this.copy,
    required this.departmentColor,
    required this.onDismiss,
  });

  final double width;
  final double gap;
  final double tokenFont;
  final SchoolToken token;
  final SchoolDepartment department;
  final String lang;
  final KioskCopy copy;
  final Color departmentColor;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: width),
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 36, vertical: gap * 1.6),
        decoration: BoxDecoration(
          color: KioskPalette.surface,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: KioskPalette.border),
          boxShadow: KioskPalette.cardShadow,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const _SuccessMark(),
            SizedBox(height: gap * 0.8),
            Text(
              copy.yourToken.toUpperCase(),
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                letterSpacing: 2.5,
                color: KioskPalette.inkFaint,
              ),
            ),
            SizedBox(height: gap * 0.4),
            FittedBox(
              child: Text(
                token.tokenCode,
                style: TextStyle(
                  fontSize: tokenFont,
                  height: 1.0,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -2,
                  color: KioskPalette.primary,
                ),
              ),
            ),
            SizedBox(height: gap),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 10,
              runSpacing: 8,
              children: [
                _Chip(
                  icon: departmentIcon(department.icon),
                  label: department.name(lang),
                  color: departmentColor,
                ),
                if (token.isPriority)
                  _Chip(
                    icon: Icons.star_rounded,
                    label: copy.priorityTag,
                    color: KioskPalette.priority,
                  ),
              ],
            ),
            SizedBox(height: gap),
            Text(
              copy.watch,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 16,
                color: KioskPalette.inkSoft,
              ),
            ),
            SizedBox(height: gap * 1.3),
            FilledButton(
              onPressed: onDismiss,
              style: FilledButton.styleFrom(minimumSize: const Size(220, 58)),
              child: Text(copy.newTokenLabel),
            ),
          ],
        ),
      ),
    );
  }
}

/// The QR card shown only when this token has a public-tracking URL. Its
/// countdown bar shares the same [AnimationController] the overlay's total
/// linger is timed with, so "the bar runs out" and "the overlay closes"
/// are the same event, never two clocks that can drift apart.
class _QrCard extends StatelessWidget {
  const _QrCard({
    required this.width,
    required this.gap,
    required this.publicUrl,
    required this.lang,
    required this.copy,
    required this.countdown,
  });

  final double width;
  final double gap;
  final String publicUrl;
  final String lang;
  final KioskCopy copy;
  final AnimationController countdown;

  @override
  Widget build(BuildContext context) {
    final caption = qrCaptionLine();
    final qrSize = (width * 0.56).clamp(130.0, 200.0);

    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: width),
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 28, vertical: gap * 1.6),
        decoration: BoxDecoration(
          color: KioskPalette.surface,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: KioskPalette.border),
          boxShadow: KioskPalette.cardShadow,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: const BoxDecoration(
                color: KioskPalette.primarySoft,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.qr_code_scanner_rounded,
                size: 28,
                color: KioskPalette.primary,
              ),
            ),
            SizedBox(height: gap * 0.8),
            Text(
              copy.trackTurn.toUpperCase(),
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                letterSpacing: 2.5,
                color: KioskPalette.inkFaint,
              ),
            ),
            SizedBox(height: gap * 0.8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: KioskPalette.border),
              ),
              child: QrImageView(
                data: publicUrl,
                version: QrVersions.auto,
                size: qrSize,
                padding: EdgeInsets.zero,
                gapless: true,
                backgroundColor: Colors.white,
                // Same M level as the printed ticket's QR (ticket_widget.dart)
                // — H would pack this ~45-char URL into more modules than a
                // handheld phone camera needs to fight at kiosk-screen size.
                errorCorrectionLevel: QrErrorCorrectLevel.M,
              ),
            ),
            SizedBox(height: gap * 0.7),
            Text(
              lang == 'ar' ? caption.ar : caption.en,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 15, color: KioskPalette.inkSoft),
            ),
            SizedBox(height: gap),
            // The 10-second window itself, rolling down in lockstep with the
            // overlay's own auto-dismiss timer.
            AnimatedBuilder(
              animation: countdown,
              builder: (context, _) {
                return ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: SizedBox(
                    height: 6,
                    child: LinearProgressIndicator(
                      value: (1.0 - countdown.value).clamp(0.0, 1.0),
                      backgroundColor: KioskPalette.surfaceMuted,
                      valueColor:
                          const AlwaysStoppedAnimation(KioskPalette.primary),
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _SuccessMark extends StatelessWidget {
  const _SuccessMark();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 52,
      height: 52,
      decoration: const BoxDecoration(
        color: KioskPalette.successSoft,
        shape: BoxShape.circle,
      ),
      child: const Icon(
        Icons.check_rounded,
        size: 30,
        color: KioskPalette.success,
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.label, required this.color});
  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(KioskPalette.radiusPill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 20, color: color),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
