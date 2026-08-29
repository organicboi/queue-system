import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../../models/board_packet.dart';
import '../../theme.dart';

/// Right-hand rail: one ad at a time, on its own `duration_seconds`. Video
/// ads only unmute when the ad itself opts in (`audio_enabled`), and even
/// then are ducked to silence while [isSpeaking] is true — a token
/// announcement must never compete with ad audio for a visitor's attention.
class BoardAdRail extends StatefulWidget {
  const BoardAdRail({super.key, required this.ads, required this.isSpeaking});

  final List<BoardAd> ads;
  final ValueListenable<bool> isSpeaking;

  @override
  State<BoardAdRail> createState() => _BoardAdRailState();
}

class _BoardAdRailState extends State<BoardAdRail> {
  int _index = 0;
  Timer? _advanceTimer;
  VideoPlayerController? _video;

  @override
  void initState() {
    super.initState();
    widget.isSpeaking.addListener(_applyDucking);
    _loadCurrent();
  }

  @override
  void didUpdateWidget(covariant BoardAdRail oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.ads, widget.ads) && widget.ads.isNotEmpty) {
      // Ad list changed (e.g. one was toggled off) — clamp the index and
      // keep playing rather than restarting from the top.
      if (_index >= widget.ads.length) _index = 0;
    }
  }

  BoardAd? get _current => widget.ads.isEmpty
      ? null
      : widget.ads[_index.clamp(0, widget.ads.length - 1)];

  void _loadCurrent() {
    _advanceTimer?.cancel();
    _video?.dispose();
    _video = null;

    final ad = _current;
    if (ad == null) return;

    if (ad.isVideo) {
      final controller = VideoPlayerController.networkUrl(Uri.parse(ad.fileUrl));
      _video = controller;
      controller.addListener(_onVideoTick);
      unawaited(() async {
        try {
          await controller.initialize();
          if (!mounted) return;
          controller
            ..setLooping(false)
            ..play();
          _applyDucking();
          setState(() {});
        } catch (_) {
          _advance();
        }
      }());
    }

    _advanceTimer = Timer(Duration(seconds: ad.durationSeconds.clamp(3, 120)), _advance);
  }

  void _onVideoTick() {
    final v = _video;
    if (v == null) return;
    final value = v.value;
    if (value.isInitialized && !value.isPlaying && value.position >= value.duration) {
      _advance();
    }
  }

  void _advance() {
    if (!mounted || widget.ads.isEmpty) return;
    setState(() => _index = (_index + 1) % widget.ads.length);
    _loadCurrent();
  }

  void _applyDucking() {
    final v = _video;
    final ad = _current;
    if (v == null || ad == null || !v.value.isInitialized) return;
    final shouldBeAudible = ad.audioEnabled && !widget.isSpeaking.value;
    v.setVolume(shouldBeAudible ? 1.0 : 0.0);
  }

  @override
  void dispose() {
    widget.isSpeaking.removeListener(_applyDucking);
    _advanceTimer?.cancel();
    _video?.removeListener(_onVideoTick);
    _video?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ad = _current;
    return Container(
      color: KioskPalette.ink,
      alignment: Alignment.center,
      child: ad == null
          ? const SizedBox.shrink()
          : ad.isVideo
              ? (_video?.value.isInitialized ?? false)
                  ? AspectRatio(
                      aspectRatio: _video!.value.aspectRatio,
                      child: VideoPlayer(_video!),
                    )
                  : const CircularProgressIndicator(color: Colors.white54)
              : Image.network(
                  ad.fileUrl,
                  fit: BoxFit.contain,
                  errorBuilder: (_, _, _) => const SizedBox.shrink(),
                ),
    );
  }
}
