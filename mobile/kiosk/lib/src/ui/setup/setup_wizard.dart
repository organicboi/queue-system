import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../api/api_exception.dart';
import '../../api/display_api.dart';
import '../../api/kiosk_api.dart';
import '../../config/app_config.dart';
import '../../config/device_config.dart';
import '../../config/device_role.dart';
import '../../config/provisioning_qr.dart';
import '../../printing/printer_settings.dart';
import '../../state/providers.dart';
import '../theme.dart';
import 'pin_step.dart';
import 'printer_setup_step.dart';
import 'qr_scan_screen.dart';

/// One-time device provisioning: server → role → pairing token → (kiosk
/// only) printer → admin PIN → review. Staff-only; a visitor never sees this
/// after the device is locked. Re-entered later only through [AdminGate].
class SetupWizard extends ConsumerStatefulWidget {
  const SetupWizard({super.key, this.startAtSettingsFor});

  /// When re-opened from AdminGate's settings screen rather than first-run
  /// setup, pass the existing config so every step starts pre-filled instead
  /// of forcing a full re-provision to change one field.
  final DeviceConfig? startAtSettingsFor;

  @override
  ConsumerState<SetupWizard> createState() => _SetupWizardState();
}

class _SetupWizardState extends ConsumerState<SetupWizard> {
  final _pageController = PageController();
  int _step = 0;

  late final TextEditingController _baseUrlController;
  late final TextEditingController _tokenController;
  late final TextEditingController _webUrlController;

  DeviceRole? _role;
  PrinterSettings _printer = const PrinterSettings();
  String? _pinHash;
  String? _pinSalt;
  int _pinLength = 4;

  bool _validating = false;
  String? _pairError;
  String? _resolvedName;

  @override
  void initState() {
    super.initState();
    final existing = widget.startAtSettingsFor;
    _baseUrlController = TextEditingController(text: existing?.baseUrl ?? AppConfig.defaultBaseUrl);
    _role = existing?.role;
    _tokenController = TextEditingController(
      text: existing?.role == DeviceRole.display ? existing?.screenToken : existing?.branchToken,
    );
    _webUrlController = TextEditingController(text: existing?.webUrl ?? '');
    _printer = existing?.printer ?? const PrinterSettings();
    _pinHash = existing?.adminPinHash;
    _pinSalt = existing?.adminPinSalt;
    _pinLength = existing?.adminPinLength ?? 4;
  }

  @override
  void dispose() {
    _pageController.dispose();
    _baseUrlController.dispose();
    _tokenController.dispose();
    _webUrlController.dispose();
    super.dispose();
  }

  List<_Step> get _steps => [
        _Step('Server', Icons.dns_outlined),
        _Step('Role', Icons.dashboard_customize_outlined),
        _Step('Pair', Icons.link_rounded),
        if (_role == DeviceRole.kiosk) _Step('Printer', Icons.print_outlined),
        _Step('PIN', Icons.pin_outlined),
        _Step('Review', Icons.check_circle_outline),
      ];

  bool get _canGoNext {
    switch (_steps[_step].label) {
      case 'Server':
        return _baseUrlController.text.trim().isNotEmpty;
      case 'Role':
        return _role != null;
      case 'Pair':
        return _role == DeviceRole.web
            ? _webUrlController.text.trim().isNotEmpty
            : _resolvedName != null;
      case 'Printer':
        return true; // skippable
      case 'PIN':
        return _pinHash != null;
      default:
        return true;
    }
  }

  Future<void> _validatePairing() async {
    setState(() {
      _validating = true;
      _pairError = null;
      _resolvedName = null;
    });
    final baseUrl = _baseUrlController.text.trim();
    final token = _tokenController.text.trim();
    try {
      if (_role == DeviceRole.kiosk) {
        final api = KioskApi(baseUrl: baseUrl, branchToken: token);
        final bootstrap = await api.bootstrap();
        setState(() => _resolvedName = bootstrap.branchName);
      } else if (_role == DeviceRole.display) {
        final api = DisplayApi(baseUrl: baseUrl, screenToken: token);
        final board = await api.fetchBoard();
        setState(() => _resolvedName = board.schoolNameEn);
      }
    } on ApiException catch (e) {
      setState(() => _pairError = e.message);
    } catch (e) {
      setState(() => _pairError = 'Could not reach the server.');
    } finally {
      setState(() => _validating = false);
    }
  }

  Future<void> _scanQr() async {
    final payload = await Navigator.of(context).push<ProvisioningPayload>(
      MaterialPageRoute(builder: (_) => const QrScanScreen(), fullscreenDialog: true),
    );
    if (payload == null) return;
    setState(() {
      _baseUrlController.text = payload.baseUrl;
      _role = payload.role;
      _tokenController.text = payload.token;
    });
    await _validatePairing();
  }

  void _next() {
    if (_step == _steps.indexWhere((s) => s.label == 'Pair') && _role != DeviceRole.web) {
      _validatePairing();
    }
    if (_step < _steps.length - 1) {
      setState(() => _step++);
      _pageController.animateToPage(_step,
          duration: const Duration(milliseconds: 260), curve: Curves.easeOut);
    } else {
      _lockDevice();
    }
  }

  void _back() {
    if (_step == 0) return;
    setState(() => _step--);
    _pageController.animateToPage(_step,
        duration: const Duration(milliseconds: 260), curve: Curves.easeOut);
  }

  Future<void> _lockDevice() async {
    final existing = widget.startAtSettingsFor;
    final config = DeviceConfig(
      baseUrl: _baseUrlController.text.trim(),
      role: _role,
      setupComplete: true,
      branchToken: _role == DeviceRole.kiosk ? _tokenController.text.trim() : (existing?.branchToken ?? ''),
      screenToken: _role == DeviceRole.display ? _tokenController.text.trim() : (existing?.screenToken ?? ''),
      webUrl: _role == DeviceRole.web ? _webUrlController.text.trim() : (existing?.webUrl ?? ''),
      adminPinHash: _pinHash,
      adminPinSalt: _pinSalt,
      adminPinLength: _pinLength,
      printer: _printer,
    );
    await ref.read(deviceConfigProvider.notifier).save(config);
    if (mounted) Navigator.of(context).popUntil((r) => r.isFirst);
  }

  @override
  Widget build(BuildContext context) {
    final steps = _steps;
    return Scaffold(
      backgroundColor: KioskPalette.bg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(28, 20, 28, 8),
              child: Row(
                children: [
                  for (var i = 0; i < steps.length; i++) ...[
                    _StepDot(step: steps[i], active: i == _step, done: i < _step),
                    if (i != steps.length - 1)
                      Expanded(
                        child: Container(
                          height: 2,
                          color: i < _step ? KioskPalette.primary : KioskPalette.border,
                        ),
                      ),
                  ],
                ],
              ),
            ),
            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  _pad(_ServerStep(controller: _baseUrlController, onChanged: () => setState(() {}))),
                  _pad(_RoleStep(value: _role, onChanged: (r) => setState(() {
                    _role = r;
                    _resolvedName = null;
                  }))),
                  _pad(_PairStep(
                    role: _role,
                    tokenController: _tokenController,
                    webUrlController: _webUrlController,
                    validating: _validating,
                    error: _pairError,
                    resolvedName: _resolvedName,
                    onScanQr: _scanQr,
                    onValidate: _validatePairing,
                    onChanged: () => setState(() => _resolvedName = null),
                  )),
                  if (_role == DeviceRole.kiosk)
                    _pad(PrinterSetupStep(
                      value: _printer,
                      onChanged: (p) => setState(() => _printer = p),
                    )),
                  _pad(PinSetupStep(
                    length: _pinLength,
                    onLengthChanged: (l) => setState(() => _pinLength = l),
                    onPinCreated: (hash, salt) => setState(() {
                      _pinHash = hash;
                      _pinSalt = salt;
                    }),
                    alreadySet: _pinHash != null,
                  )),
                  _pad(_ReviewStep(
                    baseUrl: _baseUrlController.text,
                    role: _role,
                    token: _tokenController.text,
                    webUrl: _webUrlController.text,
                    printer: _printer,
                  )),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(28, 8, 28, 24),
              child: Row(
                children: [
                  if (_step > 0)
                    OutlinedButton(onPressed: _back, child: const Text('Back'))
                  else
                    const SizedBox.shrink(),
                  const Spacer(),
                  FilledButton(
                    onPressed: _canGoNext ? _next : null,
                    child: Text(_step == steps.length - 1 ? 'Lock this device' : 'Next'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _pad(Widget child) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: child,
      );
}

class _Step {
  const _Step(this.label, this.icon);
  final String label;
  final IconData icon;
}

class _StepDot extends StatelessWidget {
  const _StepDot({required this.step, required this.active, required this.done});
  final _Step step;
  final bool active;
  final bool done;

  @override
  Widget build(BuildContext context) {
    final color = active || done ? KioskPalette.primary : KioskPalette.inkFaint;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircleAvatar(
          radius: 16,
          backgroundColor: active ? KioskPalette.primary : (done ? KioskPalette.primarySoft : KioskPalette.surfaceMuted),
          child: Icon(done ? Icons.check : step.icon,
              size: 16, color: active ? Colors.white : color),
        ),
      ],
    );
  }
}

class _ServerStep extends StatelessWidget {
  const _ServerStep({required this.controller, required this.onChanged});
  final TextEditingController controller;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const SizedBox(height: 8),
        Text('Server', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 6),
        const Text('The VibeQueue deployment this device talks to.',
            style: TextStyle(color: KioskPalette.inkSoft)),
        const SizedBox(height: 24),
        TextField(
          controller: controller,
          decoration: const InputDecoration(labelText: 'Server URL'),
          keyboardType: TextInputType.url,
          autocorrect: false,
          onChanged: (_) => onChanged(),
        ),
      ],
    );
  }
}

class _RoleStep extends StatelessWidget {
  const _RoleStep({required this.value, required this.onChanged});
  final DeviceRole? value;
  final ValueChanged<DeviceRole> onChanged;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const SizedBox(height: 8),
        Text('What is this screen?', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 6),
        const Text('This choice is locked once the device is set up.',
            style: TextStyle(color: KioskPalette.inkSoft)),
        const SizedBox(height: 20),
        for (final role in DeviceRole.values)
          _RoleCard(role: role, selected: value == role, onTap: () => onChanged(role)),
      ],
    );
  }
}

class _RoleCard extends StatelessWidget {
  const _RoleCard({required this.role, required this.selected, required this.onTap});
  final DeviceRole role;
  final bool selected;
  final VoidCallback onTap;

  IconData get _icon => switch (role) {
        DeviceRole.kiosk => Icons.confirmation_number_outlined,
        DeviceRole.display => Icons.tv_outlined,
        DeviceRole.web => Icons.public_outlined,
      };

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: selected ? KioskPalette.primarySoft : KioskPalette.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: selected ? KioskPalette.primary : KioskPalette.border),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: selected ? KioskPalette.primary : KioskPalette.surfaceMuted,
                child: Icon(_icon, color: selected ? Colors.white : KioskPalette.inkSoft),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(role.label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    const SizedBox(height: 2),
                    Text(role.description, style: const TextStyle(color: KioskPalette.inkSoft)),
                  ],
                ),
              ),
              if (selected) const Icon(Icons.check_circle, color: KioskPalette.primary),
            ],
          ),
        ),
      ),
    );
  }
}

class _PairStep extends StatelessWidget {
  const _PairStep({
    required this.role,
    required this.tokenController,
    required this.webUrlController,
    required this.validating,
    required this.error,
    required this.resolvedName,
    required this.onScanQr,
    required this.onValidate,
    required this.onChanged,
  });

  final DeviceRole? role;
  final TextEditingController tokenController;
  final TextEditingController webUrlController;
  final bool validating;
  final String? error;
  final String? resolvedName;
  final VoidCallback onScanQr;
  final VoidCallback onValidate;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    if (role == DeviceRole.web) {
      return ListView(
        children: [
          const SizedBox(height: 8),
          Text('Page to display', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 20),
          TextField(
            controller: webUrlController,
            decoration: const InputDecoration(labelText: 'Web page URL'),
            keyboardType: TextInputType.url,
            onChanged: (_) => onChanged(),
          ),
        ],
      );
    }

    final label = role == DeviceRole.display ? 'Screen token' : 'Kiosk token';
    return ListView(
      children: [
        const SizedBox(height: 8),
        Text('Pair this device', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 6),
        Text('Enter the $label shown on the school dashboard, or scan its QR code.',
            style: const TextStyle(color: KioskPalette.inkSoft)),
        const SizedBox(height: 20),
        TextField(
          controller: tokenController,
          decoration: InputDecoration(labelText: label),
          autocorrect: false,
          enableSuggestions: false,
          onChanged: (_) => onChanged(),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: onScanQr,
          icon: const Icon(Icons.qr_code_scanner),
          label: const Text('Scan QR code'),
        ),
        const SizedBox(height: 12),
        TextButton(
          onPressed: validating ? null : onValidate,
          child: validating
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Check token'),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(error!, style: const TextStyle(color: KioskPalette.danger)),
          ),
        if (resolvedName != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(
              children: [
                const Icon(Icons.check_circle, color: KioskPalette.success, size: 18),
                const SizedBox(width: 8),
                Expanded(child: Text('Paired with: $resolvedName')),
              ],
            ),
          ),
      ],
    );
  }
}

class _ReviewStep extends StatelessWidget {
  const _ReviewStep({
    required this.baseUrl,
    required this.role,
    required this.token,
    required this.webUrl,
    required this.printer,
  });

  final String baseUrl;
  final DeviceRole? role;
  final String token;
  final String webUrl;
  final PrinterSettings printer;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const SizedBox(height: 8),
        Text('Review', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 20),
        _row('Server', baseUrl),
        _row('Role', role?.label ?? '—'),
        if (role == DeviceRole.web) _row('Page', webUrl) else _row('Token', token),
        if (role == DeviceRole.kiosk)
          _row('Printer', printer.isConfigured ? '${printer.transport.label} · ${printer.paper.label}' : 'Not configured'),
        const SizedBox(height: 20),
        const Text(
          'Locking this device hides setup behind a hidden gesture and PIN. '
          'You can always come back in.',
          style: TextStyle(color: KioskPalette.inkSoft),
        ),
      ],
    );
  }

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            SizedBox(width: 90, child: Text(label, style: const TextStyle(color: KioskPalette.inkSoft))),
            Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w600))),
          ],
        ),
      );
}
