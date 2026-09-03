import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../announce/hospital_announcer.dart';
import '../api/hospital_display_api.dart';
import '../models/hospital/hospital_board_packet.dart';
import 'providers.dart';

/// Same cadence as the school board (board_providers.dart): announcement
/// latency is felt by whoever is waiting, and a 3s poll is cheap next to a
/// WebSocket a ceiling-mounted TV has nobody to reload if it drops. The
/// hospital board polls only — no Supabase broadcast subscription.
const hospitalBoardPollInterval = Duration(seconds: 3);

final hospitalDisplayApiProvider = Provider<HospitalDisplayApi>((ref) {
  final cfg = ref.watch(deviceConfigProvider).requireValue;
  return HospitalDisplayApi(baseUrl: cfg.baseUrl, screenToken: cfg.screenToken);
});

/// One announcer for the lifetime of the hospital display screen.
final hospitalAnnouncerProvider = Provider<HospitalAnnouncer>((ref) {
  final announcer = HospitalAnnouncer();
  ref.onDispose(announcer.dispose);
  return announcer;
});

final hospitalBoardProvider =
    AsyncNotifierProvider<HospitalBoardController, HospitalBoardPacket>(
  HospitalBoardController.new,
);

class HospitalBoardController extends AsyncNotifier<HospitalBoardPacket> {
  Timer? _timer;

  @override
  Future<HospitalBoardPacket> build() async {
    final api = ref.watch(hospitalDisplayApiProvider);
    _timer?.cancel();
    _timer = Timer.periodic(hospitalBoardPollInterval, (_) => _poll());
    ref.onDispose(() => _timer?.cancel());
    return api.fetchBoard();
  }

  Future<void> _poll() async {
    try {
      state = AsyncData(await ref.read(hospitalDisplayApiProvider).fetchBoard());
    } catch (_) {
      // A transient failure must not blank a wall-mounted board — keep the
      // last good packet (mirrors useHospitalBoard.ts on the web).
    }
  }
}
