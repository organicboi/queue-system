import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';

import '../models/hospital/hospital_board_packet.dart';
import 'announcer.dart' show spellToken;

/// `{token}` / `{room}` substitution — ported from `fill` in
/// lib/hospital/announce.ts. Templates always come from the board packet
/// (`announceTemplateI18n`), never hardcoded here beyond the last-resort default.
String _fill(String template, String token, String room) =>
    template.replaceAll('{token}', token).replaceAll('{room}', room);

const _defaultTemplate = 'Token {token}, please proceed to {room}';

/// Which BCP-47 voice each locale wants. A locale with no matching voice
/// installed falls back to the English wording on an English voice — same rule
/// as lib/hospital/announce.ts. Devanagari (mr/hi) needs no transliteration
/// table: the engine reads a spelled Latin prefix + digits fine.
const _voice = <String, String>{
  'en': 'en-IN',
  'ar': 'ar-SA',
  'mr': 'mr-IN',
  'hi': 'hi-IN',
};

/// Native TTS announcer for the hospital board. Port of `HospitalAnnouncer` in
/// lib/hospital/announce.ts — speaks through the OS engine, so unlike the web
/// board there is no "tap to enable sound" tier.
class HospitalAnnouncer {
  HospitalAnnouncer() : _tts = FlutterTts() {
    _tts.awaitSpeakCompletion(true);
  }

  final FlutterTts _tts;
  List<String>? _installed;
  Future<void> _queue = Future.value();

  /// True while an announcement is in flight — the ad rail lowers video audio
  /// rather than talking over a token call.
  final ValueNotifier<bool> isSpeaking = ValueNotifier(false);

  Future<List<String>> _installedLangs() async {
    if (_installed != null) return _installed!;
    try {
      final langs = await _tts.getLanguages;
      _installed = (langs as List?)?.map((l) => '$l'.toLowerCase()).toList() ??
          const [];
    } catch (_) {
      _installed = const [];
    }
    return _installed!;
  }

  Future<bool> _hasVoice(String bcp47) async {
    final langs = await _installedLangs();
    final prefix = bcp47.split('-').first;
    return langs.any((l) => l == bcp47.toLowerCase() || l.startsWith(prefix));
  }

  /// Announce one call. [locales] is the branch language list, in order.
  Future<void> announceCall({
    required String tokenCode,
    required String roomLabel,
    required List<String> locales,
    required Map<String, String> templates,
  }) {
    _queue = _queue.then((_) => _speak(
          tokenCode: tokenCode,
          roomLabel: roomLabel,
          locales: locales,
          templates: templates,
        ));
    return _queue;
  }

  Future<void> _speak({
    required String tokenCode,
    required String roomLabel,
    required List<String> locales,
    required Map<String, String> templates,
  }) async {
    if (tokenCode.trim().isEmpty) return;
    final speakLocales = locales.isEmpty ? const ['en'] : locales;
    isSpeaking.value = true;
    try {
      var lastSpoken = '';
      for (final locale in speakLocales) {
        final target = _voice[locale] ?? 'en-IN';
        final template = (templates[locale]?.trim().isNotEmpty ?? false)
            ? templates[locale]!
            : (templates['en']?.trim().isNotEmpty ?? false
                ? templates['en']!
                : _defaultTemplate);
        final enTemplate = templates['en']?.trim().isNotEmpty ?? false
            ? templates['en']!
            : _defaultTemplate;

        final hasVoice = await _hasVoice(target);
        final text = hasVoice
            ? _fill(template, spellToken(tokenCode), roomLabel)
            : _fill(enTemplate, spellToken(tokenCode), roomLabel);
        final voiceLang = hasVoice ? target : 'en-IN';

        if (text.trim().isEmpty || text == lastSpoken) continue;
        lastSpoken = text;
        await _speakOne(text, voiceLang);
      }
    } finally {
      isSpeaking.value = false;
    }
  }

  Future<void> _speakOne(String text, String lang) async {
    try {
      await _tts.setLanguage(lang);
      await _tts.setSpeechRate(0.45);
      await _tts.speak(text);
    } catch (e) {
      debugPrint('[HospitalAnnouncer] speak failed: $e');
    }
  }

  Future<void> dispose() async {
    try {
      await _tts.stop();
    } catch (_) {}
  }
}

/// Tracks which room calls have already been announced so a 3-second poll
/// doesn't re-speak the same call every tick. Keyed on
/// `HospitalBoardRoom.callKey` (room + token + recall count). On the first
/// packet after a (re)connect nothing is returned — a board that just came up
/// must not re-announce every room mid-call.
class HospitalAnnouncementDedupe {
  final Map<String, String> _lastKeyByRoom = {};
  bool _primed = false;

  List<HospitalBoardRoom> newCalls(List<HospitalBoardRoom> rooms) {
    final fresh = <HospitalBoardRoom>[];
    for (final room in rooms) {
      if (!room.isCalled) {
        _lastKeyByRoom.remove(room.id);
        continue;
      }
      final key = room.callKey;
      if (_lastKeyByRoom[room.id] != key) {
        if (_primed) fresh.add(room);
        _lastKeyByRoom[room.id] = key;
      }
    }
    _primed = true;
    return fresh;
  }
}
