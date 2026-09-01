import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../announce/announcer.dart';
import '../../models/board_packet.dart';
import '../../state/board_providers.dart';
import '../theme.dart';
import 'widgets/board_ad_rail.dart';
import 'widgets/board_counter_table.dart';
import 'widgets/board_ticker.dart';
import 'widgets/board_waiting_strip.dart';
import 'widgets/now_calling_overlay.dart';

/// The waiting-area announcement board. Ported from
/// components/school/SchoolBoard.tsx, preserving its structural decisions:
/// one row per open counter (never "last N called"), an ad rail when ads
/// exist, a bottom ticker, and a full-screen flash on a new call — but native,
/// so there is no "tap anywhere to enable sound" curtain: TTS here needs no
/// user gesture at all.
class BoardScreen extends ConsumerStatefulWidget {
  const BoardScreen({super.key});

  @override
  ConsumerState<BoardScreen> createState() => _BoardScreenState();
}

class _BoardScreenState extends ConsumerState<BoardScreen> {
  final _dedupe = AnnouncementDedupe();
  BoardCounter? _flash;
  Timer? _flashTimer;

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

  void _handlePacket(BoardPacket packet) {
    if (!packet.isOk || !packet.announceEnabled) {
      // Still track state so re-enabling announcements later doesn't replay
      // every call that happened while they were off.
      _dedupe.newCalls(packet.counters);
      return;
    }
    final fresh = _dedupe.newCalls(packet.counters);
    if (fresh.isEmpty) return;

    final announcer = ref.read(announcerProvider);
    for (final counter in fresh) {
      announcer.announceCall(
        tokenCode: counter.tokenCode ?? '',
        counterEn: counter.nameEn,
        counterAr: counter.nameAr,
        lang: packet.announcementLang,
        templateEn: packet.announceTemplateEn,
        templateAr: packet.announceTemplateAr,
      );
    }

    // Flash the most recent of the fresh calls.
    setState(() => _flash = fresh.last);
    _flashTimer?.cancel();
    _flashTimer = Timer(NowCallingOverlay.flashDuration, () {
      if (mounted) setState(() => _flash = null);
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<BoardPacket>>(boardProvider, (prev, next) {
      final packet = next.value;
      if (packet != null) _handlePacket(packet);
    });

    final async = ref.watch(boardProvider);
    final announcer = ref.watch(announcerProvider);
    final scale = boardScaleForSize(MediaQuery.sizeOf(context));

    // The board opts out of the app-wide text scaler (app.dart), which is
    // tuned for a kiosk read at arm's length and caps growth at 1.28×. Every
    // size on this screen is already written as `n * scale` against a 1920×1080
    // TV, so a second hidden multiplier only makes the two ways of sizing
    // fight each other — and lands the numbers at reading-distance size on a
    // panel that is looked at from across the room.
    return MediaQuery.withNoTextScaling(
      child: Scaffold(
        backgroundColor: KioskPalette.bg,
        body: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Text(
              '$e',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 30 * scale, color: KioskPalette.inkSoft),
            ),
          ),
          data: (packet) => _Board(
            packet: packet,
            scale: scale,
            flash: _flash,
            announcer: announcer,
            onDismissFlash: () {
              _flashTimer?.cancel();
              setState(() => _flash = null);
            },
          ),
        ),
      ),
    );
  }
}

class _Board extends StatelessWidget {
  const _Board({
    required this.packet,
    required this.scale,
    required this.flash,
    required this.announcer,
    required this.onDismissFlash,
  });

  final BoardPacket packet;
  final double scale;
  final BoardCounter? flash;
  final SchoolAnnouncer announcer;
  final VoidCallback onDismissFlash;

  @override
  Widget build(BuildContext context) {
    final activeAds = packet.ads.where((a) => a.isActive).toList();

    return Stack(
      children: [
        Column(
          children: [
            _Header(packet: packet, scale: scale),
            Expanded(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    // The table carries the four columns now, so the rail gives
                    // back a slice of width to keep the token glyphs large.
                    flex: activeAds.isEmpty ? 100 : 70,
                    child: Column(
                      children: [
                        Expanded(
                          child: BoardCounterTable(
                            counters: packet.counters,
                            scale: scale,
                          ),
                        ),
                        if (packet.departments.isNotEmpty)
                          BoardWaitingStrip(
                            departments: packet.departments,
                            scale: scale,
                          ),
                      ],
                    ),
                  ),
                  if (activeAds.isNotEmpty)
                    Expanded(
                      flex: 30,
                      child: BoardAdRail(
                        ads: activeAds,
                        isSpeaking: announcer.isSpeaking,
                      ),
                    ),
                ],
              ),
            ),
            BoardTicker(message: packet.tickerText, scale: scale),
          ],
        ),
        if (flash != null) NowCallingOverlay(counter: flash!, onDismiss: onDismissFlash),
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.packet, required this.scale});
  final BoardPacket packet;
  final double scale;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 116 * scale,
      padding: EdgeInsets.symmetric(horizontal: 28 * scale),
      decoration: const BoxDecoration(
        color: KioskPalette.surface,
        border: Border(bottom: BorderSide(color: KioskPalette.borderStrong, width: 2)),
      ),
      child: Row(
        children: [
          if (packet.logoUrl.isNotEmpty)
            Padding(
              padding: EdgeInsets.only(right: 20 * scale),
              child: Image.network(
                packet.logoUrl,
                height: 72 * scale,
                errorBuilder: (_, _, _) => const SizedBox.shrink(),
              ),
            ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  packet.schoolNameEn,
                  style: TextStyle(
                    fontSize: 42 * scale,
                    fontWeight: FontWeight.w800,
                    height: 1.1,
                    color: KioskPalette.ink,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                if (packet.schoolNameAr.isNotEmpty)
                  Directionality(
                    textDirection: TextDirection.rtl,
                    child: Text(
                      packet.schoolNameAr,
                      style: TextStyle(
                        fontSize: 26 * scale,
                        fontWeight: FontWeight.w600,
                        height: 1.2,
                        color: KioskPalette.inkSoft,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
            ),
          ),
          if (packet.showClock) _BoardClock(scale: scale),
        ],
      ),
    );
  }
}

class _BoardClock extends StatefulWidget {
  const _BoardClock({required this.scale});
  final double scale;

  @override
  State<_BoardClock> createState() => _BoardClockState();
}

class _BoardClockState extends State<_BoardClock> {
  DateTime _now = DateTime.now();
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _scheduleNextMinute();
  }

  void _scheduleNextMinute() {
    final now = DateTime.now();
    final next = DateTime(now.year, now.month, now.day, now.hour, now.minute)
        .add(const Duration(minutes: 1));
    _timer?.cancel();
    _timer = Timer(next.difference(now), () {
      if (!mounted) return;
      setState(() => _now = DateTime.now());
      _scheduleNextMinute();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hour = _now.hour % 12 == 0 ? 12 : _now.hour % 12;
    final minute = _now.minute.toString().padLeft(2, '0');
    final ampm = _now.hour >= 12 ? 'PM' : 'AM';
    return Text(
      '$hour:$minute $ampm',
      style: TextStyle(
        fontSize: 40 * widget.scale,
        fontWeight: FontWeight.w700,
        fontFeatures: const [FontFeature.tabularFigures()],
        color: KioskPalette.ink,
      ),
    );
  }
}
