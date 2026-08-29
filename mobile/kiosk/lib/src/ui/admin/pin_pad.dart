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
          child: GridView.count(
            crossAxisCount: 3,
            shrinkWrap: true,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.3,
            physics: const NeverScrollableScrollPhysics(),
            children: [
              for (final d in ['1', '2', '3', '4', '5', '6', '7', '8', '9'])
                _Key(label: d, onTap: () => _tap(d)),
              const SizedBox.shrink(),
              _Key(label: '0', onTap: () => _tap('0')),
              _Key(icon: Icons.backspace_outlined, onTap: _backspace),
            ],
          ),
        ),
      ],
    );
  }
}

class _Key extends StatelessWidget {
  const _Key({this.label, this.icon, required this.onTap});
  final String? label;
  final IconData? icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: KioskPalette.surfaceMuted,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Center(
          child: label != null
              ? Text(label!,
                  style: const TextStyle(
                      fontSize: 24, fontWeight: FontWeight.w600, color: KioskPalette.ink))
              : Icon(icon, color: KioskPalette.inkSoft),
        ),
      ),
    );
  }
}
