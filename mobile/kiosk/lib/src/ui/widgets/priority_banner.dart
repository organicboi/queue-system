import 'package:flutter/material.dart';

import '../../i18n/copy.dart';
import '../theme.dart';

/// "Arm the next ticket as priority" — a kiosk-side switch, not a per-tap
/// parameter (matches `priorityArmed` in SchoolKiosk.tsx).
///
/// Two shapes for one control. [compact] rides alongside the "select a
/// service" heading on a wide terminal, where a full-width bar would have
/// pushed the service cards down for something most visitors never touch; the
/// full shape stacks under the heading on a narrow screen. Both stay well over
/// the 48dp touch minimum.
class PriorityBanner extends StatelessWidget {
  const PriorityBanner({
    super.key,
    required this.armed,
    required this.onToggle,
    required this.copy,
    this.compact = false,
  });

  final bool armed;
  final VoidCallback onToggle;
  final KioskCopy copy;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(KioskPalette.radiusPill);

    return Material(
      color: armed ? KioskPalette.prioritySoft : KioskPalette.surface,
      borderRadius: radius,
      child: InkWell(
        onTap: onToggle,
        borderRadius: radius,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: EdgeInsets.symmetric(
            horizontal: compact ? 18 : 22,
            vertical: compact ? 12 : 16,
          ),
          decoration: BoxDecoration(
            borderRadius: radius,
            border: Border.all(
              color: armed ? KioskPalette.priority : KioskPalette.border,
              width: armed ? 1.5 : 1,
            ),
          ),
          child: Row(
            mainAxisSize: compact ? MainAxisSize.min : MainAxisSize.max,
            children: [
              Icon(
                Icons.accessible_rounded,
                size: compact ? 24 : 28,
                color: armed ? KioskPalette.priority : KioskPalette.inkSoft,
              ),
              SizedBox(width: compact ? 12 : 16),
              compact
                  ? _CompactLabel(armed: armed, copy: copy)
                  : Expanded(child: _FullLabel(armed: armed, copy: copy)),
              SizedBox(width: compact ? 14 : 12),
              _Track(armed: armed),
            ],
          ),
        ),
      ),
    );
  }
}

class _FullLabel extends StatelessWidget {
  const _FullLabel({required this.armed, required this.copy});
  final bool armed;
  final KioskCopy copy;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          copy.priority,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: KioskPalette.ink,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          armed ? copy.priorityArmed : copy.priorityHint,
          style: TextStyle(
            fontSize: 14,
            color: armed ? KioskPalette.priority : KioskPalette.inkSoft,
          ),
        ),
      ],
    );
  }
}

/// One line, no helper text: the armed state is carried by the colour and the
/// switch, so spelling it out beside the heading would just be noise.
class _CompactLabel extends StatelessWidget {
  const _CompactLabel({required this.armed, required this.copy});
  final bool armed;
  final KioskCopy copy;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 210),
      child: Text(
        copy.priority,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w700,
          color: armed ? KioskPalette.priority : KioskPalette.ink,
        ),
      ),
    );
  }
}

class _Track extends StatelessWidget {
  const _Track({required this.armed});
  final bool armed;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      width: 54,
      height: 32,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: armed ? KioskPalette.priority : KioskPalette.borderStrong,
        borderRadius: BorderRadius.circular(KioskPalette.radiusPill),
      ),
      child: AnimatedAlign(
        duration: const Duration(milliseconds: 160),
        alignment: armed ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          width: 24,
          height: 24,
          decoration: const BoxDecoration(
            color: Colors.white,
            shape: BoxShape.circle,
          ),
        ),
      ),
    );
  }
}
