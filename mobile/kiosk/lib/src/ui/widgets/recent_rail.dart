import 'package:flutter/material.dart';

import '../../i18n/copy.dart';
import '../../models/kiosk_feed.dart';
import '../../models/school_department.dart';
import '../../models/school_token.dart';
import '../dept_icon.dart';
import '../theme.dart';

/// Today's tickets, newest first — reassurance that the machine did something.
/// Tapping a row opens reprint / move / priority / cancel — a staff action,
/// not something a visitor is invited to do (there's no visual affordance
/// hinting it's tappable), but the API already supports it and there is
/// nowhere else on the kiosk to reach these.
///
/// Intentionally the quietest surface on screen: the service cards are what a
/// visitor came to press, so this rail stays flat and low-contrast and never
/// pulls the eye away from them.
///
/// [scrollable] true: fills its column and scrolls itself. false: wraps for a
/// parent scroll view (narrow layout).
class RecentRail extends StatelessWidget {
  const RecentRail({
    super.key,
    required this.feed,
    required this.departments,
    required this.lang,
    required this.copy,
    this.scrollable = true,
    this.onTapToken,
  });

  final KioskFeed? feed;
  final List<SchoolDepartment> departments;
  final String lang;
  final KioskCopy copy;
  final bool scrollable;
  final ValueChanged<SchoolToken>? onTapToken;

  @override
  Widget build(BuildContext context) {
    final recent = feed?.recent ?? const [];
    final deptById = {for (final d in departments) d.id: d};
    final issued = feed?.issuedToday ?? 0;

    final body = recent.isEmpty
        ? Padding(
            padding: const EdgeInsets.fromLTRB(24, 40, 24, 44),
            child: Column(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: const BoxDecoration(
                    color: KioskPalette.surfaceMuted,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.confirmation_number_outlined,
                    size: 26,
                    color: KioskPalette.inkFaint,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  copy.recentEmpty,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 14,
                    height: 1.4,
                    color: KioskPalette.inkFaint,
                  ),
                ),
              ],
            ),
          )
        : ListView.separated(
            shrinkWrap: !scrollable,
            physics: scrollable ? null : const NeverScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(vertical: 4),
            itemCount: recent.length,
            separatorBuilder: (_, _) =>
                const Divider(height: 1, indent: 68, endIndent: 18),
            itemBuilder: (context, i) {
              final t = recent[i];
              final dept = deptById[t.departmentId];
              final color = departmentColor(dept?.color ?? '#2F5BEA');
              final at = DateTime.tryParse(t.joinedAt)?.toLocal();

              final row = Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 11,
                ),
                child: Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(11),
                      ),
                      child: Icon(
                        departmentIcon(dept?.icon ?? ''),
                        size: 19,
                        color: color,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  t.tokenCode,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 17,
                                    fontWeight: FontWeight.w800,
                                    color: KioskPalette.ink,
                                  ),
                                ),
                              ),
                              if (t.isPriority) ...[
                                const SizedBox(width: 8),
                                const Icon(
                                  Icons.star_rounded,
                                  size: 16,
                                  color: KioskPalette.priority,
                                ),
                              ],
                            ],
                          ),
                          Text(
                            dept?.name(lang) ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 13,
                              color: KioskPalette.inkSoft,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (at != null) ...[
                      const SizedBox(width: 8),
                      Text(
                        KioskCopy.clockOf(lang, at),
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: KioskPalette.inkFaint,
                        ),
                      ),
                    ],
                  ],
                ),
              );

              return onTapToken == null
                  ? row
                  : InkWell(onTap: () => onTapToken!(t), child: row);
            },
          );

    return Container(
      decoration: BoxDecoration(
        color: KioskPalette.surface,
        borderRadius: BorderRadius.circular(KioskPalette.radius),
        border: Border.all(color: KioskPalette.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: scrollable ? MainAxisSize.max : MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    copy.recent,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: KioskPalette.ink,
                    ),
                  ),
                ),
                if (issued > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: KioskPalette.surfaceMuted,
                      borderRadius:
                          BorderRadius.circular(KioskPalette.radiusPill),
                    ),
                    child: Text(
                      '$issued',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: KioskPalette.inkSoft,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const Divider(height: 1),
          if (scrollable) Expanded(child: body) else body,
        ],
      ),
    );
  }
}
