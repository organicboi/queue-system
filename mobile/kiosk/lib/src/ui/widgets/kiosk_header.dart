import 'dart:async';

import 'package:flutter/material.dart';

import '../../i18n/copy.dart';
import '../theme.dart';

/// The kiosk header. Deliberately spare: identity on one side, the two things
/// a visitor may actually want on the other (what time it is, what language
/// they read). Everything instructional lives in the body below — repeating
/// "touch a service" up here only made the bar look busy.
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
      height: (KioskPalette.headerHeight * scale).clamp(64.0, 108.0),
      padding: EdgeInsetsDirectional.fromSTEB(24 * scale, 0, 20 * scale, 0),
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
              _Logo(url: logoUrl, name: title),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 23,
                    fontWeight: FontWeight.w700,
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
                const SizedBox(width: 18),
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

class _Logo extends StatelessWidget {
  const _Logo({required this.url, required this.name});
  final String url;
  final String name;

  @override
  Widget build(BuildContext context) {
    final size = (46.0 * kioskScale(context)).clamp(40.0, 66.0);
    final initial = name.trim().isNotEmpty ? name.trim()[0].toUpperCase() : '#';
    final fallback = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: KioskPalette.primarySoft,
        borderRadius: BorderRadius.circular(13),
      ),
      child: Text(
        initial,
        style: const TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.w800,
          color: KioskPalette.primary,
        ),
      ),
    );

    if (url.isEmpty) return fallback;
    return ClipRRect(
      borderRadius: BorderRadius.circular(13),
      child: Image.network(
        url,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => fallback,
        loadingBuilder: (_, child, progress) =>
            progress == null ? child : fallback,
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
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(
          KioskCopy.clockOf(widget.lang, _now),
          style: const TextStyle(
            fontSize: 19,
            fontWeight: FontWeight.w700,
            color: KioskPalette.ink,
            height: 1.1,
          ),
        ),
        Text(
          KioskCopy.dateOf(widget.lang, _now),
          style: const TextStyle(
            fontSize: 12.5,
            color: KioskPalette.inkFaint,
            height: 1.3,
          ),
        ),
      ],
    );
  }
}

class _LangToggle extends StatelessWidget {
  const _LangToggle({
    required this.languages,
    required this.lang,
    required this.onChange,
  });

  final List<String> languages;
  final String lang;
  final ValueChanged<String> onChange;

  static const _names = {'en': 'English', 'ar': 'العربية'};

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: KioskPalette.surfaceMuted,
        borderRadius: BorderRadius.circular(KioskPalette.radiusPill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final l in languages)
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () => onChange(l),
                borderRadius: BorderRadius.circular(KioskPalette.radiusPill),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 11,
                  ),
                  decoration: BoxDecoration(
                    color:
                        l == lang ? KioskPalette.surface : Colors.transparent,
                    borderRadius:
                        BorderRadius.circular(KioskPalette.radiusPill),
                    boxShadow: l == lang ? KioskPalette.hairShadow : null,
                  ),
                  child: Text(
                    _names[l] ?? l.toUpperCase(),
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: l == lang
                          ? KioskPalette.primary
                          : KioskPalette.inkSoft,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
