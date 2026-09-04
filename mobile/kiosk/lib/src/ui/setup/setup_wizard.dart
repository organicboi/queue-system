import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../api/api_exception.dart';
import '../../api/app_api.dart';
import '../../config/app_config.dart';
import '../../config/device_config.dart';
import '../../config/device_role.dart';
import '../../config/device_vertical.dart';
import '../../printing/printer_settings.dart';
import '../../state/app_auth_providers.dart';
import '../../state/providers.dart';
import '../theme.dart';
import 'facility_step.dart';
import 'login_step.dart';
import 'pin_step.dart';
import 'printer_setup_step.dart';

/// One-time device provisioning: server → sign in → role → facility → (kiosk
/// only) printer → admin PIN → review. Staff-only; a visitor never sees this
/// after the device is locked. Re-entered later only through [AdminGate], which
/// now opens the dedicated Settings screen — this wizard is first-run and full
/// re-provision only.
class SetupWizard extends ConsumerStatefulWidget {
  const SetupWizard({super.key});

  @override
  ConsumerState<SetupWizard> createState() => _SetupWizardState();
}

class _SetupWizardState extends ConsumerState<SetupWizard> {
  final _pageController = PageController();
  int _step = 0;

  final _baseUrlController = TextEditingController(text: AppConfig.defaultBaseUrl);
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _webUrlController = TextEditingController();

  AppLoginResult? _login;
  AppBranch? _branch;
  AppScreen? _screen;

  DeviceRole? _role;
  PrinterSettings _printer = const PrinterSettings();
  String? _pinHash;
  String? _pinSalt;
  int _pinLength = 4;

  bool _loggingIn = false;
  String? _loginError;

  DeviceVertical get _vertical =>
      _login?.profile.vertical ?? DeviceVertical.business;

  @override
  void dispose() {
    _pageController.dispose();
    _baseUrlController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _webUrlController.dispose();
    super.dispose();
  }

  List<_Step> get _steps => [
        _Step('Server', Icons.dns_outlined),
        _Step('Sign in', Icons.login_rounded),
        _Step('Role', Icons.dashboard_customize_outlined),
        _Step('Facility', Icons.place_outlined),
        if (_role == DeviceRole.kiosk) _Step('Printer', Icons.print_outlined),
        _Step('PIN', Icons.pin_outlined),
        _Step('Review', Icons.check_circle_outline),
      ];

  bool get _canGoNext {
    switch (_steps[_step].label) {
      case 'Server':
        return _baseUrlController.text.trim().isNotEmpty;
      case 'Sign in':
        return _login != null;
      case 'Role':
        return _role != null;
      case 'Facility':
        if (_role == DeviceRole.web) {
          return _webUrlController.text.trim().isNotEmpty;
        }
        if (_role == DeviceRole.display) {
          return _branch != null && _screen != null;
        }
        return _branch != null;
      case 'Printer':
        return true; // skippable
      case 'PIN':
        return _pinHash != null;
      default:
        return true;
    }
  }

  Future<void> _doLogin() async {
    setState(() {
      _loggingIn = true;
      _loginError = null;
    });
    // A transient client on the URL typed one step ago — the saved
    // DeviceConfig.baseUrl (which appApiProvider reads) isn't updated until the
    // device is locked.
    final api = ref.read(appApiFactoryProvider)(_baseUrlController.text.trim());
    try {
      final result = await api.login(
        email: _emailController.text,
        password: _passwordController.text,
      );
      setState(() {
        _login = result;
        // Re-login may point at a different tenant — drop stale picks.
        _branch = null;
        _screen = null;
        _loggingIn = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _loginError = e.message;
        _loggingIn = false;
      });
    } catch (_) {
      setState(() {
        _loginError = 'Could not reach the server.';
        _loggingIn = false;
      });
    }
  }

  void _next() {
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
    final login = _login;
    if (login == null) return;
    final config = DeviceConfig(
      baseUrl: _baseUrlController.text.trim(),
      role: _role,
      vertical: login.profile.vertical,
      setupComplete: true,
      branchToken: _role == DeviceRole.kiosk ? (_branch?.branchToken ?? '') : '',
      branchId: _role == DeviceRole.web ? '' : (_branch?.id ?? ''),
      screenToken: _role == DeviceRole.display ? (_screen?.screenToken ?? '') : '',
      webUrl: _role == DeviceRole.web ? _webUrlController.text.trim() : '',
      adminPinHash: _pinHash,
      adminPinSalt: _pinSalt,
      adminPinLength: _pinLength,
      printer: _printer,
    );
    await ref.read(deviceConfigProvider.notifier).save(config);
    await ref.read(authSessionProvider.notifier).signIn(login);
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
                  _pad(_ServerStep(
                      controller: _baseUrlController,
                      onChanged: () => setState(() {}))),
                  _pad(LoginStep(
                    emailController: _emailController,
                    passwordController: _passwordController,
                    busy: _loggingIn,
                    error: _loginError,
                    signedInAs: _login == null
                        ? null
                        : '${_login!.profile.email} · ${_login!.profile.customerName}',
                    onSubmit: _doLogin,
                  )),
                  _pad(_RoleStep(
                      value: _role,
                      onChanged: (r) => setState(() {
                            if (r != _role) {
                              _branch = null;
                              _screen = null;
                            }
                            _role = r;
                          }))),
                  _pad(FacilityStep(
                    role: _role,
                    login: _login,
                    branch: _branch,
                    screen: _screen,
                    webUrlController: _webUrlController,
                    onBranch: (b) => setState(() {
                      _branch = b;
                      _screen = null;
                    }),
                    onScreen: (s) => setState(() => _screen = s),
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
                    vertical: _vertical,
                    facility: _role == DeviceRole.web
                        ? _webUrlController.text
                        : _role == DeviceRole.display
                            ? '${_branch?.name ?? '—'} · ${_screen?.name ?? '—'}'
                            : (_branch?.name ?? '—'),
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
                    child: Text(
                        _step == steps.length - 1 ? 'Lock this device' : 'Next'),
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
          backgroundColor: active
              ? KioskPalette.primary
              : (done ? KioskPalette.primarySoft : KioskPalette.surfaceMuted),
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
        Text('What is this screen?',
            style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 6),
        const Text('This choice is locked once the device is set up.',
            style: TextStyle(color: KioskPalette.inkSoft)),
        const SizedBox(height: 20),
        for (final role in DeviceRole.values)
          _RoleCard(
              role: role,
              selected: value == role,
              onTap: () => onChanged(role)),
      ],
    );
  }
}

class _RoleCard extends StatelessWidget {
  const _RoleCard(
      {required this.role, required this.selected, required this.onTap});
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
        side: BorderSide(
            color: selected ? KioskPalette.primary : KioskPalette.border),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: selected
                    ? KioskPalette.primary
                    : KioskPalette.surfaceMuted,
                child: Icon(_icon,
                    color: selected ? Colors.white : KioskPalette.inkSoft),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(role.label,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 16)),
                    const SizedBox(height: 2),
                    Text(role.description,
                        style: const TextStyle(color: KioskPalette.inkSoft)),
                  ],
                ),
              ),
              if (selected)
                const Icon(Icons.check_circle, color: KioskPalette.primary),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReviewStep extends StatelessWidget {
  const _ReviewStep({
    required this.baseUrl,
    required this.role,
    required this.vertical,
    required this.facility,
    required this.printer,
  });

  final String baseUrl;
  final DeviceRole? role;
  final DeviceVertical vertical;
  final String facility;
  final PrinterSettings printer;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const SizedBox(height: 8),
        Text('Review', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 20),
        _row('Server', baseUrl),
        _row('Product', vertical.label),
        _row('Role', role?.label ?? '—'),
        _row(role == DeviceRole.web ? 'Page' : 'Facility', facility),
        if (role == DeviceRole.kiosk)
          _row(
              'Printer',
              printer.isConfigured
                  ? '${printer.transport.label} · ${printer.paper.label}'
                  : 'Not configured'),
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
            SizedBox(
                width: 90,
                child: Text(label,
                    style: const TextStyle(color: KioskPalette.inkSoft))),
            Expanded(
                child: Text(value,
                    style: const TextStyle(fontWeight: FontWeight.w600))),
          ],
        ),
      );
}
