import 'package:flutter/material.dart';

import '../../i18n/copy.dart';
import '../../models/school_department.dart';

/// The service-selection grid. Tapping a tile issues a token; the tap handler
/// returns immediately (printing runs off a queue), so a tile only shows a
/// spinner while its own network call is in flight.
class DepartmentGrid extends StatelessWidget {
  const DepartmentGrid({
    super.key,
    required this.departments,
    required this.lang,
    required this.waitingByDepartment,
    required this.issuingDeptId,
    required this.copy,
    required this.onTap,
  });

  final List<SchoolDepartment> departments;
  final String lang;
  final Map<String, int> waitingByDepartment;
  final String? issuingDeptId;
  final KioskCopy copy;
  final ValueChanged<SchoolDepartment> onTap;

  @override
  Widget build(BuildContext context) {
    final sorted = [...departments]
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth > 900
            ? 3
            : constraints.maxWidth > 560
                ? 2
                : 1;
        return GridView.count(
          crossAxisCount: columns,
          mainAxisSpacing: 16,
          crossAxisSpacing: 16,
          childAspectRatio: 2.4,
          children: [
            for (final dept in sorted)
              _Tile(
                department: dept,
                lang: lang,
                waiting: waitingByDepartment[dept.id] ?? 0,
                busy: issuingDeptId == dept.id,
                disabled: issuingDeptId != null && issuingDeptId != dept.id,
                copy: copy,
                onTap: () => onTap(dept),
              ),
          ],
        );
      },
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.department,
    required this.lang,
    required this.waiting,
    required this.busy,
    required this.disabled,
    required this.copy,
    required this.onTap,
  });

  final SchoolDepartment department;
  final String lang;
  final int waiting;
  final bool busy;
  final bool disabled;
  final KioskCopy copy;
  final VoidCallback onTap;

  Color get _accent {
    final hex = department.color.replaceAll('#', '');
    if (hex.length == 6) {
      return Color(int.parse('FF$hex', radix: 16));
    }
    return const Color(0xFF334155);
  }

  @override
  Widget build(BuildContext context) {
    final waitingLabel =
        waiting > 0 ? '$waiting ${copy.waitingHere}' : copy.noneWaiting;

    return Opacity(
      opacity: disabled ? 0.5 : 1,
      child: Material(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: (busy || disabled) ? null : onTap,
          child: Container(
            decoration: BoxDecoration(
              border: Border(left: BorderSide(color: _accent, width: 6)),
            ),
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        department.name(lang),
                        style: Theme.of(context).textTheme.titleMedium,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        busy ? copy.issuing : waitingLabel,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                if (busy)
                  const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else
                  Text(
                    department.prefix,
                    style: Theme.of(context)
                        .textTheme
                        .titleLarge
                        ?.copyWith(color: _accent),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
