import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../i18n/hospital_copy.dart';
import '../../models/hospital/hospital_department.dart';
import '../../models/hospital/hospital_doctor.dart';
import '../../models/hospital/hospital_token.dart';
import '../dept_icon.dart';
import '../theme.dart';

/// Everything the token screen needs to describe one issued token, gathered at
/// the moment the server answered. Held rather than re-derived because the
/// feed keeps polling underneath — the number of people ahead of *this*
/// patient is the count when they joined, not a figure that ticks down while
/// they read it.
class HospitalIssuedToken {
  const HospitalIssuedToken({
    required this.token,
    required this.department,
    required this.doctor,
    required this.waitingAhead,
    required this.publicUrl,
  });

  final HospitalToken token;
  final HospitalDepartment department;
  final HospitalDoctor? doctor;

  /// Null when the server couldn't be asked — the line is then left off
  /// rather than shown with a number that isn't true.
  final int? waitingAhead;

  /// The public tracking URL to render as a QR, or null when tracking is off
  /// for this branch — in which case no QR card is shown at all.
  final String? publicUrl;
}

/// The moment that matters for a patient: their number, big and unmistakable.
///
/// Deliberately the school kiosk's confirmation, part for part — the same
/// success mark, the same tracked-out label over a card-sized numeral, the
/// same chips, the same QR card with a countdown bar beside it. Two terminals
/// in one lobby should not disagree about what "you have a number" looks like,
/// and the school layout has already been through the panel sizes this one
/// has to survive. What is hospital-specific rides in the chips and one line:
/// the doctor, the priority the patient declared, and how many people are in
/// front of them.
///
/// It auto-dismisses on the branch's own idle timer, but a patient who has
/// already read their number — or the one standing behind them — can end it
/// with a tap anywhere or the button. Nobody should have to hold a kiosk
/// hostage for the next person.
class HospitalTokenView extends StatefulWidget {
  const HospitalTokenView({
    super.key,
    required this.hero,
    required this.lang,
    required this.copy,
    required this.linger,
    required this.onDismiss,
  });

  final HospitalIssuedToken hero;
  final String lang;
  final HospitalCopy copy;

  /// How long the screen stays up on its own. Drives the QR card's countdown
  /// bar, so "the bar runs out" and "the screen closes" are the same event
  /// rather than two clocks that can drift apart.
  final Duration linger;
  final VoidCallback onDismiss;

  @override
  State<HospitalTokenView> createState() => _HospitalTokenViewState();
}

class _HospitalTokenViewState extends State<HospitalTokenView>
    with TickerProviderStateMixin {
  late final AnimationController _in = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 260),
  )..forward();

  // Only exists when there's a QR to count down for — no point ticking a
  // controller nobody reads.
  late final AnimationController? _countdown = widget.hero.publicUrl != null
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
    final hero = widget.hero;
    final copy = widget.copy;
    // The ink variant, not the raw pick: this colour is set on white, where a
    // pale admin choice would be unreadable. (The grid uses the block fill for
    // the opposite reason — ink on the colour.)
    final deptColor = departmentInk(departmentColor(hero.department.color));
    final curve = CurvedAnimation(parent: _in, curve: Curves.easeOutBack);
    final hasQr = hero.publicUrl != null;

    return GestureDetector(
      onTap: widget.onDismiss,
      behavior: HitTestBehavior.opaque,
      child: Container(
        color: KioskPalette.bg,
        child: LayoutBuilder(
          builder: (context, box) {
            final h = box.maxHeight.isFinite ? box.maxHeight : 680.0;
            final w = box.maxWidth.isFinite ? box.maxWidth : 1024.0;
            // The number scales with the panel and spacing scales with it too,
            // so a short viewport tightens instead of overflowing. The
            // FittedBox inside the card is the final guard.
            final tokenFont = (h * 0.24).clamp(46.0, 168.0);
            final gap = (h * 0.028).clamp(6.0, 24.0);
            final pad = (h * 0.04).clamp(12.0, 40.0);
            final cardHeight = (h * 0.85).clamp(560.0, 680.0);

            // Side by side once there's room for both cards to breathe;
            // otherwise the QR card drops beneath the token card rather than
            // squeezing either one unreadable.
            // The wide confirmation composition needs room for the detail
            // panel and QR panel without squeezing either one. Smaller kiosks
            // stack them vertically.
            final sideBySide = hasQr && w >= 900;
            final qrCardWidth =
                (sideBySide ? math.min(420.0, w * 0.28) : w * 0.62).clamp(
                  300.0,
                  420.0,
                );
            final tokenCardWidth = sideBySide
                ? double.infinity
                : (w * 0.88).clamp(360.0, 1180.0);

            final tokenCard = _TokenCard(
              width: tokenCardWidth,
              height: cardHeight,
              gap: gap,
              tokenFont: tokenFont,
              hero: hero,
              lang: widget.lang,
              copy: copy,
              departmentColor: deptColor,
              onDismiss: widget.onDismiss,
            );

            final qrCard = hasQr
                ? _QrCard(
                    width: qrCardWidth,
                    height: cardHeight,
                    gap: gap,
                    publicUrl: hero.publicUrl!,
                    lang: widget.lang,
                    copy: copy,
                    countdown: _countdown!,
                  )
                : null;

            final cards = qrCard == null
                ? tokenCard
                : sideBySide
                ? SizedBox(
                    width: double.infinity,
                    height: cardHeight,
                    child: Row(
                      children: [
                        Expanded(child: tokenCard),
                        SizedBox(width: gap * 1.6),
                        qrCard,
                      ],
                    ),
                  )
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      tokenCard,
                      SizedBox(height: gap * 1.2),
                      qrCard,
                    ],
                  );

            return FadeTransition(
              opacity: _in,
              child: ScaleTransition(
                scale: Tween(begin: 0.96, end: 1.0).animate(curve),
                child: SingleChildScrollView(
                  // Desktop/kiosk success screens are locked to one viewport;
                  // the compact fallback keeps a safety scroll for very small
                  // development panels only.
                  physics: h >= 650
                      ? const NeverScrollableScrollPhysics()
                      : const ClampingScrollPhysics(),
                  padding: EdgeInsets.all(pad),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: h - pad * 2),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (w >= 1100)
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 26,
                              vertical: 18,
                            ),
                            color: departmentColor(hero.department.color),
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.check_circle_rounded,
                                  color: Colors.white,
                                  size: 28,
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  copy.yourToken,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 19,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const Spacer(),
                                Flexible(
                                  child: Text(
                                    '${hero.department.nameFor(widget.lang)}${hero.doctor == null ? '' : ' · ${hero.doctor!.name}'}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    textAlign: TextAlign.end,
                                    style: TextStyle(
                                      color: Colors.white.withValues(
                                        alpha: 0.9,
                                      ),
                                      fontSize: 15,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        if (w >= 1100) SizedBox(height: gap),
                        cards,
                        SizedBox(height: gap * 0.9),
                        Text(
                          copy.tapAnywhere,
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
    );
  }
}

/// Success mark, token code, the chips that say what this number is for, and
/// the button that skips the rest of the linger.
class _TokenCard extends StatelessWidget {
  const _TokenCard({
    required this.width,
    required this.height,
    required this.gap,
    required this.tokenFont,
    required this.hero,
    required this.lang,
    required this.copy,
    required this.departmentColor,
    required this.onDismiss,
  });

  final double width;
  final double height;
  final double gap;
  final double tokenFont;
  final HospitalIssuedToken hero;
  final String lang;
  final HospitalCopy copy;
  final Color departmentColor;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final priority = HospitalPriorityCategory.labelFor(
      hero.token.priorityCategory,
      lang,
    );

    return SizedBox(
      width: width,
      height: height,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 36, vertical: gap * 1.6),
        decoration: BoxDecoration(
          color: KioskPalette.surface,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: KioskPalette.border),
          boxShadow: KioskPalette.cardShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(height: gap * 0.2),
            Text(
              copy.yourToken.toUpperCase(),
              textAlign: TextAlign.start,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                letterSpacing: 2.5,
                color: KioskPalette.inkFaint,
              ),
            ),
            SizedBox(height: gap * 0.4),
            FittedBox(
              child: Directionality(
                // A token code is a code in every language.
                textDirection: TextDirection.ltr,
                child: Text(
                  hero.token.tokenCode,
                  style: TextStyle(
                    fontSize: tokenFont,
                    height: 1.0,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -2,
                    color: KioskPalette.primary,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ),
            ),
            SizedBox(height: gap),
            Wrap(
              alignment: WrapAlignment.start,
              spacing: 10,
              runSpacing: 8,
              children: [
                _Chip(
                  icon: departmentIcon(hero.department.icon),
                  label: hero.department.nameFor(lang),
                  color: departmentColor,
                ),
                if (hero.doctor != null)
                  _Chip(
                    icon: Icons.medical_services_rounded,
                    label: hero.doctor!.name,
                    color: KioskPalette.primary,
                  ),
                if (priority != null)
                  _Chip(
                    icon: Icons.star_rounded,
                    label: priority,
                    color: KioskPalette.priority,
                  ),
              ],
            ),
            SizedBox(height: gap),
            // The one number a patient wants after their own: how many people
            // are in front of them. Absent when the server couldn't be asked.
            if (hero.waitingAhead != null) ...[
              Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: '${hero.waitingAhead} ',
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: KioskPalette.ink,
                      ),
                    ),
                    TextSpan(text: copy.waiting),
                  ],
                ),
                textAlign: TextAlign.start,
                style: const TextStyle(
                  fontSize: 16,
                  color: KioskPalette.inkSoft,
                ),
              ),
              SizedBox(height: gap * 0.5),
            ],
            Text(
              copy.proceed,
              textAlign: TextAlign.start,
              style: const TextStyle(fontSize: 16, color: KioskPalette.inkSoft),
            ),
            SizedBox(height: gap * 1.3),
            FilledButton(
              onPressed: onDismiss,
              style: FilledButton.styleFrom(minimumSize: const Size(220, 58)),
              child: Text(copy.nextPatient),
            ),
          ],
        ),
      ),
    );
  }
}

/// Shown only when this token has a public-tracking URL. The countdown bar is
/// timed off the same linger the screen dismisses on, so the bar emptying and
/// the screen closing are one event.
class _QrCard extends StatelessWidget {
  const _QrCard({
    required this.width,
    required this.height,
    required this.gap,
    required this.publicUrl,
    required this.lang,
    required this.copy,
    required this.countdown,
  });

  final double width;
  final double height;
  final double gap;
  final String publicUrl;
  final String lang;
  final HospitalCopy copy;
  final AnimationController countdown;

  @override
  Widget build(BuildContext context) {
    final qrSize = (width * 0.56).clamp(130.0, 200.0);

    return SizedBox(
      width: width,
      height: height,
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
                // Same M level as the printed ticket's QR — H would pack this
                // short URL into more modules than a handheld phone camera
                // needs to fight at kiosk-screen size.
                errorCorrectionLevel: QrErrorCorrectLevel.M,
              ),
            ),
            SizedBox(height: gap * 0.7),
            Text(
              copy.scanToTrack,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 15, color: KioskPalette.inkSoft),
            ),
            SizedBox(height: gap),
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
                      valueColor: const AlwaysStoppedAnimation(
                        KioskPalette.primary,
                      ),
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
