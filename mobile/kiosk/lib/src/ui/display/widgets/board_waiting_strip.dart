import 'package:flutter/material.dart';

import '../../../models/board_packet.dart';
import '../../dept_icon.dart';
import '../../theme.dart';

/// "How many are still ahead of me" — the one number a waiting parent checks
/// repeatedly, and the reason they look up at the board between calls. It used
/// to be a 14px `Accounts · 18` pill hugging the bottom edge, unreadable from
/// the far side of a lobby; here each department gets a card with the count as
/// the dominant element, and the longest queue is flagged so staff can see the
/// backlog at a glance too.
class BoardWaitingStrip extends StatelessWidget {
  const BoardWaitingStrip({super.key, required this.departments, required this.scale});

  final List<BoardDepartment> departments;
  final double scale;

  @override
  Widget build(BuildContext context) {
    final sorted = [...departments]..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
    if (sorted.isEmpty) return const SizedBox.shrink();

    final total = sorted.fold<int>(0, (sum, d) => sum + d.waiting);
    final busiest = sorted.fold<int>(0, (max, d) => d.waiting > max ? d.waiting : max);

    return Container(
      padding: EdgeInsets.fromLTRB(20 * scale, 16 * scale, 20 * scale, 18 * scale),
      decoration: const BoxDecoration(
        color: KioskPalette.surface,
        border: Border(top: BorderSide(color: KioskPalette.borderStrong, width: 2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: EdgeInsets.only(bottom: 12 * scale, left: 4 * scale),
            child: Row(
              children: [
                Icon(Icons.hourglass_bottom_rounded,
                    size: 24 * scale, color: KioskPalette.inkSoft),
                SizedBox(width: 8 * scale),
                Text(
                  'NOW WAITING',
                  style: TextStyle(
                    fontSize: 20 * scale,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.6,
                    color: KioskPalette.inkSoft,
                  ),
                ),
                SizedBox(width: 10 * scale),
                Directionality(
                  textDirection: TextDirection.rtl,
                  child: Text(
                    'في الانتظار',
                    style: TextStyle(
                      fontSize: 18 * scale,
                      fontWeight: FontWeight.w600,
                      color: KioskPalette.inkFaint,
                    ),
                  ),
                ),
                const Spacer(),
                Text(
                  'TOTAL $total',
                  style: TextStyle(
                    fontSize: 20 * scale,
                    fontWeight: FontWeight.w800,
                    color: KioskPalette.ink,
                  ),
                ),
              ],
            ),
          ),
          // Up to five departments share the width evenly; beyond that they
          // scroll sideways rather than shrinking below legibility.
          SizedBox(
            height: 108 * scale,
            child: sorted.length <= 5
                ? Row(
                    children: [
                      for (final d in sorted)
                        Expanded(
                          child: Padding(
                            padding: EdgeInsets.only(right: 10 * scale),
                            child: _WaitingCard(
                              department: d,
                              scale: scale,
                              isBusiest: busiest > 0 && d.waiting == busiest,
                            ),
                          ),
                        ),
                    ],
                  )
                : ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: sorted.length,
                    separatorBuilder: (_, _) => SizedBox(width: 10 * scale),
                    itemBuilder: (context, i) => SizedBox(
                      width: 260 * scale,
                      child: _WaitingCard(
                        department: sorted[i],
                        scale: scale,
                        isBusiest: busiest > 0 && sorted[i].waiting == busiest,
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _WaitingCard extends StatelessWidget {
  const _WaitingCard({
    required this.department,
    required this.scale,
    required this.isBusiest,
  });

  final BoardDepartment department;
  final double scale;
  final bool isBusiest;

  @override
  Widget build(BuildContext context) {
    final color = departmentColor(department.color);
    final empty = department.waiting == 0;

    return Container(
      padding: EdgeInsets.symmetric(horizontal: 16 * scale, vertical: 10 * scale),
      decoration: BoxDecoration(
        color: empty ? KioskPalette.surfaceMuted : color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(18 * scale),
        border: Border.all(
          color: empty
              ? KioskPalette.border
              : color.withValues(alpha: isBusiest ? 0.9 : 0.35),
          width: (isBusiest ? 3 : 2) * scale,
        ),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 78 * scale,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                '${department.waiting}',
                style: TextStyle(
                  fontSize: 62 * scale,
                  fontWeight: FontWeight.w900,
                  height: 1.0,
                  fontFeatures: const [FontFeature.tabularFigures()],
                  color: empty ? KioskPalette.inkFaint : color,
                ),
              ),
            ),
          ),
          SizedBox(width: 10 * scale),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  department.nameEn.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 24 * scale,
                    fontWeight: FontWeight.w800,
                    height: 1.15,
                    color: empty ? KioskPalette.inkSoft : KioskPalette.ink,
                  ),
                ),
                if (department.nameAr.isNotEmpty)
                  Directionality(
                    textDirection: TextDirection.rtl,
                    child: Text(
                      department.nameAr,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 18 * scale,
                        fontWeight: FontWeight.w600,
                        height: 1.3,
                        color: KioskPalette.inkSoft,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
