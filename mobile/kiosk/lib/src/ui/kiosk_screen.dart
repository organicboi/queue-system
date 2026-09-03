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
import 'theme.dart';
import 'widgets/confirmation_overlay.dart';
import 'widgets/connection_dialog.dart';
import 'widgets/department_grid.dart';
import 'widgets/kiosk_header.dart';
import 'widgets/priority_banner.dart';

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

  /// Set once a tap has been waiting longer than [AppConfig.slowRequestHint],
  /// so the spinner stops being the only thing the visitor can see.
  bool _issueSlow = false;
  Timer? _slowTimer;

  ({
    SchoolToken token,
    SchoolDepartment department,
    String? publicUrl,
    Duration linger,
  })? _confirm;
  Timer? _confirmTimer;
  Timer? _bootRetryTimer;
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
    _slowTimer?.cancel();
    _bootRetryTimer?.cancel();
    super.dispose();
  }

  /// The kiosk boots to an error screen if the network is down at power-on —
  /// which, on a lobby terminal switched on before the building's Wi-Fi comes
  /// up, is routine. Nobody is standing there to press Retry, so it retries
  /// itself until the server answers.
  void _armBootRetry() {
    if (_bootRetryTimer != null) return;
    _bootRetryTimer = Timer.periodic(AppConfig.retryInterval, (_) {
      if (mounted) ref.invalidate(bootstrapProvider);
    });
  }

  void _cancelBootRetry() {
    _bootRetryTimer?.cancel();
    _bootRetryTimer = null;
  }

  void _showConfirmation(SchoolToken token, SchoolDepartment department) {
    _confirmTimer?.cancel();
    // Same gate `escpos_printer.dart` uses to decide whether the printed
    // ticket gets a QR — the on-screen confirmation should never offer a
    // scan the paper ticket doesn't also carry, or vice versa.
    final bootstrap = ref.read(bootstrapProvider).value;
    final publicUrl = (bootstrap != null &&
            bootstrap.publicTrackingEnabled &&
            token.publicCode.isNotEmpty)
        ? '${bootstrap.publicBaseUrl}/t/${token.publicCode}'
        : null;
    final linger = publicUrl != null ? AppConfig.qrLinger : AppConfig.heroLinger;
    setState(() => _confirm = (
          token: token,
          department: department,
          publicUrl: publicUrl,
          linger: linger,
        ));
    _confirmTimer = Timer(linger, _dismissConfirmation);
  }

  void _dismissConfirmation() {
    _confirmTimer?.cancel();
    if (mounted) setState(() => _confirm = null);
  }

  /// Issue a token for the tapped service.
  ///
  /// The failure is carried out of the try/finally rather than handled inside
  /// it, so the tile's spinner is already gone before anything is shown on top
  /// of it. Handling it in the `catch` would keep the department "busy" for as
  /// long as the visitor left the dialog open — a spinner under a message
  /// about a failure is exactly the mixed signal this whole path exists to
  /// remove.
  Future<void> _issue(SchoolDepartment department) async {
    if (_issuingDeptId != null) return;
    setState(() {
      _issuingDeptId = department.id;
      _issueSlow = false;
    });
    _slowTimer?.cancel();
    _slowTimer = Timer(AppConfig.slowRequestHint, () {
      if (mounted) setState(() => _issueSlow = true);
    });

    Object? failure;
    try {
      final token = await ref.read(kioskControllerProvider).issue(
            department: department,
            priority: _priorityArmed,
          );
      if (!mounted) return;
      setState(() => _priorityArmed = false);
      _showConfirmation(token, department);
    } catch (e) {
      failure = e;
    } finally {
      _slowTimer?.cancel();
      if (mounted) {
        setState(() {
          _issuingDeptId = null;
          _issueSlow = false;
        });
      }
    }

    if (failure == null || !mounted) return;
    await _explainIssueFailure(failure, department);
  }

  /// Says which of the three things went wrong, because the visitor cannot
  /// tell them apart and will otherwise assume the kiosk is broken:
  /// the device is no longer registered (an operator problem — back to setup),
  /// the network could not carry the request (their patience is the fix), or
  /// the server refused it (its own message says why).
  Future<void> _explainIssueFailure(
    Object error,
    SchoolDepartment department,
  ) async {
    final api = error is ApiException ? error : null;

    if (api != null && api.isUnregistered) {
      await ref.read(deviceConfigProvider.notifier).reset();
      return;
    }

    final copy = KioskCopy.of(_lang);
    // A failure that isn't an ApiException never reached the wire in a way we
    // can attribute — it gets the server-side wording, not a network claim we
    // can't stand behind.
    final isNetwork = api?.isNetwork ?? false;

    final retry = await showDialog<bool>(
      context: context,
      barrierDismissible: true,
      builder: (_) => ConnectionDialog(
        lang: _lang,
        copy: copy,
        isNetwork: isNetwork,
        detail: isNetwork ? null : (api?.message ?? '$error'),
      ),
    );

    if (retry == true && mounted) await _issue(department);
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
            error: (e, _) {
              // Nobody is here to press Retry — keep trying in the background.
              _armBootRetry();
              return _BootError(
                error: e,
                onRetry: () => ref.invalidate(bootstrapProvider),
                onReset: () => ref.read(deviceConfigProvider.notifier).reset(),
              );
            },
            data: (data) {
              _cancelBootRetry();
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
                issueSlow: _issueSlow,
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
    required this.issueSlow,
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
  final bool issueSlow;
  final ValueChanged<SchoolDepartment> onIssue;
  final ({
    SchoolToken token,
    SchoolDepartment department,
    String? publicUrl,
    Duration linger,
  })? confirm;
  final VoidCallback onDismissConfirm;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final copy = KioskCopy.of(lang);
    final feed = ref.watch(feedProvider).value;
    final offline = ref.watch(serverLinkProvider) == ServerLink.offline;
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
          child: ColoredBox(
            // The blocks are the design; the ground is one step deeper than
            // the app's default so a screen full of colour has something to
            // sit on.
            color: KioskPalette.bgDeep,
            child: Stack(
              children: [
                LayoutBuilder(
                  builder: (context, c) {
                    final wide = c.maxWidth >= 900;
                    return wide
                        ? _wide(context, copy, feed)
                        : _narrow(context, copy, feed);
                  },
                ),
                if (confirm != null)
                  ConfirmationOverlay(
                    token: confirm!.token,
                    department: confirm!.department,
                    publicUrl: confirm!.publicUrl,
                    linger: confirm!.linger,
                    lang: lang,
                    copy: copy,
                    onDismiss: onDismissConfirm,
                  ),
              ],
            ),
          ),
        ),
        // Standing information, not a toast: while the server is unreachable
        // this is on screen for everyone who walks up, including the visitor
        // who hasn't tapped yet, and it clears itself the moment the feed poll
        // gets an answer again. The slow-tap hint sits in the same place so a
        // wait is never unexplained.
        if (offline)
          _StatusBar(
            text: copy.offlineBanner,
            icon: Icons.wifi_off_rounded,
          )
        else if (issueSlow)
          _StatusBar(
            text: copy.stillConnecting,
            icon: Icons.cloud_sync_rounded,
            background: KioskPalette.surfaceMuted,
            foreground: KioskPalette.inkSoft,
          ),
        if (printFailed)
          _StatusBar(
            text: printFailedText,
            icon: Icons.print_disabled_rounded,
          ),
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
    // "Please select a service / touch a service to take a number" is
    // instructions for a choice. A branch with one service offers no choice —
    // the hero card names the service and says what pressing it does — so the
    // heading is dropped rather than restated over a single card.
    final solo = data.departments.length == 1;
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

    final headed = !solo || priorityEnabled;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (gridScrolls) ...[
          if (headed)
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                if (solo) const Spacer() else Expanded(child: heading),
                if (priorityEnabled) ...[
                  const SizedBox(width: 24),
                  priority,
                ],
              ],
            ),
        ] else ...[
          if (!solo) heading,
          if (priorityEnabled) ...[
            if (!solo) const SizedBox(height: 16),
            priority,
          ],
        ],
        if (headed) const SizedBox(height: 20),
        if (gridScrolls) Expanded(child: grid) else grid,
      ],
    );
  }

  /// With no side rail left, the service grid owns the full width on a wide
  /// panel — the cards a visitor came to press are the only thing on screen.
  Widget _wide(BuildContext context, KioskCopy copy, KioskFeed? feed) {
    final pad = 24.0 * kioskScale(context);

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: pad + 4, vertical: pad),
      child: _services(context, copy, feed, gridScrolls: true),
    );
  }

  Widget _narrow(BuildContext context, KioskCopy copy, KioskFeed? feed) {
    return SingleChildScrollView(
      padding: EdgeInsets.all(20 * kioskScale(context)),
      child: _services(context, copy, feed, gridScrolls: false),
    );
  }
}

/// A full-width line under the service area. Deliberately not a snackbar: a
/// condition that is still true — no connection, a printer with no paper —
/// must stay on screen for whoever walks up next, not slide away four seconds
/// after the person who caused it left.
class _StatusBar extends StatelessWidget {
  const _StatusBar({
    required this.text,
    required this.icon,
    this.background = KioskPalette.dangerSoft,
    this.foreground = KioskPalette.danger,
  });

  final String text;
  final IconData icon;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: background,
        border: const Border(top: BorderSide(color: KioskPalette.border)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 20, color: foreground),
          const SizedBox(width: 10),
          Flexible(
            child: Text(
              text,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: foreground,
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
                // The exception's own toString carries a status code and class
                // name that mean nothing to whoever is looking at the screen.
                error is ApiException
                    ? (error as ApiException).message
                    : '$error',
                textAlign: TextAlign.center,
                style: const TextStyle(color: KioskPalette.inkSoft),
              ),
              if (!unregistered) ...[
                const SizedBox(height: 18),
                // Retry is here for an operator who doesn't want to wait, not
                // because anything depends on it being pressed — the screen is
                // already retrying on its own every few seconds.
                const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2.2),
                    ),
                    SizedBox(width: 10),
                    Text(
                      'Retrying automatically…',
                      style: TextStyle(color: KioskPalette.inkFaint),
                    ),
                  ],
                ),
              ],
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
