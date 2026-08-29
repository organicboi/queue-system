import 'package:flutter/material.dart';

import '../../config/admin_pin.dart';
import '../admin/pin_pad.dart';
import '../theme.dart';

/// Choose a PIN length, enter it, then confirm by entering it again. Calls
/// [onPinCreated] with a salted hash — the plaintext PIN never leaves this
/// widget (see AdminPin).
class PinSetupStep extends StatefulWidget {
  const PinSetupStep({
    super.key,
    required this.length,
    required this.onLengthChanged,
    required this.onPinCreated,
    required this.alreadySet,
  });

  final int length;
  final ValueChanged<int> onLengthChanged;
  final void Function(String hash, String salt) onPinCreated;
  final bool alreadySet;

  @override
  State<PinSetupStep> createState() => _PinSetupStepState();
}

class _PinSetupStepState extends State<PinSetupStep> {
  String? _firstEntry;
  String? _error;
  bool _confirmed = false;

  void _submit(String pin) {
    if (_firstEntry == null) {
      setState(() {
        _firstEntry = pin;
        _error = null;
      });
      return;
    }
    if (pin == _firstEntry) {
      final (hash, salt) = AdminPin.create(pin);
      widget.onPinCreated(hash, salt);
      setState(() => _confirmed = true);
    } else {
      setState(() {
        _error = "PINs didn't match — start again";
        _firstEntry = null;
      });
    }
  }

  void _reset() {
    setState(() {
      _firstEntry = null;
      _error = null;
      _confirmed = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const SizedBox(height: 8),
        Text('Admin PIN', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 6),
        const Text(
          'Used to get back into settings later — hold the top-left corner '
          'of the screen for 5 seconds.',
          style: TextStyle(color: KioskPalette.inkSoft),
        ),
        const SizedBox(height: 16),
        if (!_confirmed) ...[
          Center(
            child: SegmentedButton<int>(
              segments: const [
                ButtonSegment(value: 4, label: Text('4 digits')),
                ButtonSegment(value: 5, label: Text('5 digits')),
                ButtonSegment(value: 6, label: Text('6 digits')),
              ],
              selected: {widget.length},
              onSelectionChanged: (s) {
                widget.onLengthChanged(s.first);
                _reset();
              },
            ),
          ),
          const SizedBox(height: 24),
          Center(
            child: PinPad(
              key: ValueKey('${widget.length}-${_firstEntry == null}'),
              length: widget.length,
              title: _firstEntry == null ? 'Choose a PIN' : 'Confirm PIN',
              errorText: _error,
              onSubmit: _submit,
            ),
          ),
        ] else
          Center(
            child: Column(
              children: [
                const Icon(Icons.check_circle, color: KioskPalette.success, size: 40),
                const SizedBox(height: 12),
                const Text('PIN saved'),
                TextButton(onPressed: _reset, child: const Text('Change PIN')),
              ],
            ),
          ),
        if (widget.alreadySet && !_confirmed)
          const Padding(
            padding: EdgeInsets.only(top: 12),
            child: Text('A PIN is already set — enter a new one to replace it, or continue.',
                style: TextStyle(color: KioskPalette.inkFaint)),
          ),
      ],
    );
  }
}
