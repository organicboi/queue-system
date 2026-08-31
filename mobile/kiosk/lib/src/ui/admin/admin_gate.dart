import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/admin_pin.dart';
import '../../state/providers.dart';
import '../theme.dart';
import 'pin_pad.dart';

/// The remote-control equivalent of the hidden corner press: a TV has no
/// touchscreen, so a display device on a television could never reach settings
/// at all. Pressing this D-pad sequence on the remote — up, up, down, down,
/// then OK — opens the same PIN prompt. Deliberately a sequence rather than a
/// long OK-hold: a hold is remapped to a context menu by some TV launchers and
/// is easy to trigger by leaving the remote face-down on a button; this
/// sequence works on every remote and is almost impossible to hit by accident.
const _kRemoteUnlockSequence = <LogicalKeyboardKey>[
  LogicalKeyboardKey.arrowUp,
  LogicalKeyboardKey.arrowUp,
  LogicalKeyboardKey.arrowDown,
  LogicalKeyboardKey.arrowDown,
];

/// Keys that count as "OK" — the confirm button at the end of the sequence.
/// Android TV D-pad centre is [LogicalKeyboardKey.select]; bare Bluetooth
/// keyboards and some remotes send [LogicalKeyboardKey.enter] instead.
// Not `const`: LogicalKeyboardKey overrides `==`, which a const Set forbids.
final _kRemoteConfirmKeys = <LogicalKeyboardKey>{
  LogicalKeyboardKey.select,
  LogicalKeyboardKey.enter,
  LogicalKeyboardKey.numpadEnter,
  LogicalKeyboardKey.gameButtonA,
};

/// A press more than this far apart from the previous one restarts the match —
/// a real operator taps the sequence briskly; stray navigation presses minutes
/// apart must never accumulate into an unlock.
const _kRemoteSequenceGap = Duration(seconds: 3);

/// Wraps every role screen. A 5-second press in the top-left 64×64 corner —
/// invisible, nothing to see, nothing a visitor stumbles into — opens a PIN
/// prompt; a correct PIN pushes [settingsBuilder]. Three wrong attempts locks
/// out for 30 seconds. On a remote-driven TV the same prompt is reached with
/// the [_kRemoteUnlockSequence] D-pad sequence instead.
///
/// A device with no PIN set yet (shouldn't happen once the wizard is
/// finished, but covers a device mid-setup or restored from an old backup)
/// falls straight through to settings — an admin who wiped their own PIN must
/// still be able to get back in.
class AdminGate extends ConsumerStatefulWidget {
  const AdminGate({
    super.key,
    required this.child,
    required this.settingsBuilder,
  });

  final Widget child;
  final WidgetBuilder settingsBuilder;

  @override
  ConsumerState<AdminGate> createState() => _AdminGateState();
}

class _AdminGateState extends ConsumerState<AdminGate> {
  Timer? _holdTimer;

  /// How many keys of [_kRemoteUnlockSequence] have matched so far, and when
  /// the last matching key arrived (to enforce [_kRemoteSequenceGap]).
  int _seqIndex = 0;
  DateTime? _lastSeqKey;

  /// True while the PIN prompt (or settings) is already on screen, so a second
  /// trigger can't stack another route on top.
  bool _gateOpen = false;

  @override
  void initState() {
    super.initState();
    HardwareKeyboard.instance.addHandler(_handleKey);
  }

  bool _handleKey(KeyEvent event) {
    if (event is! KeyDownEvent || _gateOpen) return false;

    final now = DateTime.now();
    final last = _lastSeqKey;
    if (last != null && now.difference(last) > _kRemoteSequenceGap) {
      _seqIndex = 0;
    }

    if (_seqIndex < _kRemoteUnlockSequence.length) {
      if (event.logicalKey == _kRemoteUnlockSequence[_seqIndex]) {
        _seqIndex++;
        _lastSeqKey = now;
      } else {
        // Restart, but let this key still seed the sequence if it's the first
        // key (rapid up-up-up-down-down shouldn't be defeated by the extra up).
        _seqIndex = event.logicalKey == _kRemoteUnlockSequence.first ? 1 : 0;
        _lastSeqKey = _seqIndex == 1 ? now : null;
      }
      return false;
    }

    // Full arrow prefix matched — waiting on the confirm key.
    if (_kRemoteConfirmKeys.contains(event.logicalKey)) {
      _seqIndex = 0;
      _lastSeqKey = null;
      _triggerGate();
    } else {
      _seqIndex = 0;
      _lastSeqKey = null;
    }
    return false;
  }

  void _startHold() {
    _holdTimer?.cancel();
    _holdTimer = Timer(const Duration(seconds: 5), _triggerGate);
  }

  void _cancelHold() {
    _holdTimer?.cancel();
    _holdTimer = null;
  }

  Future<void> _triggerGate() async {
    if (!mounted || _gateOpen) return;
    final cfg = ref.read(deviceConfigProvider).value;
    _gateOpen = true;
    try {
      if (cfg != null && cfg.hasPin) {
        final ok = await Navigator.of(context).push<bool>(
          MaterialPageRoute(
            fullscreenDialog: true,
            builder: (_) => _PinGateScreen(
              hash: cfg.adminPinHash!,
              salt: cfg.adminPinSalt!,
              length: cfg.adminPinLength,
            ),
          ),
        );
        if (ok != true || !mounted) return;
      }
      // No PIN set (device mid-setup or PIN wiped), or the PIN verified.
      await Navigator.of(context).push(
        MaterialPageRoute(builder: widget.settingsBuilder),
      );
    } finally {
      _gateOpen = false;
    }
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_handleKey);
    _holdTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child,
        Positioned(
          left: 0,
          top: 0,
          width: 64,
          height: 64,
          child: Listener(
            behavior: HitTestBehavior.translucent,
            onPointerDown: (_) => _startHold(),
            onPointerUp: (_) => _cancelHold(),
            onPointerCancel: (_) => _cancelHold(),
          ),
        ),
      ],
    );
  }
}

/// Pops `true` when the PIN verifies, `null` (or `false`) otherwise. The caller
/// ([_AdminGateState._triggerGate]) pushes settings on `true`.
class _PinGateScreen extends StatefulWidget {
  const _PinGateScreen({
    required this.hash,
    required this.salt,
    required this.length,
  });

  final String hash;
  final String salt;
  final int length;

  @override
  State<_PinGateScreen> createState() => _PinGateScreenState();
}

class _PinGateScreenState extends State<_PinGateScreen> {
  int _attempts = 0;
  DateTime? _lockedUntil;
  String? _error;

  void _check(String pin) {
    final lockedUntil = _lockedUntil;
    if (lockedUntil != null && DateTime.now().isBefore(lockedUntil)) return;

    if (AdminPin.verify(pin, widget.salt, widget.hash)) {
      Navigator.of(context).pop(true);
      return;
    }

    _attempts++;
    if (_attempts >= 3) {
      setState(() {
        _lockedUntil = DateTime.now().add(const Duration(seconds: 30));
        _error = 'Too many attempts. Try again in 30 seconds.';
        _attempts = 0;
      });
      Timer(const Duration(seconds: 30), () {
        if (mounted) setState(() { _lockedUntil = null; _error = null; });
      });
    } else {
      setState(() => _error = 'Incorrect PIN');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KioskPalette.bg,
      body: SafeArea(
        child: Stack(
          children: [
            Positioned(
              top: 8,
              left: 8,
              child: IconButton(
                icon: const Icon(Icons.close, color: KioskPalette.inkSoft),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
            Center(
              child: PinPad(
                length: widget.length,
                title: 'Device settings',
                subtitle: 'Enter the admin PIN',
                errorText: _error,
                onSubmit: _check,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
