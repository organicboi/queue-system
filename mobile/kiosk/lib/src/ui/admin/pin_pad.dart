import 'package:flutter/material.dart';

import '../theme.dart';

/// A numeric keypad for PIN entry/creation. Used both by [AdminGate] (verify)
/// and the setup wizard's PIN step (create). Deliberately large targets —
/// this is still kiosk hardware, just reached by staff instead of visitors.
class PinPad extends StatefulWidget {
  const PinPad({
    super.key,
    required this.length,
    required this.onSubmit,
    this.title,
    this.subtitle,
    this.errorText,
  });

  final int length;
  final ValueChanged<String> onSubmit;
  final String? title;
  final String? subtitle;
  final String? errorText;

  @override
  State<PinPad> createState() => _PinPadState();
}

class _PinPadState extends State<PinPad> {
  String _digits = '';

  void _tap(String d) {
    if (_digits.length >= widget.length) return;
    setState(() => _digits += d);
    if (_digits.length == widget.length) {
      final value = _digits;
      widget.onSubmit(value);
      // Caller decides whether to clear (wrong PIN) or navigate away
      // (correct PIN) — clearing here too would race a rebuild either way.
      Future.microtask(() {
        if (mounted) setState(() => _digits = '');
      });
    }
  }

  void _backspace() {
    if (_digits.isEmpty) return;
    setState(() => _digits = _digits.substring(0, _digits.length - 1));
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.title != null) ...[
          Text(widget.title!, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 6),
        ],
        if (widget.subtitle != null) ...[
          Text(widget.subtitle!,
              style: const TextStyle(color: KioskPalette.inkSoft),
              textAlign: TextAlign.center),
          const SizedBox(height: 20),
        ],
        Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(widget.length, (i) {
            final filled = i < _digits.length;
            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 7),
              width: 18,
              height: 18,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: filled ? KioskPalette.primary : KioskPalette.surfaceMuted,
                border: Border.all(
                  color: filled ? KioskPalette.primary : KioskPalette.border,
                ),
              ),
            );
          }),
        ),
        if (widget.errorText != null) ...[
          const SizedBox(height: 14),
          Text(widget.errorText!, style: const TextStyle(color: KioskPalette.danger)),
        ],
        const SizedBox(height: 26),
        SizedBox(
          width: 280,
          // FocusTraversalGroup so a remote's D-pad walks the keypad in reading
          // order — on a TV this is the only way to enter the PIN, since Android
          // TV remotes have no number keys.
          child: FocusTraversalGroup(
            child: GridView.count(
              crossAxisCount: 3,
              shrinkWrap: true,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.3,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                for (final (i, d) in [
                  '1', '2', '3', '4', '5', '6', '7', '8', '9'
                ].indexed)
                  _Key(label: d, onTap: () => _tap(d), autofocus: i == 0),
                const SizedBox.shrink(),
                _Key(label: '0', onTap: () => _tap('0')),
                _Key(icon: Icons.backspace_outlined, onTap: _backspace),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _Key extends StatefulWidget {
  const _Key({this.label, this.icon, required this.onTap, this.autofocus = false});
  final String? label;
  final IconData? icon;
  final VoidCallback onTap;
  final bool autofocus;

  @override
  State<_Key> createState() => _KeyState();
}

class _KeyState extends State<_Key> {
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: _focused ? KioskPalette.primarySoft : KioskPalette.surfaceMuted,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: widget.onTap,
        autofocus: widget.autofocus,
        onFocusChange: (v) => setState(() => _focused = v),
        // A visible ring is essential for D-pad users — without it there is no
        // way to tell which key "OK" will press.
        focusColor: Colors.transparent,
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: _focused ? KioskPalette.primary : Colors.transparent,
              width: 2,
            ),
          ),
          child: Center(
            child: widget.label != null
                ? Text(widget.label!,
                    style: const TextStyle(
                        fontSize: 24, fontWeight: FontWeight.w600, color: KioskPalette.ink))
                : Icon(widget.icon, color: KioskPalette.inkSoft),
          ),
        ),
      ),
    );
  }
}
