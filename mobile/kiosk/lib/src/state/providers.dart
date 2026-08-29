import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/kiosk_api.dart';
import '../config/app_config.dart';
import '../config/kiosk_config.dart';
import '../models/kiosk_bootstrap.dart';
import '../models/kiosk_feed.dart';
import '../models/school_department.dart';
import '../models/school_token.dart';
import '../printing/print_job.dart';
import '../printing/printer.dart';

// ── Device config ────────────────────────────────────────────
final kioskConfigProvider =
    AsyncNotifierProvider<KioskConfigController, KioskConfig>(
  KioskConfigController.new,
);

class KioskConfigController extends AsyncNotifier<KioskConfig> {
  @override
  Future<KioskConfig> build() => KioskConfig.load();

  Future<void> setConfig({
    required String baseUrl,
    required String branchToken,
  }) async {
    final cfg = KioskConfig(baseUrl: baseUrl, branchToken: branchToken);
    await cfg.save();
    state = AsyncData(cfg);
  }

  /// Wipe the branch token — used when the server reports the kiosk is
  /// unregistered, to send the operator back to setup.
  Future<void> reset() async {
    await KioskConfig.clear();
    state = AsyncData(await KioskConfig.load());
  }
}

// ── API client (rebuilds when config changes) ────────────────
final kioskApiProvider = Provider<KioskApi>((ref) {
  final cfg = ref.watch(kioskConfigProvider).requireValue;
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

// ── Printer + queue ──────────────────────────────────────────
final printerProvider = Provider<Printer>((ref) {
  final printer = DebugPrinter();
  ref.onDispose(printer.dispose);
  return printer;
});

/// Result of the most recent print attempt, for the on-screen banner.
typedef PrintOutcome = ({PrintJob job, PrintResult result});

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
    onResult: (job, result) {
      ref
          .read(lastPrintResultProvider.notifier)
          .set((job: job, result: result));
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
