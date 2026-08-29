import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_exception.dart';
import '../config/app_config.dart';
import '../i18n/copy.dart';
import '../models/kiosk_bootstrap.dart';
import '../models/school_department.dart';
import '../models/school_token.dart';
import '../printing/print_job.dart';
import '../state/providers.dart';
import 'widgets/department_grid.dart';
import 'widgets/recent_rail.dart';
import 'widgets/token_hero.dart';

/// The persistent lobby screen. The grid never unmounts — issuing a token is a
/// side effect shown in the hero area and the rail, not a page transition
/// (see the header comment in components/school/SchoolKiosk.tsx). Full port of
/// the web UX is step 5; this is the working spine.
class KioskScreen extends ConsumerStatefulWidget {
  const KioskScreen({super.key});

  @override
  ConsumerState<KioskScreen> createState() => _KioskScreenState();
}

class _KioskScreenState extends ConsumerState<KioskScreen> {
  String _lang = 'en';
  bool _priorityArmed = false;
  String? _issuingDeptId;

  ({SchoolToken token, SchoolDepartment department})? _hero;
  Timer? _heroTimer;

  @override
  void dispose() {
    _heroTimer?.cancel();
    super.dispose();
  }

  void _showHero(SchoolToken token, SchoolDepartment department) {
    _heroTimer?.cancel();
    setState(() => _hero = (token: token, department: department));
    _heroTimer = Timer(AppConfig.heroLinger, () {
      if (mounted) setState(() => _hero = null);
    });
  }

  Future<void> _issue(SchoolDepartment department) async {
    if (_issuingDeptId != null) return;
    setState(() => _issuingDeptId = department.id);
    try {
      final token = await ref.read(kioskControllerProvider).issue(
            department: department,
            priority: _priorityArmed,
          );
      if (!mounted) return;
      setState(() => _priorityArmed = false);
      _showHero(token, department);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.isUnregistered) {
        await ref.read(kioskConfigProvider.notifier).reset();
        return;
      }
      _toast(e.message);
    } finally {
      if (mounted) setState(() => _issuingDeptId = null);
    }
  }

  void _toast(String message) {
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final bootstrap = ref.watch(bootstrapProvider);

    return Directionality(
      textDirection: KioskCopy.directionOf(_lang),
      child: Scaffold(
        body: SafeArea(
          child: bootstrap.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => _BootError(
              error: e,
              onRetry: () => ref.invalidate(bootstrapProvider),
              onReset: () => ref.read(kioskConfigProvider.notifier).reset(),
            ),
            data: (data) => _Body(
              data: data,
              lang: _lang,
              onLangChange: (l) => setState(() => _lang = l),
              priorityArmed: _priorityArmed,
              onTogglePriority: () =>
                  setState(() => _priorityArmed = !_priorityArmed),
              issuingDeptId: _issuingDeptId,
              onIssue: _issue,
              hero: _hero,
            ),
          ),
        ),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({
    required this.data,
    required this.lang,
    required this.onLangChange,
    required this.priorityArmed,
    required this.onTogglePriority,
    required this.issuingDeptId,
    required this.onIssue,
    required this.hero,
  });

  final KioskBootstrap data;
  final String lang;
  final ValueChanged<String> onLangChange;
  final bool priorityArmed;
  final VoidCallback onTogglePriority;
  final String? issuingDeptId;
  final ValueChanged<SchoolDepartment> onIssue;
  final ({SchoolToken token, SchoolDepartment department})? hero;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final copy = KioskCopy.of(lang);
    final feed = ref.watch(feedProvider);
    final lastPrint = ref.watch(lastPrintResultProvider);
    final priorityEnabled = data.settings?.priorityEnabled ?? false;

    return Column(
      children: [
        _Header(
          title: data.settings?.schoolName(lang) ?? data.branchName,
          languages: data.languages,
          lang: lang,
          onLangChange: onLangChange,
          issuedToday: feed.value?.issuedToday ?? 0,
          issuedTodayLabel: copy.issuedToday,
        ),
        if (lastPrint?.result == PrintResult.failed)
          _Banner(
            text: copy.printFailed,
            color: Theme.of(context).colorScheme.errorContainer,
          ),
        Expanded(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                flex: 3,
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      if (hero != null)
                        TokenHero(
                          token: hero!.token,
                          department: hero!.department,
                          lang: lang,
                          copy: copy,
                        )
                      else
                        _Prompt(copy: copy),
                      const SizedBox(height: 16),
                      if (priorityEnabled)
                        _PriorityToggle(
                          armed: priorityArmed,
                          onToggle: onTogglePriority,
                          copy: copy,
                        ),
                      const SizedBox(height: 16),
                      Expanded(
                        child: DepartmentGrid(
                          departments: data.departments,
                          lang: lang,
                          waitingByDepartment:
                              feed.value?.waitingByDepartment ?? const {},
                          issuingDeptId: issuingDeptId,
                          copy: copy,
                          onTap: onIssue,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SizedBox(
                width: 340,
                child: RecentRail(
                  feed: feed.value,
                  departments: data.departments,
                  lang: lang,
                  copy: copy,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.title,
    required this.languages,
    required this.lang,
    required this.onLangChange,
    required this.issuedToday,
    required this.issuedTodayLabel,
  });

  final String title;
  final List<String> languages;
  final String lang;
  final ValueChanged<String> onLangChange;
  final int issuedToday;
  final String issuedTodayLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      color: Theme.of(context).colorScheme.surface,
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: Theme.of(context).textTheme.titleLarge,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Text('$issuedToday $issuedTodayLabel'),
          if (languages.length > 1) ...[
            const SizedBox(width: 16),
            SegmentedButton<String>(
              segments: [
                for (final l in languages)
                  ButtonSegment(value: l, label: Text(l.toUpperCase())),
              ],
              selected: {lang},
              onSelectionChanged: (s) => onLangChange(s.first),
            ),
          ],
        ],
      ),
    );
  }
}

class _Prompt extends StatelessWidget {
  const _Prompt({required this.copy});
  final KioskCopy copy;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(copy.prompt, style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 4),
        Text(copy.promptHint, style: Theme.of(context).textTheme.bodyLarge),
      ],
    );
  }
}

class _PriorityToggle extends StatelessWidget {
  const _PriorityToggle({
    required this.armed,
    required this.onToggle,
    required this.copy,
  });

  final bool armed;
  final VoidCallback onToggle;
  final KioskCopy copy;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: armed ? Theme.of(context).colorScheme.primaryContainer : null,
      child: SwitchListTile(
        value: armed,
        onChanged: (_) => onToggle(),
        title: Text(copy.priority),
        subtitle: Text(armed ? copy.priorityArmed : copy.priorityHint),
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.text, required this.color});
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: color,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      child: Text(text, textAlign: TextAlign.center),
    );
  }
}

class _BootError extends StatelessWidget {
  const _BootError({
    required this.error,
    required this.onRetry,
    required this.onReset,
  });

  final Object error;
  final VoidCallback onRetry;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    final isUnregistered = error is ApiException && (error as ApiException).isUnregistered;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              isUnregistered
                  ? 'This kiosk is not registered.'
                  : 'Cannot reach the queue server.',
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text('$error', textAlign: TextAlign.center),
            const SizedBox(height: 24),
            Wrap(
              spacing: 12,
              children: [
                FilledButton.tonal(onPressed: onRetry, child: const Text('Retry')),
                OutlinedButton(
                  onPressed: onReset,
                  child: const Text('Change token'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
