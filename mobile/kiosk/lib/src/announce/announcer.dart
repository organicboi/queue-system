import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';

import '../models/board_packet.dart';

/// Splits a token code into a spelled-out announcement string. Ported
/// **verbatim** from `spellToken` in lib/school/announce.ts — letters are
/// always spelled one at a time, digits only when there are 3 or more of
/// them (a 2-digit number like "5" or "12" is read naturally; "104" is read
/// as "one, oh, four" because a queue number spoken as "one hundred four"
/// is easy to mishear as a different number entirely).
String spellToken(String? code) {
  if (code == null || code.isEmpty) return '';
  final match = RegExp(r'^([A-Za-z]*)(\d*)$').firstMatch(code);
  if (match == null) return code.split('').join(', ');
  final letters = match.group(1) ?? '';
  final digits = match.group(2) ?? '';
  final spelledLetters = letters.split('').join(', ');
  final spelledDigits = digits.length >= 3 ? digits.split('').join(', ') : digits;
  return [spelledLetters, spelledDigits].where((s) => s.isNotEmpty).join(', ');
}

/// Arabic transliteration of each Latin letter name, for spelling a token's
/// letter prefix when speaking Arabic. Ported verbatim from
/// `ARABIC_LETTER_NAMES` in lib/school/announce.ts.
const Map<String, String> arabicLetterNames = {
  'A': 'أيه', 'B': 'بي', 'C': 'سي', 'D': 'دي', 'E': 'إي', 'F': 'إف',
  'G': 'جي', 'H': 'إتش', 'I': 'آي', 'J': 'جيه', 'K': 'كيه', 'L': 'إل',
  'M': 'إم', 'N': 'إن', 'O': 'أو', 'P': 'بي', 'Q': 'كيو', 'R': 'آر',
  'S': 'إس', 'T': 'تي', 'U': 'يو', 'V': 'في', 'W': 'دبليو', 'X': 'إكس',
  'Y': 'واي', 'Z': 'زد',
};

/// Same split as [spellToken] but with the Latin letters replaced by their
/// Arabic names — used only for the Arabic utterance, so an Arabic speaker
/// never hears a Latin letter name dropped into the middle of a sentence.
String spellTokenArabic(String? code) {
  if (code == null || code.isEmpty) return '';
  final match = RegExp(r'^([A-Za-z]*)(\d*)$').firstMatch(code);
  if (match == null) return code.split('').join('، ');
  final letters = match.group(1) ?? '';
  final digits = match.group(2) ?? '';
  final spelledLetters =
      letters.split('').map((l) => arabicLetterNames[l.toUpperCase()] ?? l).join('، ');
  final spelledDigits = digits.length >= 3 ? digits.split('').join('، ') : digits;
  return [spelledLetters, spelledDigits].where((s) => s.isNotEmpty).join('، ');
}

/// `{token}` / `{counter}` substitution — ported verbatim from `fill` in
/// lib/school/announce.ts. Templates always come from the board packet
/// (`announceTemplateEn`/`announceTemplateAr`), never hardcoded here.
String fillTemplate(String template, String token, String counter) {
  return template.replaceAll('{token}', token).replaceAll('{counter}', counter);
}

/// Native TTS announcer. Unlike the web board's `SchoolAnnouncer`, there is no
/// autoplay-blocked / "tap to enable sound" tier here at all — this speaks
/// through the OS's own TTS engine, which needs no user gesture.
///
/// Announcements are serialised through one queue: two counters calling
/// within the same second must speak one after another, not overlap, and
/// `awaitSpeakCompletion(true)` is what makes `both`-language mode finish the
/// English sentence before starting the Arabic one instead of cutting itself
/// off.
class SchoolAnnouncer {
  SchoolAnnouncer() : _tts = FlutterTts() {
    _tts.awaitSpeakCompletion(true);
  }

  final FlutterTts _tts;
  bool _arabicChecked = false;
  bool _hasArabic = false;
  Future<void> _queue = Future.value();

  /// Ducking hook for the ad rail: true while an announcement is in flight so
  /// video/ad audio can be lowered rather than talking over a token call.
  final ValueNotifier<bool> isSpeaking = ValueNotifier(false);

  Future<void> _ensureArabicChecked() async {
    if (_arabicChecked) return;
    _arabicChecked = true;
    try {
      final languages = await _tts.getLanguages;
      _hasArabic = (languages as List?)
              ?.any((l) => l.toString().toLowerCase().startsWith('ar')) ??
          false;
    } catch (_) {
      _hasArabic = false;
    }
  }

  Future<void> _speakOne(String text, String lang) async {
    if (text.trim().isEmpty) return;
    try {
      await _tts.setLanguage(lang);
      // flutter_tts normalises rate to 0.0-1.0 per-platform rather than the
      // Web Speech API's ~0.1-10 scale, so this isn't a literal port of the
      // web board's `rate = 0.82` — it's picked to land at the same
      // "slightly slower than default" pace on Android's engine.
      await _tts.setSpeechRate(0.45);
      await _tts.speak(text);
    } catch (e) {
      debugPrint('[SchoolAnnouncer] speak failed: $e');
    }
  }

  /// Announces one call. [lang] is the screen's configured
  /// `announcementLang` ('en' | 'ar' | 'both'); falls back to English
  /// whenever no Arabic voice is installed, mirroring the web board's
  /// `hasArabic` guard.
  Future<void> announceCall({
    required String tokenCode,
    required String counterEn,
    required String counterAr,
    required String lang,
    required String templateEn,
    required String templateAr,
  }) {
    // Chain onto the existing queue rather than awaiting it here, so callers
    // never block on a prior announcement finishing.
    _queue = _queue.then((_) => _speakCall(
          tokenCode: tokenCode,
          counterEn: counterEn,
          counterAr: counterAr,
          lang: lang,
          templateEn: templateEn,
          templateAr: templateAr,
        ));
    return _queue;
  }

  Future<void> _speakCall({
    required String tokenCode,
    required String counterEn,
    required String counterAr,
    required String lang,
    required String templateEn,
    required String templateAr,
  }) async {
    await _ensureArabicChecked();
    isSpeaking.value = true;
    try {
      final enText = fillTemplate(templateEn, spellToken(tokenCode), counterEn);
      final arText = templateAr.trim().isEmpty
          ? ''
          : fillTemplate(templateAr, spellTokenArabic(tokenCode), counterAr);

      if (lang == 'ar') {
        await _speakOne(_hasArabic ? arText : enText, _hasArabic ? 'ar-SA' : 'en-US');
      } else if (lang == 'both') {
        await _speakOne(enText, 'en-US');
        if (_hasArabic && arText.trim().isNotEmpty) {
          await _speakOne(arText, 'ar-SA');
        }
      } else {
        await _speakOne(enText, 'en-US');
      }
    } finally {
      isSpeaking.value = false;
    }
  }

  Future<void> dispose() async {
    try {
      await _tts.stop();
    } catch (_) {}
  }
}

/// Tracks which counter calls have already been announced, so a 3-second
/// poll doesn't re-speak the same call on every tick. Keyed on
/// `BoardCounter.callKey` (counter + token + recall count) — a recall changes
/// no other visible column, which is exactly why `recallCount` has to be part
/// of the key (see docs/school-queue-plan.md).
class AnnouncementDedupe {
  final Map<String, String> _lastKeyByCounter = {};
  bool _primed = false;

  /// Returns the counters whose call is new since the last packet — on the
  /// very first packet (device just started/reconnected), nothing is
  /// returned: a freshly opened board must not immediately re-announce every
  /// counter that was already mid-call before it connected.
  List<BoardCounter> newCalls(List<BoardCounter> counters) {
    final fresh = <BoardCounter>[];
    for (final counter in counters) {
      if (!counter.isCalled) {
        _lastKeyByCounter.remove(counter.id);
        continue;
      }
      final key = counter.callKey;
      if (_lastKeyByCounter[counter.id] != key) {
        if (_primed) fresh.add(counter);
        _lastKeyByCounter[counter.id] = key;
      }
    }
    _primed = true;
    return fresh;
  }
}
