import 'package:flutter/material.dart';

import '../../i18n/copy.dart';
import '../../models/kiosk_feed.dart';
import '../../models/school_department.dart';

/// Today's tickets, newest first. Per-row actions (reprint / move / cancel /
/// priority) are wired in step 5 — this is the read-only rail for now.
class RecentRail extends StatelessWidget {
  const RecentRail({
    super.key,
    required this.feed,
    required this.departments,
    required this.lang,
    required this.copy,
  });

  final KioskFeed? feed;
  final List<SchoolDepartment> departments;
  final String lang;
  final KioskCopy copy;

  @override
  Widget build(BuildContext context) {
    final recent = feed?.recent ?? const [];
    final deptById = {for (final d in departments) d.id: d};

    return Container(
      color: Theme.of(context).colorScheme.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(copy.recent,
                style: Theme.of(context).textTheme.titleMedium),
          ),
          const Divider(height: 1),
          Expanded(
            child: recent.isEmpty
                ? Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(copy.recentEmpty),
                  )
                : ListView.separated(
                    itemCount: recent.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final t = recent[i];
                      final dept = deptById[t.departmentId];
                      return ListTile(
                        dense: true,
                        title: Text(t.tokenCode),
                        subtitle: Text(dept?.name(lang) ?? ''),
                        trailing: t.isPriority
                            ? Text(copy.priorityTag,
                                style: Theme.of(context).textTheme.labelSmall)
                            : null,
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
