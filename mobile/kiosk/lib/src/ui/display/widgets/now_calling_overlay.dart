import 'package:flutter/material.dart';

import '../../../models/board_packet.dart';
import '../../dept_icon.dart';
import '../../theme.dart';

/// Full-screen flash for one just-called token, shown for [NowCallingOverlay.flashDuration]
/// then dismissed by key — mirrors `SchoolBoard.tsx`'s `dismissedKey` behaviour.
/// Sized off the viewport, the same idea as the kiosk's confirmation overlay.
///
/// The department leads, above the token: from the back of a lobby the first
/// thing that has to land is *whose* queue moved, so a parent waiting on
/// Admissions can ignore an Accounts call without decoding a number first.
class NowCallingOverlay extends StatelessWidget {
  const NowCallingOverlay({super.key, required this.counter, required this.onDismiss});

  final BoardCounter counter;
  final VoidCallback onDismiss;

  static const flashDuration = Duration(seconds: 8);

  @override
  Widget build(BuildContext context) {
    final color = counter.departmentColor != null
        ? departmentColor(counter.departmentColor!)
        : KioskPalette.primary;
    final departmentEn = counter.departmentEn ?? '';
    final departmentAr = counter.departmentAr ?? '';

    return Positioned.fill(
      child: GestureDetector(
        onTap: onDismiss,
        child: Container(
          color: Colors.black.withValues(alpha: 0.86),
          alignment: Alignment.center,
          child: LayoutBuilder(builder: (context, c) {
            final unit = c.maxHeight / 1080;
            final tokenFont = (c.maxHeight * 0.30).clamp(96.0, 340.0);
            return Padding(
              padding: EdgeInsets.symmetric(horizontal: 48 * unit),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 34 * unit, vertical: 12 * unit),
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      'NOW CALLING',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 34 * unit,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 5,
                      ),
                    ),
                  ),
                  if (departmentEn.isNotEmpty) ...[
                    SizedBox(height: 28 * unit),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        departmentEn.toUpperCase(),
                        maxLines: 1,
                        style: TextStyle(
                          color: color,
                          fontSize: 68 * unit,
                          fontWeight: FontWeight.w800,
                          height: 1.1,
                          letterSpacing: 2,
                        ),
                      ),
                    ),
                    if (departmentAr.isNotEmpty)
                      Directionality(
                        textDirection: TextDirection.rtl,
                        child: Text(
                          departmentAr,
                          maxLines: 1,
                          style: TextStyle(
                            color: color.withValues(alpha: 0.85),
                            fontSize: 44 * unit,
                            fontWeight: FontWeight.w700,
                            height: 1.25,
                          ),
                        ),
                      ),
                  ],
                  SizedBox(height: 20 * unit),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      counter.tokenCode ?? '',
                      maxLines: 1,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: tokenFont,
                        fontWeight: FontWeight.w900,
                        height: 1.0,
                        letterSpacing: 6,
                      ),
                    ),
                  ),
                  SizedBox(height: 24 * unit),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      counter.nameEn,
                      maxLines: 1,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 58 * unit,
                        fontWeight: FontWeight.w700,
                        height: 1.1,
                      ),
                    ),
                  ),
                  if (counter.nameAr.isNotEmpty)
                    Directionality(
                      textDirection: TextDirection.rtl,
                      child: Text(
                        counter.nameAr,
                        maxLines: 1,
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 40 * unit,
                          fontWeight: FontWeight.w600,
                          height: 1.3,
                        ),
                      ),
                    ),
                ],
              ),
            );
          }),
        ),
      ),
    );
  }
}
