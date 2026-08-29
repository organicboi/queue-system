import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../api/api_exception.dart';
import '../config/app_config.dart';
import '../i18n/copy.dart';
import '../models/kiosk_bootstrap.dart';
import '../models/kiosk_feed.dart';
import '../models/school_department.dart';
import '../models/school_token.dart';
import '../printing/print_job.dart';
import '../state/providers.dart';
import 'dept_icon.dart';
import 'theme.dart';
import 'widgets/confirmation_overlay.dart';
import 'widgets/department_grid.dart';
import 'widgets/kiosk_header.dart';
import 'widgets/priority_banner.dart';
import 'widgets/recent_rail.dart';

/// The persistent lobby screen. The service grid never unmounts — issuing a
/// token shows a full-screen confirmation over it, not a page transition
/// (see the header comment in components/school/SchoolKiosk.tsx).
class KioskScreen extends ConsumerStatefulWidget {
  const KioskScreen({super.key});

  @override
  ConsumerState<KioskScreen> createState() => _KioskScreenState();
}

class _KioskScreenState extends ConsumerState<KioskScreen> {
  String _lang = 'en';
  bool _priorityArmed = false;
  String? _issuingDeptId;

  ({SchoolToken token, SchoolDepartment department})? _confirm;
  Timer? _confirmTimer;
  bool _langInitialised = false;

  @override
  void initState() {
    super.initState();
    // An unattended lobby terminal must never let the screen sleep on its own
    // — nobody is there to wake it back up for the next visitor.
    WakelockPlus.enable();
  }

  @override
  void dispose() {
    WakelockPlus.disable();
    _confirmTimer?.cancel();
    super.dispose();
  }

  void _showConfirmation(SchoolToken token, SchoolDepartment department) {
    _confirmTimer?.cancel();
    setState(() => _confirm = (token: token, department: department));
    _confirmTimer = Timer(AppConfig.heroLinger, _dismissConfirmation);
  }

  void _dismissConfirmation() {
    _confirmTimer?.cancel();
    if (mounted) setState(() => _confirm = null);
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
      _showConfirmation(token, department);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.isUnregistered) {
        await ref.read(deviceConfigProvider.notifier).reset();
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
              onReset: () => ref.read(deviceConfigProvider.notifier).reset(),
            ),
            data: (data) {
              // Adopt the branch's first configured language once.
              if (!_langInitialised) {
                _langInitialised = true;
                _lang = data.languages.first;
              }
              return _Shell(
                data: data,
                lang: _lang,
                onLangChange: (l) => setState(() => _lang = l),
                priorityArmed: _priorityArmed,
                onTogglePriority: () =>
                    setState(() => _priorityArmed = !_priorityArmed),
                issuingDeptId: _issuingDeptId,
                onIssue: _issue,
                confirm: _confirm,
                onDismissConfirm: _dismissConfirmation,
              );
            },
          ),
        ),
      ),
    );
  }
}

class _Shell extends ConsumerWidget {
  const _Shell({
    required this.data,
    required this.lang,
    required this.onLangChange,
    required this.priorityArmed,
    required this.onTogglePriority,
    required this.issuingDeptId,
    required this.onIssue,
    required this.confirm,
    required this.onDismissConfirm,
  });

  final KioskBootstrap data;
  final String lang;
  final ValueChanged<String> onLangChange;
  final bool priorityArmed;
  final VoidCallback onTogglePriority;
  final String? issuingDeptId;
  final ValueChanged<SchoolDepartment> onIssue;
  final ({SchoolToken token, SchoolDepartment department})? confirm;
  final VoidCallback onDismissConfirm;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final copy = KioskCopy.of(lang);
    final feed = ref.watch(feedProvider).value;
    final lastPrint = ref.watch(lastPrintResultProvider);
    final printFailed = lastPrint?.attempt.isFailure ?? false;
    final printFailedText = switch (lastPrint?.attempt.reason) {
      PrintFailureReason.outOfPaper => copy.printOutOfPaper,
      PrintFailureReason.coverOpen => copy.printCoverOpen,
      _ => copy.printFailed,
    };

    return Column(
      children: [
        KioskHeader(
          title: data.settings?.schoolName(lang) ?? data.branchName,
          logoUrl: data.settings?.logoUrl ?? '',
          copy: copy,
          languages: data.languages,
          lang: lang,
          onLangChange: onLangChange,
        ),
        Expanded(
          child: Stack(
            children: [
              LayoutBuilder(
                builder: (context, c) {
                  final wide = c.maxWidth >= 900;
                  return wide
                      ? _wide(context, ref, copy, feed)
                      : _narrow(context, ref, copy, feed);
                },
              ),
              if (confirm != null)
                ConfirmationOverlay(
                  token: confirm!.token,
                  department: confirm!.department,
                  lang: lang,
                  copy: copy,
                  onDismiss: onDismissConfirm,
                ),
            ],
          ),
        ),
        if (printFailed) _StatusBar(text: printFailedText),
      ],
    );
  }

  /// Heading + (on a wide screen) the priority switch on the same line, then
  /// the grid. One instruction, stated once, directly above the thing it is
  /// instructing you to touch.
  Widget _services(
    BuildContext context,
    KioskCopy copy,
    KioskFeed? feed, {
    required bool gridScrolls,
  }) {
    final priorityEnabled = data.settings?.priorityEnabled ?? false;
    final grid = DepartmentGrid(
      departments: data.departments,
      lang: lang,
      waitingByDepartment: feed?.waitingByDepartment ?? const {},
      issuingDeptId: issuingDeptId,
      copy: copy,
      onTap: onIssue,
      shrinkWrap: !gridScrolls,
    );

    final heading = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          copy.prompt,
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 4),
        Text(
          copy.promptHint,
          style: const TextStyle(fontSize: 16, color: KioskPalette.inkSoft),
        ),
      ],
    );

    final priority = PriorityBanner(
      armed: priorityArmed,
      onToggle: onTogglePriority,
      copy: copy,
      compact: gridScrolls,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (gridScrolls)
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(child: heading),
              if (priorityEnabled) ...[
                const SizedBox(width: 24),
                priority,
              ],
            ],
          )
        else ...[
          heading,
          if (priorityEnabled) ...[
            const SizedBox(height: 16),
            priority,
          ],
        ],
        const SizedBox(height: 20),
        if (gridScrolls) Expanded(child: grid) else grid,
      ],
    );
  }

  Widget _wide(BuildContext context, WidgetRef ref, KioskCopy copy, KioskFeed? feed) {
    final scale = kioskScale(context);
    final width = MediaQuery.sizeOf(context).width;
    // The rail is a fraction of the viewport, floored so its rows stay legible
    // and capped so it can't crowd the service cards on an ultra-wide panel.
    final railWidth = (width * 0.26).clamp(300.0, 460.0);
    final pad = 24.0 * scale;
    final gutter = 20.0 * scale;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: Padding(
            padding: EdgeInsetsDirectional.fromSTEB(pad + 4, pad, gutter, pad),
            child: _services(context, copy, feed, gridScrolls: true),
          ),
        ),
        Padding(
          padding: EdgeInsetsDirectional.fromSTEB(0, pad, pad + 4, pad),
          child: SizedBox(
            width: railWidth,
            child: RecentRail(
              feed: feed,
              departments: data.departments,
              lang: lang,
              copy: copy,
              onTapToken: (t) => _openTokenActions(context, ref, copy, t),
            ),
          ),
        ),
      ],
    );
  }

  Widget _narrow(BuildContext context, WidgetRef ref, KioskCopy copy, KioskFeed? feed) {
    return SingleChildScrollView(
      padding: EdgeInsets.all(20 * kioskScale(context)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _services(context, copy, feed, gridScrolls: false),
          const SizedBox(height: 22),
          RecentRail(
            feed: feed,
            departments: data.departments,
            lang: lang,
            copy: copy,
            scrollable: false,
            onTapToken: (t) => _openTokenActions(context, ref, copy, t),
          ),
        ],
      ),
    );
  }

  /// Reprint / priority / move / cancel for one row of the recent-tickets
  /// rail — a staff action reached only from here, there's no other affordance
  /// on the kiosk for amending a ticket after it's issued. The API methods
  /// (`KioskController.reprint/setPriority/move/cancel`) have existed since
  /// the initial build; this is the UI that finally calls them.
  Future<void> _openTokenActions(
    BuildContext context,
    WidgetRef ref,
    KioskCopy copy,
    SchoolToken token,
  ) async {
    SchoolDepartment? department;
    for (final d in data.departments) {
      if (d.id == token.departmentId) {
        department = d;
        break;
      }
    }
    if (department == null) return;
    final resolvedDepartment = department;

    final controller = ref.read(kioskControllerProvider);
    final priorityEnabled = data.settings?.priorityEnabled ?? false;
    final amendable = token.isAmendable;

    final action = await showModalBottomSheet<_TokenAction>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => _TokenActionSheet(
        token: token,
        department: resolvedDepartment,
        copy: copy,
        amendable: amendable,
        priorityEnabled: priorityEnabled,
      ),
    );
    if (action == null || !context.mounted) return;

    switch (action) {
      case _TokenAction.reprint:
        controller.reprint(token, department);
      case _TokenAction.togglePriority:
        await controller.setPriority(token.id, !token.isPriority);
      case _TokenAction.move:
        final target = await showModalBottomSheet<SchoolDepartment>(
          context: context,
          showDragHandle: true,
          builder: (sheetContext) => _DepartmentPickerSheet(
            departments: data.departments.where((d) => d.id != token.departmentId).toList(),
            lang: lang,
            copy: copy,
          ),
        );
        if (target != null) await controller.move(token.id, target.id);
      case _TokenAction.cancel:
        if (!context.mounted) return;
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: Text('${copy.cancel}?'),
            content: Text(token.tokenCode),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                child: const Text('No'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(dialogContext).pop(true),
                style: FilledButton.styleFrom(backgroundColor: KioskPalette.danger),
                child: Text(copy.cancel),
              ),
            ],
          ),
        );
        if (confirmed == true) await controller.cancel(token.id);
    }
  }
}

enum _TokenAction { reprint, togglePriority, move, cancel }

class _TokenActionSheet extends StatelessWidget {
  const _TokenActionSheet({
    required this.token,
    required this.department,
    required this.copy,
    required this.amendable,
    required this.priorityEnabled,
  });

  final SchoolToken token;
  final SchoolDepartment department;
  final KioskCopy copy;
  final bool amendable;
  final bool priorityEnabled;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: Row(
              children: [
                Text(
                  token.tokenCode,
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    department.name('en'),
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: KioskPalette.inkSoft),
                  ),
                ),
              ],
            ),
          ),
          ListTile(
            leading: const Icon(Icons.print_outlined),
            title: Text(copy.reprint),
            onTap: () => Navigator.of(context).pop(_TokenAction.reprint),
          ),
          if (amendable && priorityEnabled)
            ListTile(
              leading: Icon(
                token.isPriority ? Icons.star_rounded : Icons.star_outline_rounded,
                color: token.isPriority ? KioskPalette.priority : null,
              ),
              title: Text(token.isPriority ? copy.clearPriority : copy.makePriority),
              onTap: () => Navigator.of(context).pop(_TokenAction.togglePriority),
            ),
          if (amendable)
            ListTile(
              leading: const Icon(Icons.swap_horiz_rounded),
              title: Text(copy.move),
              onTap: () => Navigator.of(context).pop(_TokenAction.move),
            ),
          if (amendable)
            ListTile(
              leading: const Icon(Icons.cancel_outlined, color: KioskPalette.danger),
              title: Text(copy.cancel, style: const TextStyle(color: KioskPalette.danger)),
              onTap: () => Navigator.of(context).pop(_TokenAction.cancel),
            ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

class _DepartmentPickerSheet extends StatelessWidget {
  const _DepartmentPickerSheet({
    required this.departments,
    required this.lang,
    required this.copy,
  });

  final List<SchoolDepartment> departments;
  final String lang;
  final KioskCopy copy;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
            child: Text(copy.moveTitle, style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              children: [
                for (final d in departments)
                  ListTile(
                    leading: Icon(departmentIcon(d.icon), color: departmentColor(d.color)),
                    title: Text(d.name(lang)),
                    onTap: () => Navigator.of(context).pop(d),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

class _StatusBar extends StatelessWidget {
  const _StatusBar({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: KioskPalette.dangerSoft,
        border: Border(top: BorderSide(color: KioskPalette.border)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.print_disabled_rounded,
            size: 20,
            color: KioskPalette.danger,
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Text(
              text,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                color: KioskPalette.danger,
              ),
            ),
          ),
        ],
      ),
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
    final unregistered =
        error is ApiException && (error as ApiException).isUnregistered;
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 460),
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: const BoxDecoration(
                  color: KioskPalette.surfaceMuted,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  unregistered
                      ? Icons.link_off_rounded
                      : Icons.wifi_off_rounded,
                  size: 34,
                  color: KioskPalette.inkFaint,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                unregistered
                    ? 'This kiosk is not registered'
                    : 'Cannot reach the queue server',
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                '$error',
                textAlign: TextAlign.center,
                style: const TextStyle(color: KioskPalette.inkSoft),
              ),
              const SizedBox(height: 26),
              Wrap(
                spacing: 12,
                children: [
                  FilledButton(onPressed: onRetry, child: const Text('Retry')),
                  OutlinedButton(
                    onPressed: onReset,
                    child: const Text('Change token'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
