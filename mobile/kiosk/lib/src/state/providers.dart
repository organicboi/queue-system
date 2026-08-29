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

// ── API client (rebuilds when config changes) ────────────────
final kioskApiProvider = Provider<KioskApi>((ref) {
  final cfg = ref.watch(deviceConfigProvider).requireValue;
  return KioskApi(baseUrl: cfg.baseUrl, branchToken: cfg.branchToken);
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
  final bootstrap = ref.watch(bootstrapProvider).value;
  final logo = ref.watch(ticketLogoProvider).value;

  Printer printer;
  if (cfg != null && cfg.printer.isConfigured) {
    printer = EscPosPrinter(
      settings: cfg.printer,
      branchInfo: BranchTicketInfo.fromSettings(bootstrap?.settings),
      logo: logo,
    );
  } else {
    printer = DebugPrinter();
  }
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
  }) async {
    final token = await ref.read(kioskApiProvider).issueToken(
          departmentId: department.id,
          isPriority: priority,
        );
    ref.read(feedProvider.notifier).patch(
          (f) => f.withNewToken(token, limit: AppConfig.recentLimit),
        );
    _print(token, department);
    return token;
  }

  void reprint(SchoolToken token, SchoolDepartment department) {
    _print(token, department);
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

  void _print(SchoolToken token, SchoolDepartment department) {
    ref
        .read(printQueueProvider)
        .enqueue(PrintJob(token: token, department: department));
  }
}
