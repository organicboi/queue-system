import 'package:flutter/material.dart';

import '../../i18n/copy.dart';
import '../../models/school_department.dart';
import '../../models/school_token.dart';
import '../dept_icon.dart';
import '../theme.dart';

/// The moment that matters for a parent: their number, big and unmistakable.
/// Covers the service area, auto-dismisses, and can be dismissed with a tap
/// anywhere — an anxious visitor should not have to find a button.
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
  });

  final SchoolToken token;
  final SchoolDepartment department;
  final String lang;
  final KioskCopy copy;
  final VoidCallback onDismiss;

  @override
  State<ConfirmationOverlay> createState() => _ConfirmationOverlayState();
}

class _ConfirmationOverlayState extends State<ConfirmationOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _in = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 260),
  )..forward();

  @override
  void dispose() {
    _in.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // The ink variant, not the raw pick: this number is set on white, where
    // a pale admin colour would be unreadable. (The service cards use
    // `departmentFill` for the opposite reason — white on the colour.)
    final color = departmentInk(departmentColor(widget.department.color));
    final curve = CurvedAnimation(parent: _in, curve: Curves.easeOutBack);

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
              final cardWidth = (w * 0.62).clamp(320.0, 760.0);

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
                          ConstrainedBox(
                            constraints: BoxConstraints(maxWidth: cardWidth),
                            child: Container(
                              padding: EdgeInsets.symmetric(
                                horizontal: 36,
                                vertical: gap * 1.6,
                              ),
                              decoration: BoxDecoration(
                                color: KioskPalette.surface,
                                borderRadius: BorderRadius.circular(28),
                                border:
                                    Border.all(color: KioskPalette.border),
                                boxShadow: KioskPalette.cardShadow,
                              ),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const _SuccessMark(),
                                  SizedBox(height: gap * 0.8),
                                  Text(
                                    widget.copy.yourToken.toUpperCase(),
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
                                      widget.token.tokenCode,
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
                                        icon: departmentIcon(
                                            widget.department.icon),
                                        label: widget.department
                                            .name(widget.lang),
                                        color: color,
                                      ),
                                      if (widget.token.isPriority)
                                        _Chip(
                                          icon: Icons.star_rounded,
                                          label: widget.copy.priorityTag,
                                          color: KioskPalette.priority,
                                        ),
                                    ],
                                  ),
                                  SizedBox(height: gap),
                                  Text(
                                    widget.copy.watch,
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      fontSize: 16,
                                      color: KioskPalette.inkSoft,
                                    ),
                                  ),
                                  SizedBox(height: gap * 1.3),
                                  FilledButton(
                                    onPressed: widget.onDismiss,
                                    style: FilledButton.styleFrom(
                                      minimumSize: const Size(220, 58),
                                    ),
                                    child: Text(widget.copy.doneLabel),
                                  ),
                                ],
                              ),
                            ),
                          ),
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
