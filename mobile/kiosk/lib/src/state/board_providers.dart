import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../announce/announcer.dart';
import '../api/display_api.dart';
import '../models/board_packet.dart';
import 'providers.dart';

/// Faster than the web board's 8s (`useSchoolBoard.ts`) — announcement
/// latency is felt by whoever's waiting, and polling is cheap next to a
/// WebSocket a ceiling-mounted TV has nobody around to reload if it drops.
const boardPollInterval = Duration(seconds: 3);

final displayApiProvider = Provider<DisplayApi>((ref) {
  final cfg = ref.watch(deviceConfigProvider).requireValue;
  return DisplayApi(baseUrl: cfg.baseUrl, screenToken: cfg.screenToken);
});

/// One announcer for the lifetime of the display screen. Torn down when the
/// role changes away from `display` (the provider scope disposes it).
final announcerProvider = Provider<SchoolAnnouncer>((ref) {
  final announcer = SchoolAnnouncer();
  ref.onDispose(announcer.dispose);
  return announcer;
});

final boardProvider =
    AsyncNotifierProvider<BoardController, BoardPacket>(BoardController.new);

class BoardController extends AsyncNotifier<BoardPacket> {
  Timer? _timer;

  @override
  Future<BoardPacket> build() async {
    final api = ref.watch(displayApiProvider);
    _timer?.cancel();
    _timer = Timer.periodic(boardPollInterval, (_) => _poll());
    ref.onDispose(() => _timer?.cancel());
    return api.fetchBoard();
  }

  Future<void> _poll() async {
    final api = ref.read(displayApiProvider);
    try {
      state = AsyncData(await api.fetchBoard());
    } catch (_) {
      // A transient failure must not blank a wall-mounted board — keep
      // showing the last good packet (mirrors useSchoolBoard.ts on the web).
    }
  }
}
