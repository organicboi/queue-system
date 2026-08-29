import 'package:flutter/material.dart';

import '../../i18n/copy.dart';
import '../../models/school_department.dart';
import '../../models/school_token.dart';

/// Shows the just-issued token. The number is committed server-side before the
/// print is attempted, so it stays on screen even if the printer fails —
/// the visitor always leaves with their number.
class TokenHero extends StatelessWidget {
  const TokenHero({
    super.key,
    required this.token,
    required this.department,
    required this.lang,
    required this.copy,
  });

  final SchoolToken token;
  final SchoolDepartment department;
  final String lang;
  final KioskCopy copy;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 20),
      decoration: BoxDecoration(
        color: scheme.primaryContainer,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          Text(copy.yourToken, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text(
            token.tokenCode,
            style: Theme.of(context).textTheme.displayLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: scheme.onPrimaryContainer,
                ),
          ),
          const SizedBox(height: 8),
          Text(department.name(lang),
              style: Theme.of(context).textTheme.titleMedium),
          if (token.isPriority) ...[
            const SizedBox(height: 6),
            Chip(label: Text(copy.priorityTag)),
          ],
          const SizedBox(height: 8),
          Text(copy.watch, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}
