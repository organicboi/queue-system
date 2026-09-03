import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/hospital_kiosk_api.dart';
import '../models/hospital/hospital_department.dart';
import '../models/hospital/hospital_doctor.dart';
import '../models/hospital/hospital_kiosk_bootstrap.dart';
import '../models/hospital/hospital_kiosk_feed.dart';
import '../models/hospital/hospital_token.dart';
import '../printing/print_job.dart';
import '../printing/ticket_widget.dart';
import 'providers.dart';

/// The hospital kiosk polls its feed a touch slower than the school one — the
/// grid only needs the per-department depth, not a live rail (FEED_POLL_MS in
/// components/hospital/HospitalKiosk.tsx is 8s).
const hospitalFeedPollInterval = Duration(seconds: 8);

// ── API client (rebuilds when config changes) ────────────────
final hospitalKioskApiProvider = Provider<HospitalKioskApi>((ref) {
  final cfg = ref.watch(deviceConfigProvider).requireValue;
  return HospitalKioskApi(
    baseUrl: cfg.baseUrl,
    branchToken: cfg.branchToken,
    onReachability: (reachable) {
      try {
        ref.read(serverLinkProvider.notifier).report(reachable: reachable);
      } catch (_) {/* provider disposed mid-request */}
    },
  );
});

// ── Bootstrap ────────────────────────────────────────────────
final hospitalBootstrapProvider = FutureProvider<HospitalKioskBootstrap>((ref) async {
  return ref.watch(hospitalKioskApiProvider).bootstrap();
});

// ── Feed (per-department queue depth) ────────────────────────
final hospitalFeedProvider =
    AsyncNotifierProvider<HospitalFeedController, HospitalKioskFeed>(
  HospitalFeedController.new,
);

class HospitalFeedController extends AsyncNotifier<HospitalKioskFeed> {
  Timer? _timer;

  @override
  Future<HospitalKioskFeed> build() async {
    final api = ref.watch(hospitalKioskApiProvider);
    _timer?.cancel();
    _timer = Timer.periodic(hospitalFeedPollInterval, (_) => _poll());
    ref.onDispose(() => _timer?.cancel());
    return api.feed();
  }

  Future<void> _poll() async {
    try {
      state = AsyncData(await ref.read(hospitalKioskApiProvider).feed());
    } catch (_) {/* keep the last good feed */}
  }

  Future<void> refreshNow() async {
    try {
      state = AsyncData(await ref.read(hospitalKioskApiProvider).feed());
    } catch (_) {/* ignore */}
  }
}

// ── Logo (fetched once, reused for every ticket) ─────────────
final hospitalTicketLogoProvider = FutureProvider<ui.Image?>((ref) async {
  final bootstrap = await ref.watch(hospitalBootstrapProvider.future);
  return loadTicketLogo(bootstrap.settings?.logoUrl ?? '');
});

// ── Kiosk actions ────────────────────────────────────────────
final hospitalKioskControllerProvider =
    Provider<HospitalKioskController>(HospitalKioskController.new);

class HospitalKioskController {
  HospitalKioskController(this.ref);
  final Ref ref;

  /// Issues a walk-in token, then queues the printed ticket. The row commits
  /// server-side before the print is attempted (see the API route) — a printer
  /// failure never loses the number.
  Future<IssuedHospitalToken> issue({
    required HospitalDepartment department,
    HospitalDoctor? doctor,
    String? priorityCategory,
    required String lang,
  }) async {
    final issued = await ref.read(hospitalKioskApiProvider).issueToken(
          departmentId: department.id,
          doctorId: doctor?.id,
          priorityCategory: priorityCategory,
          locale: lang,
        );
    ref.read(hospitalFeedProvider.notifier).refreshNow();
    _print(
      token: issued.token,
      department: department,
      doctor: doctor,
      waitingAhead: issued.waitingAhead,
      lang: lang,
    );
    return issued;
  }

  void _print({
    required HospitalToken token,
    required HospitalDepartment department,
    HospitalDoctor? doctor,
    int? waitingAhead,
    required String lang,
  }) {
    final bootstrap = ref.read(hospitalBootstrapProvider).value;
    if (bootstrap == null) return;
    final settings = bootstrap.settings;
    final langs = bootstrap.languages;
    final secondary = langs.length > 1 && langs.first == lang
        ? langs[1]
        : (langs.length > 1 && langs.first != lang ? langs.first : null);
    final secondaryDir =
        secondary == 'ar' ? TextDirection.rtl : TextDirection.ltr;

    String deptName(String l) => department.nameFor(l);
    final primaryDept = deptName(lang);
    final secondaryDept = secondary == null ? '' : deptName(secondary);

    final publicUrl = bootstrap.publicTrackingEnabled &&
            token.publicCode.isNotEmpty &&
            bootstrap.publicBaseUrl.isNotEmpty
        ? '${bootstrap.publicBaseUrl}/t/${token.publicCode}'
        : null;

    ref.read(printQueueProvider).enqueue(
          PrintJob(
            data: TicketData(
              schoolNameEn: bootstrap.hospitalName(lang),
              schoolNameAr:
                  secondary == null ? '' : bootstrap.hospitalName(secondary),
              tokenCode: token.tokenCode,
              departmentNameEn: primaryDept,
              departmentNameAr:
                  secondaryDept == primaryDept ? '' : secondaryDept,
              doctorLine: doctor?.name,
              secondaryDir: secondaryDir,
              builtinArabicStrings: false,
              isPriority: token.isPriority,
              footerEn: settings?.ticketFooterFor(lang) ?? '',
              footerAr: secondary == null
                  ? ''
                  : (settings?.ticketFooterFor(secondary) ?? ''),
              issuedAt: DateTime.now(),
              waitingAhead: waitingAhead,
              logo: ref.read(hospitalTicketLogoProvider).value,
              publicUrl: publicUrl,
            ),
          ),
        );
  }
}
