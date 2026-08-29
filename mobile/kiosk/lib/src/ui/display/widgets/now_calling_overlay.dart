import 'package:flutter/material.dart';

import '../../../models/board_packet.dart';
import '../../dept_icon.dart';
import '../../theme.dart';

/// Full-screen flash for one just-called token, shown for [NowCallingOverlay.flashDuration]
/// then dismissed by key — mirrors `SchoolBoard.tsx`'s `dismissedKey` behaviour.
/// Sized off the viewport, the same idea as the kiosk's confirmation overlay.
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

    return Positioned.fill(
      child: GestureDetector(
        onTap: onDismiss,
        child: Container(
          color: Colors.black.withValues(alpha: 0.82),
          alignment: Alignment.center,
          child: LayoutBuilder(builder: (context, c) {
            final tokenFont = (c.maxHeight * 0.22).clamp(64.0, 220.0);
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 8),
                  decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(999)),
                  child: const Text('NOW CALLING',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, letterSpacing: 3)),
                ),
                const SizedBox(height: 24),
                Text(
                  counter.tokenCode ?? '',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: tokenFont,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 4,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  counter.nameEn,
                  style: const TextStyle(color: Colors.white70, fontSize: 34, fontWeight: FontWeight.w600),
                ),
                if (counter.nameAr.isNotEmpty)
                  Directionality(
                    textDirection: TextDirection.rtl,
                    child: Text(
                      counter.nameAr,
                      style: const TextStyle(color: Colors.white70, fontSize: 28, fontWeight: FontWeight.w600),
                    ),
                  ),
                if ((counter.departmentEn ?? '').isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      counter.departmentEn!,
                      style: const TextStyle(color: Colors.white54, fontSize: 22),
                    ),
                  ),
                if ((counter.departmentAr ?? '').isNotEmpty)
                  Directionality(
                    textDirection: TextDirection.rtl,
                    child: Text(
                      counter.departmentAr!,
                      style: const TextStyle(color: Colors.white54, fontSize: 18),
                    ),
                  ),
              ],
            );
          }),
        ),
      ),
    );
  }
}
