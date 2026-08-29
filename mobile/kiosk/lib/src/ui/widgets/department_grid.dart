import 'package:flutter/material.dart';

import '../../i18n/copy.dart';
import '../../models/school_department.dart';
import '../dept_icon.dart';
import '../theme.dart';

/// The service-selection grid — the primary surface a parent interacts with.
/// Big cards, generous hit targets. Tapping issues a token; the handler returns
/// immediately (printing is queued), so a card only shows a spinner while its
/// own request is in flight.
///
/// When the grid is given a bounded height it sizes its rows to *fill* that
/// height rather than leaving a strip of dead space under the last row. On a
/// kiosk this matters twice over: nobody should have to discover that the
/// screen scrolls to find their service.
class DepartmentGrid extends StatelessWidget {
  const DepartmentGrid({
    super.key,
    required this.departments,
    required this.lang,
    required this.waitingByDepartment,
    required this.issuingDeptId,
    required this.copy,
    required this.onTap,
    this.shrinkWrap = false,
  });

  final List<SchoolDepartment> departments;
  final String lang;
  final Map<String, int> waitingByDepartment;
  final String? issuingDeptId;
  final KioskCopy copy;
  final ValueChanged<SchoolDepartment> onTap;
  final bool shrinkWrap;

  static const _spacing = 18.0;

  /// A card is never shorter than this — below it even the condensed layout
  /// stops fitting. See [_Card.compactBelow]. Both ends scale with the device
  /// so a large panel fills instead of stranding a band of dead space under
  /// the last row, and a small one still fits its content.
  static const _minRowExtent = 140.0;
  static const _maxRowExtent = 250.0;

  @override
  Widget build(BuildContext context) {
    final sorted = [...departments]
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
    final scale = kioskScale(context);
    final minRow = _minRowExtent * scale;
    final maxRow = _maxRowExtent * scale;
    final spacing = _spacing * scale;

    return LayoutBuilder(
      builder: (context, constraints) {
        final w = constraints.maxWidth;
        int columns;
        if (w < 560) {
          columns = 1;
        } else if (w < 940) {
          columns = 2;
        } else {
          columns = sorted.length <= 4 ? 2 : 3;
        }
        columns = columns.clamp(1, sorted.isEmpty ? 1 : sorted.length);

        // Fill the column when the height is known; fall back to a width-driven
        // ratio inside a parent scroll view, where height is unbounded. Either
        // way the result is an explicit extent, never a bare aspect ratio — a
        // ratio lets a narrow card collapse to a height its own content cannot
        // fit in, and the clamp is what guarantees it can.
        double rowExtent;
        if (constraints.maxHeight.isFinite && sorted.isNotEmpty) {
          final rows = (sorted.length / columns).ceil();
          rowExtent = (constraints.maxHeight - spacing * (rows - 1)) / rows;
        } else {
          final aspect = columns == 1 ? 3.0 : (columns == 2 ? 1.9 : 1.55);
          rowExtent = (w - spacing * (columns - 1)) / columns / aspect;
        }
        rowExtent = rowExtent.clamp(minRow, maxRow);

        return GridView.builder(
          shrinkWrap: shrinkWrap,
          physics: shrinkWrap ? const NeverScrollableScrollPhysics() : null,
          padding: EdgeInsets.zero,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            mainAxisSpacing: spacing,
            crossAxisSpacing: spacing,
            mainAxisExtent: rowExtent,
          ),
          itemCount: sorted.length,
          itemBuilder: (context, i) {
            final dept = sorted[i];
            return _Card(
              department: dept,
              lang: lang,
              waiting: waitingByDepartment[dept.id] ?? 0,
              busy: issuingDeptId == dept.id,
              dimmed: issuingDeptId != null && issuingDeptId != dept.id,
              copy: copy,
              onTap: () => onTap(dept),
            );
          },
        );
      },
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({
    required this.department,
    required this.lang,
    required this.waiting,
    required this.busy,
    required this.dimmed,
    required this.copy,
    required this.onTap,
  });

  final SchoolDepartment department;
  final String lang;
  final int waiting;
  final bool busy;
  final bool dimmed;
  final KioskCopy copy;
  final VoidCallback onTap;

  /// Under this height (at the reference scale) the roomy layout (two-line name
  /// + the translated name beneath it) no longer fits, so the card drops to one
  /// line and a smaller icon rather than overflowing. Scales with the device
  /// because the text inside scales too. Many departments on a short screen is
  /// the case that gets here.
  static const compactBelow = 190.0;

  @override
  Widget build(BuildContext context) {
    final color = departmentColor(department.color);
    final primaryName = department.name(lang);
    final secondaryName = lang == 'ar' ? department.nameEn : department.nameAr;
    final radius = BorderRadius.circular(KioskPalette.radius);
    final threshold = compactBelow * kioskScale(context);

    return LayoutBuilder(builder: (context, box) {
      final tight = box.maxHeight.isFinite && box.maxHeight < threshold;
      return _build(context, color, primaryName, secondaryName, radius, tight);
    });
  }

  Widget _build(
    BuildContext context,
    Color color,
    String primaryName,
    String secondaryName,
    BorderRadius radius,
    bool tight,
  ) {
    final iconTile = tight ? 46.0 : 54.0;
    final pad = tight
        ? const EdgeInsets.fromLTRB(18, 16, 16, 16)
        : const EdgeInsets.fromLTRB(22, 20, 20, 20);

    return AnimatedOpacity(
      duration: const Duration(milliseconds: 150),
      opacity: dimmed ? 0.4 : 1,
      child: Material(
        color: KioskPalette.surface,
        borderRadius: radius,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: (busy || dimmed) ? null : onTap,
          // The card tints on press in its own colour, so a parent gets an
          // unmistakable "yes, that one" before the request even returns.
          highlightColor: color.withValues(alpha: 0.07),
          splashColor: color.withValues(alpha: 0.10),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: radius,
              border: Border.all(color: KioskPalette.border),
            ),
            padding: pad,
            child: Stack(
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: iconTile,
                          height: iconTile,
                          decoration: BoxDecoration(
                            color: color.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(15),
                          ),
                          child: Icon(
                            departmentIcon(department.icon),
                            color: color,
                            size: tight ? 24 : 28,
                          ),
                        ),
                        const SizedBox(width: 12),
                        // Flexible, not a Spacer: a long localised label ("12
                        // في الانتظار") must ellipsize inside a narrow card
                        // rather than push past its edge.
                        Flexible(
                          child: Align(
                            alignment: AlignmentDirectional.centerEnd,
                            child: _QueueStatus(waiting: waiting, copy: copy),
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                primaryName,
                                maxLines: tight ? 1 : 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: tight ? 20 : 23,
                                  height: 1.15,
                                  fontWeight: FontWeight.w700,
                                  color: KioskPalette.ink,
                                ),
                              ),
                              if (!tight &&
                                  secondaryName.isNotEmpty &&
                                  secondaryName != primaryName) ...[
                                const SizedBox(height: 3),
                                Text(
                                  secondaryName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    color: KioskPalette.inkFaint,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        _TapCue(color: color, size: tight ? 34 : 38),
                      ],
                    ),
                  ],
                ),
                if (busy)
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: KioskPalette.surface.withValues(alpha: 0.88),
                        borderRadius: radius,
                      ),
                      child: Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            SizedBox(
                              width: 26,
                              height: 26,
                              child: CircularProgressIndicator(
                                strokeWidth: 3,
                                color: color,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              copy.issuing,
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                color: KioskPalette.ink,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A card is a big flat rectangle; this arrow is what says "tappable" without
/// adding a second, competing hit target.
class _TapCue extends StatelessWidget {
  const _TapCue({required this.color, required this.size});
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        shape: BoxShape.circle,
      ),
      child: Icon(
        rtl ? Icons.arrow_back_rounded : Icons.arrow_forward_rounded,
        size: 20,
        color: color,
      ),
    );
  }
}

/// Only a real queue earns a filled pill. An empty queue is the common case,
/// and a grid of identical grey "no queue" chips was pure visual static.
class _QueueStatus extends StatelessWidget {
  const _QueueStatus({required this.waiting, required this.copy});
  final int waiting;
  final KioskCopy copy;

  @override
  Widget build(BuildContext context) {
    if (waiting <= 0) {
      return Text(
        copy.noneWaiting,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(
          fontSize: 13.5,
          fontWeight: FontWeight.w600,
          color: KioskPalette.inkFaint,
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
      decoration: BoxDecoration(
        color: KioskPalette.primarySoft,
        borderRadius: BorderRadius.circular(KioskPalette.radiusPill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: const BoxDecoration(
              color: KioskPalette.primary,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 7),
          Flexible(
            child: Text(
              '$waiting ${copy.waitingHere}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
                color: KioskPalette.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
