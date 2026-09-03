import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/kiosk_api.dart';
import '../config/app_config.dart';
import '../config/device_config.dart';
import '../models/kiosk_bootstrap.dart';
import '../models/kiosk_feed.dart';
import '../models/school_department.dart';
import '../models/school_token.dart';
import '../printing/escpos_printer.dart';
import '../printing/print_job.dart';
import '../printing/printer.dart';
import '../printing/ticket_widget.dart';

// ── Device config ────────────────────────────────────────────
final deviceConfigProvider =
    AsyncNotifierProvider<DeviceConfigController, DeviceConfig>(
  DeviceConfigController.new,
);

class DeviceConfigController extends AsyncNotifier<DeviceConfig> {
  @override
  Future<DeviceConfig> build() => DeviceConfig.load();

  Future<void> save(DeviceConfig config) async {
    await config.save();
    state = AsyncData(config);
  }

  /// Wipe role + tokens — used when the server reports the device is
  /// unregistered, or when the operator explicitly starts a re-provision.
  /// Server URL and admin PIN survive (see `DeviceConfig.clearProvisioning`).
  Future<void> reset() async {
    await DeviceConfig.clearProvisioning();
    state = AsyncData(await DeviceConfig.load());
  }

  Future<void> refresh() async {
    state = AsyncData(await DeviceConfig.load());
  }
}

// ── Server link ──────────────────────────────────────────────
/// Whether the queue server is reachable, judged only by what actually
/// happened on the wire — every request through [KioskApi] reports back.
///
/// Deliberately not a radio-state check: a lobby access point can be perfectly
/// "connected" with no route to the server, which reads as online to the OS
/// while every tap still fails. The only question worth answering here is
/// whether *this* server answers.
///
/// Recovery needs no visitor input and no extra polling: the 6-second feed
/// poll is already a continuous probe, so the first poll that gets an answer
/// flips this back to [online] and clears whatever the screen was showing.
enum ServerLink { online, offline }

final serverLinkProvider =
    NotifierProvider<ServerLinkNotifier, ServerLink>(ServerLinkNotifier.new);

class ServerLinkNotifier extends Notifier<ServerLink> {
  /// Optimistic: the kiosk starts assuming the server is there and only says
  /// otherwise once a request has actually failed to reach it. Booting into a
  /// "no connection" banner that a first successful call would erase a moment
  /// later is its own kind of false alarm.
  @override
  ServerLink build() => ServerLink.online;

  void report({required bool reachable}) {
    final next = reachable ? ServerLink.online : ServerLink.offline;
    if (state != next) state = next;
  }
}

// ── API client (rebuilds when config changes) ────────────────
final kioskApiProvider = Provider<KioskApi>((ref) {
  final cfg = ref.watch(deviceConfigProvider).requireValue;
  return KioskApi(
    baseUrl: cfg.baseUrl,
    branchToken: cfg.branchToken,
    onReachability: (reachable) {
      try {
        ref.read(serverLinkProvider.notifier).report(reachable: reachable);
      } catch (_) {
        // This provider was disposed while a request was still in flight (the
        // operator changed the server URL, say). There is nothing left to tell.
      }
    },
  );
});

// ── Bootstrap ────────────────────────────────────────────────
final bootstrapProvider = FutureProvider<KioskBootstrap>((ref) async {
  final api = ref.watch(kioskApiProvider);
  return api.bootstrap();
});

// ── Feed (6-second poll, matches the web kiosk) ──────────────
final feedProvider =
    AsyncNotifierProvider<FeedController, KioskFeed>(FeedController.new);

class FeedController extends AsyncNotifier<KioskFeed> {
  Timer? _timer;

  @override
  Future<KioskFeed> build() async {
    final api = ref.watch(kioskApiProvider);
    _timer?.cancel();
    _timer = Timer.periodic(AppConfig.feedPollInterval, (_) => _poll());
    ref.onDispose(() => _timer?.cancel());
    return api.feed();
  }

  Future<void> _poll() async {
    final api = ref.read(kioskApiProvider);
    try {
      final next = await api.feed();
      state = AsyncData(next);
    } catch (_) {
      // Keep the last good feed on screen — a transient network blip must not
      // blank the rail (mirrors MainActivity.kt's retry-don't-crash behaviour).
    }
  }

  Future<void> refreshNow() async {
    final api = ref.read(kioskApiProvider);
    try {
      state = AsyncData(await api.feed());
    } catch (_) {/* ignore */}
  }

  /// Optimistically fold a just-issued/changed token into the current feed so
  /// the rail updates before the next poll.
  void patch(KioskFeed Function(KioskFeed current) update) {
    final current = state.value;
    if (current != null) state = AsyncData(update(current));
  }
}

// ── School logo (fetched once, reused for every ticket) ──────
final ticketLogoProvider = FutureProvider<ui.Image?>((ref) async {
  final bootstrap = await ref.watch(bootstrapProvider.future);
  final url = bootstrap.settings?.logoUrl ?? '';
  return loadTicketLogo(url);
});

// ── Printer + queue ──────────────────────────────────────────
/// Real hardware once a printer is configured and the branch has loaded;
/// [DebugPrinter] otherwise (unconfigured, or bootstrap hasn't resolved yet —
/// printing must never block on that, so this provider never itself awaits).
final printerProvider = Provider<Printer>((ref) {
  final cfg = ref.watch(deviceConfigProvider).value;
  // The printer is now vertical-neutral — it rasters a fully-resolved
  // TicketData built by the controller, so it only rebuilds when the printer
  // *settings* change, not on every bootstrap/logo refresh.
  final Printer printer = (cfg != null && cfg.printer.isConfigured)
      ? EscPosPrinter(settings: cfg.printer)
      : DebugPrinter();
  ref.onDispose(printer.dispose);
  return printer;
});

/// Result of the most recent print attempt, for the on-screen banner.
typedef PrintOutcome = ({PrintJob job, PrintAttempt attempt});

final lastPrintResultProvider =
    NotifierProvider<LastPrintResultNotifier, PrintOutcome?>(
  LastPrintResultNotifier.new,
);

class LastPrintResultNotifier extends Notifier<PrintOutcome?> {
  @override
  PrintOutcome? build() => null;

  void set(PrintOutcome outcome) => state = outcome;
}

final printQueueProvider = Provider<PrintQueue>((ref) {
  final queue = PrintQueue(
    ref.watch(printerProvider),
    onResult: (job, attempt) {
      ref
          .read(lastPrintResultProvider.notifier)
          .set((job: job, attempt: attempt));
    },
  );
  return queue;
});

// ── Kiosk actions ────────────────────────────────────────────
final kioskControllerProvider = Provider<KioskController>(KioskController.new);

class KioskController {
  KioskController(this.ref);
  final Ref ref;

  Future<SchoolToken> issue({
    required SchoolDepartment department,
    required bool priority,
    String? locale,
  }) async {
    final issued = await ref.read(kioskApiProvider).issueToken(
          departmentId: department.id,
          isPriority: priority,
          locale: locale,
        );
    final token = issued.token;
    ref.read(feedProvider.notifier).patch(
          (f) => f.withNewToken(token, limit: AppConfig.recentLimit),
        );
    _print(token, department, issued.waitingAhead);
    return token;
  }

  /// The queue has moved since the ticket was first printed, so the count is
  /// read again rather than reprinted from the issue. Best-effort: the lookup
  /// swallows its own failures and answers null, and the reprint goes ahead
  /// without the line.
  Future<void> reprint(SchoolToken token, SchoolDepartment department) async {
    final ahead = await ref.read(kioskApiProvider).waitingAhead(token.id);
    _print(token, department, ahead);
  }

  Future<SchoolToken> cancel(String tokenId) async {
    final token = await ref.read(kioskApiProvider).cancelToken(tokenId);
    await ref.read(feedProvider.notifier).refreshNow();
    return token;
  }

  Future<SchoolToken> setPriority(String tokenId, bool isPriority) async {
    final token =
        await ref.read(kioskApiProvider).setPriority(tokenId, isPriority);
    await ref.read(feedProvider.notifier).refreshNow();
    return token;
  }

  Future<SchoolToken> move(String tokenId, String departmentId) async {
    final token =
        await ref.read(kioskApiProvider).moveToken(tokenId, departmentId);
    await ref.read(feedProvider.notifier).refreshNow();
    return token;
  }

  void _print(SchoolToken token, SchoolDepartment department, int? waitingAhead) {
    final info = BranchTicketInfo.fromBootstrap(ref.read(bootstrapProvider).value);
    final logo = ref.read(ticketLogoProvider).value;
    ref.read(printQueueProvider).enqueue(
          PrintJob(
            data: TicketData(
              schoolNameEn: info.schoolNameEn,
              schoolNameAr: info.schoolNameAr,
              tokenCode: token.tokenCode,
              departmentNameEn: department.nameEn,
              departmentNameAr: department.nameAr,
              isPriority: token.isPriority,
              footerEn: info.ticketFooterEn,
              footerAr: info.ticketFooterAr,
              issuedAt: DateTime.now(),
              waitingAhead: waitingAhead,
              logo: logo,
              // Re-derived from the token's own public code — a reprint always
              // wants the current gate.
              publicUrl:
                  info.publicTrackingEnabled && token.publicCode.isNotEmpty
                      ? '${info.publicBaseUrl}/t/${token.publicCode}'
                      : null,
            ),
          ),
        );
  }
}
