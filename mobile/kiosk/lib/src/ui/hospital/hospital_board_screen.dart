import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../announce/hospital_announcer.dart';
import '../../models/hospital/hospital_board_packet.dart';
import '../../state/hospital_board_providers.dart';
import '../dept_icon.dart';
import '../display/widgets/board_ad_rail.dart';
import '../display/widgets/board_ticker.dart';
import '../theme.dart';

/// The hospital waiting-area board. Ported from
/// components/hospital/HospitalBoard.tsx: one row per open room
/// (TOKEN | ROOM | DOCTOR), a recently-served strip, per-department waiting
/// counts, the reused ad rail + ticker, and a full-screen flash + native TTS
/// on a new call. Poll-only (3s) with a dedupe — a TV that drops its network
/// in a power blink recovers with nobody there to reload it.
class HospitalBoardScreen extends ConsumerStatefulWidget {
  const HospitalBoardScreen({super.key});

  @override
  ConsumerState<HospitalBoardScreen> createState() =>
      _HospitalBoardScreenState();
}

class _HospitalBoardScreenState extends ConsumerState<HospitalBoardScreen> {
  final _dedupe = HospitalAnnouncementDedupe();
  HospitalBoardRoom? _flash;
  Timer? _flashTimer;

  static const _flashDuration = Duration(seconds: 8);

  @override
  void initState() {
    super.initState();
    WakelockPlus.enable();
  }

  @override
  void dispose() {
    WakelockPlus.disable();
    _flashTimer?.cancel();
    super.dispose();
  }

  void _handlePacket(HospitalBoardPacket packet) {
    if (!packet.isOk || !packet.announceEnabled) {
      _dedupe.newCalls(packet.rooms); // keep state, don't replay later
      return;
    }
    final fresh = _dedupe.newCalls(packet.rooms);
    if (fresh.isEmpty) return;

    final announcer = ref.read(hospitalAnnouncerProvider);
    for (final room in fresh) {
      announcer.announceCall(
        tokenCode: room.tokenCode ?? '',
        roomLabel: room.label,
        locales: packet.announceLocalesResolved,
        templates: packet.announceTemplateI18n,
      );
    }

    setState(() => _flash = fresh.last);
    _flashTimer?.cancel();
    _flashTimer = Timer(_flashDuration, () {
      if (mounted) setState(() => _flash = null);
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<HospitalBoardPacket>>(hospitalBoardProvider,
        (prev, next) {
      final packet = next.value;
      if (packet != null) _handlePacket(packet);
    });

    final async = ref.watch(hospitalBoardProvider);
    final announcer = ref.watch(hospitalAnnouncerProvider);
    final scale = boardScaleForSize(MediaQuery.sizeOf(context));

    return MediaQuery.withNoTextScaling(
      child: Scaffold(
        backgroundColor: KioskPalette.bg,
        body: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Text('$e',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 30 * scale, color: KioskPalette.inkSoft)),
          ),
          data: (packet) => Stack(
            children: [
              Column(
                children: [
                  _Header(packet: packet, scale: scale),
                  Expanded(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(
                          flex: packet.ads.isEmpty ? 100 : 70,
                          child: Column(
                            children: [
                              Expanded(
                                child: _RoomTable(
                                    rooms: packet.rooms, scale: scale),
                              ),
                              if (packet.recent.isNotEmpty)
                                _RecentStrip(
                                    recent: packet.recent, scale: scale),
                              if (packet.departments.isNotEmpty)
                                _WaitingStrip(
                                    departments: packet.departments,
                                    scale: scale),
                            ],
                          ),
                        ),
                        if (packet.ads.isNotEmpty)
                          Expanded(
                            flex: 30,
                            child: BoardAdRail(
                              ads: packet.ads,
                              isSpeaking: announcer.isSpeaking,
                            ),
                          ),
                      ],
                    ),
                  ),
                  BoardTicker(message: packet.tickerText, scale: scale),
                ],
              ),
              if (_flash != null)
                _HospitalNowCalling(
                  room: _flash!,
                  onDismiss: () {
                    _flashTimer?.cancel();
                    setState(() => _flash = null);
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.packet, required this.scale});
  final HospitalBoardPacket packet;
  final double scale;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 116 * scale,
      padding: EdgeInsets.symmetric(horizontal: 28 * scale),
      decoration: const BoxDecoration(
        color: KioskPalette.surface,
        border: Border(
            bottom: BorderSide(color: KioskPalette.borderStrong, width: 2)),
      ),
      child: Row(
        children: [
          if (packet.logoUrl.isNotEmpty)
            Padding(
              padding: EdgeInsets.only(right: 20 * scale),
              child: Image.network(packet.logoUrl,
                  height: 72 * scale,
                  errorBuilder: (_, _, _) => const SizedBox.shrink()),
            ),
          Expanded(
            child: Text(
              packet.hospitalName,
              style: TextStyle(
                fontSize: 42 * scale,
                fontWeight: FontWeight.w800,
                color: KioskPalette.ink,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (packet.showClock) _Clock(scale: scale),
        ],
      ),
    );
  }
}

class _Clock extends StatefulWidget {
  const _Clock({required this.scale});
  final double scale;
  @override
  State<_Clock> createState() => _ClockState();
}

class _ClockState extends State<_Clock> {
  DateTime _now = DateTime.now();
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 20), (_) {
      if (mounted) setState(() => _now = DateTime.now());
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final h = _now.hour % 12 == 0 ? 12 : _now.hour % 12;
    final m = _now.minute.toString().padLeft(2, '0');
    final ampm = _now.hour >= 12 ? 'PM' : 'AM';
    return Text('$h:$m $ampm',
        style: TextStyle(
          fontSize: 40 * widget.scale,
          fontWeight: FontWeight.w700,
          fontFeatures: const [FontFeature.tabularFigures()],
          color: KioskPalette.ink,
        ));
  }
}

class _RoomTable extends StatelessWidget {
  const _RoomTable({required this.rooms, required this.scale});
  final List<HospitalBoardRoom> rooms;
  final double scale;

  @override
  Widget build(BuildContext context) {
    final open = [...rooms.where((r) => r.isOpen)]
      ..sort((a, b) {
        final o = a.displayOrder.compareTo(b.displayOrder);
        return o != 0 ? o : a.label.compareTo(b.label);
      });

    if (open.isEmpty) {
      return Center(
        child: Text('No rooms are open right now',
            style:
                TextStyle(fontSize: 34 * scale, color: KioskPalette.inkSoft)),
      );
    }

    return Column(
      children: [
        Container(
          padding: EdgeInsets.symmetric(
              horizontal: 28 * scale, vertical: 12 * scale),
          child: Row(
            children: [
              _hcell('TOKEN', scale, flex: 3),
              _hcell('ROOM', scale, flex: 4),
              _hcell('DOCTOR', scale, flex: 5),
            ],
          ),
        ),
        Expanded(
          child: ListView.separated(
            padding: EdgeInsets.symmetric(horizontal: 20 * scale),
            itemCount: open.length,
            separatorBuilder: (_, _) => SizedBox(height: 10 * scale),
            itemBuilder: (context, i) => _RoomRow(room: open[i], scale: scale),
          ),
        ),
      ],
    );
  }

  Widget _hcell(String t, double scale, {required int flex}) => Expanded(
        flex: flex,
        child: Text(t,
            style: TextStyle(
              fontSize: 22 * scale,
              fontWeight: FontWeight.w700,
              letterSpacing: 2,
              color: KioskPalette.inkFaint,
            )),
      );
}

class _RoomRow extends StatelessWidget {
  const _RoomRow({required this.room, required this.scale});
  final HospitalBoardRoom room;
  final double scale;

  @override
  Widget build(BuildContext context) {
    final color = room.departmentColor != null
        ? departmentColor(room.departmentColor!)
        : KioskPalette.primary;
    return Container(
      padding:
          EdgeInsets.symmetric(horizontal: 20 * scale, vertical: 16 * scale),
      decoration: BoxDecoration(
        color: KioskPalette.surface,
        borderRadius: BorderRadius.circular(14 * scale),
        border: Border(left: BorderSide(color: color, width: 6 * scale)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            flex: 3,
            child: Text(
              room.isCalled ? room.tokenCode! : '—',
              style: TextStyle(
                fontSize: (room.isCalled ? 52 : 40) * scale,
                fontWeight: FontWeight.w900,
                color: room.isCalled ? KioskPalette.ink : KioskPalette.inkFaint,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
          Expanded(
            flex: 4,
            child: Text(room.label,
                style: TextStyle(
                    fontSize: 34 * scale,
                    fontWeight: FontWeight.w700,
                    color: KioskPalette.ink)),
          ),
          Expanded(
            flex: 5,
            child: Text(
              room.doctorOnLeave
                  ? '${room.doctorName ?? ''} (on leave)'
                  : (room.doctorName ?? room.departmentNameFor('en')),
              style: TextStyle(
                  fontSize: 30 * scale,
                  fontWeight: FontWeight.w600,
                  color: KioskPalette.inkSoft),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (room.isPriority)
            Container(
              margin: EdgeInsets.only(left: 8 * scale),
              padding: EdgeInsets.symmetric(
                  horizontal: 10 * scale, vertical: 4 * scale),
              decoration: BoxDecoration(
                color: KioskPalette.primarySoft,
                borderRadius: BorderRadius.circular(6 * scale),
              ),
              child: Text('PRIORITY',
                  style: TextStyle(
                      fontSize: 16 * scale,
                      fontWeight: FontWeight.w800,
                      color: KioskPalette.primary)),
            ),
        ],
      ),
    );
  }
}

class _RecentStrip extends StatelessWidget {
  const _RecentStrip({required this.recent, required this.scale});
  final List<HospitalBoardRecent> recent;
  final double scale;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          EdgeInsets.symmetric(horizontal: 24 * scale, vertical: 10 * scale),
      color: KioskPalette.surfaceMuted,
      child: Row(
        children: [
          Text('SERVED  ',
              style: TextStyle(
                  fontSize: 18 * scale,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5,
                  color: KioskPalette.inkFaint)),
          Expanded(
            child: Wrap(
              spacing: 18 * scale,
              children: [
                for (final r in recent.take(8))
                  Text(r.tokenCode,
                      style: TextStyle(
                          fontSize: 24 * scale,
                          fontWeight: FontWeight.w700,
                          color: KioskPalette.inkSoft,
                          fontFeatures: const [FontFeature.tabularFigures()])),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _WaitingStrip extends StatelessWidget {
  const _WaitingStrip({required this.departments, required this.scale});
  final List<HospitalBoardDepartment> departments;
  final double scale;

  @override
  Widget build(BuildContext context) {
    final withWaiting = departments.where((d) => d.waiting > 0).toList();
    if (withWaiting.isEmpty) return const SizedBox.shrink();
    return Container(
      padding:
          EdgeInsets.symmetric(horizontal: 24 * scale, vertical: 12 * scale),
      decoration: const BoxDecoration(
        color: KioskPalette.surface,
        border: Border(top: BorderSide(color: KioskPalette.border)),
      ),
      child: Wrap(
        spacing: 24 * scale,
        runSpacing: 8 * scale,
        children: [
          for (final d in withWaiting)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 12 * scale,
                  height: 12 * scale,
                  decoration: BoxDecoration(
                      color: departmentColor(d.color), shape: BoxShape.circle),
                ),
                SizedBox(width: 8 * scale),
                Text('${d.nameFor('en')}: ${d.waiting}',
                    style: TextStyle(
                        fontSize: 22 * scale,
                        fontWeight: FontWeight.w600,
                        color: KioskPalette.inkSoft)),
              ],
            ),
        ],
      ),
    );
  }
}

/// Full-screen flash for one just-called token. Room leads the token so a
/// patient waiting on Room 4 can ignore a Room 2 call without decoding a number
/// first (same reasoning as the school NowCallingOverlay).
class _HospitalNowCalling extends StatelessWidget {
  const _HospitalNowCalling({required this.room, required this.onDismiss});
  final HospitalBoardRoom room;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final color = room.departmentColor != null
        ? departmentColor(room.departmentColor!)
        : KioskPalette.primary;
    return Positioned.fill(
      child: GestureDetector(
        onTap: onDismiss,
        child: Container(
          color: Colors.black.withValues(alpha: 0.86),
          alignment: Alignment.center,
          child: LayoutBuilder(builder: (context, c) {
            final unit = c.maxHeight / 1080;
            final tokenFont = (c.maxHeight * 0.30).clamp(96.0, 340.0);
            return Padding(
              padding: EdgeInsets.symmetric(horizontal: 48 * unit),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: EdgeInsets.symmetric(
                        horizontal: 34 * unit, vertical: 12 * unit),
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(16 * unit),
                    ),
                    child: Text(
                      room.recallCount > 0 ? 'CALLING AGAIN' : 'NOW CALLING',
                      style: TextStyle(
                        fontSize: 34 * unit,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 4 * unit,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  SizedBox(height: 28 * unit),
                  Directionality(
                    textDirection: TextDirection.ltr,
                    child: Text(
                      room.tokenCode ?? '',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: tokenFont,
                        fontWeight: FontWeight.w900,
                        height: 1,
                        color: Colors.white,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ),
                  SizedBox(height: 24 * unit),
                  Text(
                    [room.label, room.doctorName]
                        .where((s) => (s ?? '').isNotEmpty)
                        .join('  ·  '),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 46 * unit,
                      fontWeight: FontWeight.w700,
                      color: Colors.white70,
                    ),
                  ),
                ],
              ),
            );
          }),
        ),
      ),
    );
  }
}
