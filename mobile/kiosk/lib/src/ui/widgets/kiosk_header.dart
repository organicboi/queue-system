import 'dart:async';

import 'package:flutter/material.dart';

import '../../i18n/copy.dart';
import '../theme.dart';

/// The kiosk header: a white rail, one hairline, and nothing that competes
/// with the service blocks underneath it.
///
/// Deliberately spare — identity on one side, the two things a visitor may
/// actually want on the other (what time it is, what language they read).
/// Everything instructional lives in the body below; repeating "touch a
/// service" up here only made the bar look busy.
///
/// Three things this bar used to do and no longer does, because each of them
/// was chrome pretending to be content:
///
/// * **A blue monogram tile.** A branch with no uploaded logo got a coloured
///   square that belonged to none of the department colours below it. A school
///   with a logo still shows the logo; one without simply starts with its name.
/// * **A two-line clock.** A 19px bold time stacked over the date was a
///   headline for information nobody walked up to read. One line now, with
///   tabular figures so the width doesn't twitch every minute.
/// * **A pill-shaped language switch.** It read as a control borrowed from
///   somewhere else. Two words with a hairline between them: someone switching
///   language is looking for their own script, not for a widget.
class KioskHeader extends StatelessWidget {
  const KioskHeader({
    super.key,
    required this.title,
    required this.logoUrl,
    required this.copy,
    required this.languages,
    required this.lang,
    required this.onLangChange,
  });

  final String title;
  final String logoUrl;
  final KioskCopy copy;
  final List<String> languages;
  final String lang;
  final ValueChanged<String> onLangChange;

  @override
  Widget build(BuildContext context) {
    final scale = kioskScale(context);
    return Container(
      height: (KioskPalette.headerHeight * scale).clamp(56.0, 92.0),
      padding: EdgeInsetsDirectional.fromSTEB(26 * scale, 0, 22 * scale, 0),
      decoration: const BoxDecoration(
        color: KioskPalette.surface,
        border: Border(bottom: BorderSide(color: KioskPalette.border)),
      ),
      child: LayoutBuilder(
        builder: (context, c) {
          // Below this the clock competes with the school name for room, and
          // the name wins.
          final showClock = c.maxWidth >= 720;
          return Row(
            children: [
              if (logoUrl.isNotEmpty) ...[
                _Logo(url: logoUrl),
                const SizedBox(width: 13),
              ],
              Expanded(
                child: Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: KioskPalette.ink,
                    letterSpacing: -0.2,
                  ),
                ),
              ),
              if (showClock) ...[
                const SizedBox(width: 16),
                _Clock(lang: lang),
              ],
              if (languages.length > 1) ...[
                const SizedBox(width: 22),
                _LangToggle(
                  languages: languages,
                  lang: lang,
                  onChange: onLangChange,
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

/// Shown only when the school has actually uploaded one. A generated initial
/// in a tinted square is a logo the school never chose.
class _Logo extends StatelessWidget {
  const _Logo({required this.url});
  final String url;

  @override
  Widget build(BuildContext context) {
    final size = (34.0 * kioskScale(context)).clamp(30.0, 48.0);
    final blank = SizedBox(width: size, height: size);

    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: Image.network(
        url,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => blank,
        loadingBuilder: (_, child, progress) => progress == null ? child : blank,
      ),
    );
  }
}

/// Ticks on the minute, not the second — a seconds hand would wake the GPU
/// 60× more often on hardware that is already tight on frame budget.
class _Clock extends StatefulWidget {
  const _Clock({required this.lang});
  final String lang;

  @override
  State<_Clock> createState() => _ClockState();
}

class _ClockState extends State<_Clock> {
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
    return Row(
      mainAxisSize: MainAxisSize.min,
      textBaseline: TextBaseline.alphabetic,
      crossAxisAlignment: CrossAxisAlignment.baseline,
      children: [
        Text(
          KioskCopy.clockOf(widget.lang, _now),
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: KioskPalette.ink,
            fontFeatures: [FontFeature.tabularFigures()],
          ),
        ),
        const SizedBox(width: 10),
        Text(
          KioskCopy.dateOf(widget.lang, _now),
          style: const TextStyle(fontSize: 14, color: KioskPalette.inkFaint),
        ),
      ],
    );
  }
}

/// Each language in its own script, the current one in full ink and the rest
/// muted, a hairline between them. No track, no pill, no shadow: the words are
/// the control.
class _LangToggle extends StatelessWidget {
  const _LangToggle({
    required this.languages,
    required this.lang,
    required this.onChange,
  });

  final List<String> languages;
  final String lang;
  final ValueChanged<String> onChange;

  static const _names = {
    'en': 'English',
    'ar': 'العربية',
    'mr': 'मराठी',
    'hi': 'हिंदी',
  };

  @override
  Widget build(BuildContext context) {
    final items = <Widget>[];
    for (final l in languages) {
      if (items.isNotEmpty) {
        items.add(
          Container(
            width: 1,
            height: 16,
            margin: const EdgeInsets.symmetric(horizontal: 12),
            color: KioskPalette.border,
          ),
        );
      }
      items.add(
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => onChange(l),
            borderRadius: BorderRadius.circular(KioskPalette.radiusSm),
            // The word is small; the target around it is not.
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 14),
              child: AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 150),
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.2,
                  color: l == lang ? KioskPalette.ink : KioskPalette.inkFaint,
                ),
                child: Text(_names[l] ?? l.toUpperCase()),
              ),
            ),
          ),
        ),
      );
    }

    return Row(mainAxisSize: MainAxisSize.min, children: items);
  }
}
