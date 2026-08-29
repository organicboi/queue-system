import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/admin_pin.dart';
import '../../state/providers.dart';
import '../theme.dart';
import 'pin_pad.dart';

/// Wraps every role screen. A 5-second press in the top-left 64×64 corner —
/// invisible, nothing to see, nothing a visitor stumbles into — opens a PIN
/// prompt; a correct PIN pushes [settingsBuilder]. Three wrong attempts locks
/// out for 30 seconds.
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

  void _startHold() {
    _holdTimer?.cancel();
    _holdTimer = Timer(const Duration(seconds: 5), _triggerGate);
  }

  void _cancelHold() {
    _holdTimer?.cancel();
    _holdTimer = null;
  }

  void _triggerGate() {
    if (!mounted) return;
    final cfg = ref.read(deviceConfigProvider).value;
    if (cfg == null || !cfg.hasPin) {
      _openSettings();
      return;
    }
    Navigator.of(context).push(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => _PinGateScreen(
          hash: cfg.adminPinHash!,
          salt: cfg.adminPinSalt!,
          length: cfg.adminPinLength,
          onSuccess: _openSettings,
        ),
      ),
    );
  }

  void _openSettings() {
    if (!mounted) return;
    Navigator.of(context).push(
      MaterialPageRoute(builder: widget.settingsBuilder),
    );
  }

  @override
  void dispose() {
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

class _PinGateScreen extends StatefulWidget {
  const _PinGateScreen({
    required this.hash,
    required this.salt,
    required this.length,
    required this.onSuccess,
  });

  final String hash;
  final String salt;
  final int length;
  final VoidCallback onSuccess;

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
      Navigator.of(context).pop();
      widget.onSuccess();
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
