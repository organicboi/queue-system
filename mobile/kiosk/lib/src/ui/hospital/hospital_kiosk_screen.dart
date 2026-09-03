import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../api/api_exception.dart';
import '../../config/app_config.dart';
import '../../i18n/hospital_copy.dart';
import '../../models/hospital/hospital_department.dart';
import '../../models/hospital/hospital_doctor.dart';
import '../../models/hospital/hospital_kiosk_bootstrap.dart';
import '../../models/hospital/hospital_token.dart';
import '../../state/hospital_providers.dart';
import '../../state/providers.dart';
import '../dept_icon.dart';
import '../theme.dart';

/// The hospital registration kiosk. Ported from
/// components/hospital/HospitalKiosk.tsx: language picker → department grid →
/// (OPD) doctor list → priority category → confirm → token hero with a public
/// tracking QR, then an auto-reset back to the grid for the next patient.
///
/// Simpler than the school kiosk on purpose — no recent-tickets rail and no
/// amend actions, matching the web.
class HospitalKioskScreen extends ConsumerStatefulWidget {
  const HospitalKioskScreen({super.key});

  @override
  ConsumerState<HospitalKioskScreen> createState() => _HospitalKioskScreenState();
}

class _Hero {
  const _Hero({
    required this.token,
    required this.department,
    required this.doctor,
    required this.waitingAhead,
    required this.publicUrl,
  });
  final HospitalToken token;
  final HospitalDepartment department;
  final HospitalDoctor? doctor;
  final int? waitingAhead;
  final String? publicUrl;
}

class _HospitalKioskScreenState extends ConsumerState<HospitalKioskScreen> {
  String _lang = 'en';
  bool _langInitialised = false;

  HospitalDepartment? _dept;
  HospitalDoctor? _doctor;
  String? _priority;
  _Hero? _hero;
  bool _issuing = false;
  String? _error;

  Timer? _resetTimer;
  Timer? _bootRetryTimer;

  @override
  void initState() {
    super.initState();
    WakelockPlus.enable();
  }

  @override
  void dispose() {
    WakelockPlus.disable();
    _resetTimer?.cancel();
    _bootRetryTimer?.cancel();
    super.dispose();
  }

  void _armBootRetry() {
    _bootRetryTimer ??= Timer.periodic(AppConfig.retryInterval, (_) {
      if (mounted) ref.invalidate(hospitalBootstrapProvider);
    });
  }

  void _cancelBootRetry() {
    _bootRetryTimer?.cancel();
    _bootRetryTimer = null;
  }

  void _resetToGrid() {
    _resetTimer?.cancel();
    if (!mounted) return;
    setState(() {
      _hero = null;
      _dept = null;
      _doctor = null;
      _priority = null;
      _error = null;
    });
  }

  Future<void> _issue(
    HospitalKioskBootstrap bootstrap,
    HospitalDepartment dept,
    HospitalDoctor? doctor,
  ) async {
    if (_issuing) return;
    setState(() {
      _issuing = true;
      _error = null;
    });
    final c = HospitalCopy.of(_lang);
    try {
      final issued = await ref.read(hospitalKioskControllerProvider).issue(
            department: dept,
            doctor: doctor,
            priorityCategory: _priority,
            lang: _lang,
          );
      if (!mounted) return;
      final token = issued.token;
      final publicUrl = bootstrap.publicTrackingEnabled &&
              token.publicCode.isNotEmpty &&
              bootstrap.publicBaseUrl.isNotEmpty
          ? '${bootstrap.publicBaseUrl}/t/${token.publicCode}'
          : null;
      setState(() {
        _hero = _Hero(
          token: token,
          department: dept,
          doctor: doctor,
          waitingAhead: issued.waitingAhead,
          publicUrl: publicUrl,
        );
        _issuing = false;
      });
      final idle = bootstrap.settings?.kioskIdleSeconds ?? 20;
      _resetTimer?.cancel();
      _resetTimer = Timer(Duration(seconds: idle), _resetToGrid);
    } on ApiException catch (e) {
      if (e.isUnregistered) {
        await ref.read(deviceConfigProvider.notifier).reset();
        return;
      }
      if (mounted) {
        setState(() {
          _issuing = false;
          _error = e.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _issuing = false;
          _error = c.tryReception;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(hospitalBootstrapProvider);
    return Directionality(
      textDirection: HospitalCopy.directionOf(_lang),
      child: Scaffold(
        backgroundColor: const Color(0xFFF1F5F9),
        body: SafeArea(
          child: async.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) {
              _armBootRetry();
              return _BootError(
                error: e,
                onRetry: () => ref.invalidate(hospitalBootstrapProvider),
                onReset: () => ref.read(deviceConfigProvider.notifier).reset(),
              );
            },
            data: (bootstrap) {
              _cancelBootRetry();
              if (!_langInitialised) {
                _langInitialised = true;
                _lang = bootstrap.languages.first;
              }
              return _Shell(
                bootstrap: bootstrap,
                lang: _lang,
                onLang: (l) => setState(() => _lang = l),
                showLangPicker: _hero == null,
                child: _body(bootstrap),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _body(HospitalKioskBootstrap bootstrap) {
    final c = HospitalCopy.of(_lang);
    final feed = ref.watch(hospitalFeedProvider).value;

    if (_hero != null) {
      return _HeroView(hero: _hero!, lang: _lang, copy: c);
    }

    if (bootstrap.departments.isEmpty) {
      return _CenterMessage(icon: Icons.dns_outlined, text: c.noServices);
    }

    final dept = _dept;
    if (dept == null) {
      return _Grid(
        departments: bootstrap.departments,
        lang: _lang,
        waitingFor: (id) => feed?.waitingFor(id) ?? 0,
        disabled: _issuing,
        onTap: (d) {
          setState(() {
            _dept = d;
            _doctor = null;
            _error = null;
          });
          if (!d.isOpd) _issue(bootstrap, d, null);
        },
        copy: c,
      );
    }

    if (dept.isOpd && _doctor == null) {
      return _DoctorStep(
        dept: dept,
        doctors: bootstrap.doctorsFor(dept.id),
        lang: _lang,
        disabled: _issuing,
        copy: c,
        onBack: () => setState(() {
          _dept = null;
          _error = null;
        }),
        onPick: (d) => setState(() => _doctor = d),
      );
    }

    return _ConfirmStep(
      dept: dept,
      doctor: _doctor,
      lang: _lang,
      priorityEnabled: bootstrap.settings?.priorityEnabled ?? true,
      priority: _priority,
      issuing: _issuing,
      error: _error,
      copy: c,
      onBack: () => setState(() {
        if (dept.isOpd) {
          _doctor = null;
        } else {
          _dept = null;
        }
        _error = null;
      }),
      onPriority: (key) =>
          setState(() => _priority = _priority == key ? null : key),
      onConfirm: () => _issue(bootstrap, dept, _doctor),
    );
  }
}

// ── Shell (header + language picker) ─────────────────────────
class _Shell extends StatelessWidget {
  const _Shell({
    required this.bootstrap,
    required this.lang,
    required this.onLang,
    required this.showLangPicker,
    required this.child,
  });

  final HospitalKioskBootstrap bootstrap;
  final String lang;
  final ValueChanged<String> onLang;
  final bool showLangPicker;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final langs = bootstrap.languages;
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: KioskPalette.primary,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.local_hospital_rounded,
                    color: Colors.white, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  bootstrap.hospitalName(lang),
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w700),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (showLangPicker && langs.length > 1)
                Wrap(
                  spacing: 6,
                  children: [
                    for (final l in langs)
                      GestureDetector(
                        onTap: () => onLang(l),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 7),
                          decoration: BoxDecoration(
                            color: l == lang
                                ? KioskPalette.primary
                                : Colors.white,
                            borderRadius: BorderRadius.circular(9),
                            border: Border.all(
                                color: l == lang
                                    ? KioskPalette.primary
                                    : const Color(0xFFE2E8F0)),
                          ),
                          child: Text(
                            _langLabel(l),
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color:
                                  l == lang ? Colors.white : const Color(0xFF475569),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
            ],
          ),
        ),
        Expanded(child: child),
      ],
    );
  }
}

String _langLabel(String l) => switch (l) {
      'en' => 'EN',
      'hi' => 'हिं',
      'mr' => 'मरा',
      'ar' => 'ع',
      _ => l.toUpperCase(),
    };

// ── Grid ─────────────────────────────────────────────────────
class _Grid extends StatelessWidget {
  const _Grid({
    required this.departments,
    required this.lang,
    required this.waitingFor,
    required this.disabled,
    required this.onTap,
    required this.copy,
  });

  final List<HospitalDepartment> departments;
  final String lang;
  final int Function(String id) waitingFor;
  final bool disabled;
  final ValueChanged<HospitalDepartment> onTap;
  final HospitalCopy copy;

  @override
  Widget build(BuildContext context) {
    final sorted = [...departments]
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(copy.pick,
              style:
                  const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          Expanded(
            child: LayoutBuilder(builder: (context, box) {
              final cols = box.maxWidth >= 1100
                  ? 4
                  : box.maxWidth >= 760
                      ? 3
                      : 2;
              return GridView.count(
                crossAxisCount: cols,
                mainAxisSpacing: 14,
                crossAxisSpacing: 14,
                childAspectRatio: 1.25,
                children: [
                  for (final d in sorted)
                    _DeptCard(
                      dept: d,
                      lang: lang,
                      waiting: waitingFor(d.id),
                      disabled: disabled,
                      onTap: () => onTap(d),
                    ),
                ],
              );
            }),
          ),
        ],
      ),
    );
  }
}

class _DeptCard extends StatelessWidget {
  const _DeptCard({
    required this.dept,
    required this.lang,
    required this.waiting,
    required this.disabled,
    required this.onTap,
  });

  final HospitalDepartment dept;
  final String lang;
  final int waiting;
  final bool disabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = departmentColor(dept.color);
    return Opacity(
      opacity: disabled ? 0.5 : 1,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: disabled ? null : onTap,
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border(top: BorderSide(color: color, width: 6)),
              boxShadow: const [
                BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 3)),
              ],
            ),
            padding: const EdgeInsets.all(12),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(departmentIcon(dept.icon),
                      color: Colors.white, size: 24),
                ),
                const SizedBox(height: 8),
                Text(
                  dept.nameFor(lang),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w600, height: 1.15),
                ),
                const SizedBox(height: 4),
                Text(
                  '$waiting waiting',
                  style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFF94A3B8),
                      fontFeatures: [FontFeature.tabularFigures()]),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Doctor step ──────────────────────────────────────────────
class _DoctorStep extends StatelessWidget {
  const _DoctorStep({
    required this.dept,
    required this.doctors,
    required this.lang,
    required this.disabled,
    required this.copy,
    required this.onBack,
    required this.onPick,
  });

  final HospitalDepartment dept;
  final List<HospitalDoctor> doctors;
  final String lang;
  final bool disabled;
  final HospitalCopy copy;
  final VoidCallback onBack;
  final ValueChanged<HospitalDoctor> onPick;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _BackButton(label: copy.back, onTap: onBack),
          const SizedBox(height: 8),
          Text(copy.pickDoctor,
              style:
                  const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(dept.nameFor(lang),
              style: const TextStyle(color: Color(0xFF64748B))),
          const SizedBox(height: 16),
          if (doctors.isEmpty)
            _CenterMessage(icon: Icons.event_busy_rounded, text: copy.notSetUp)
          else
            for (final d in doctors) ...[
              _DoctorCard(
                  doctor: d, copy: copy, disabled: disabled, onTap: () => onPick(d)),
              const SizedBox(height: 8),
            ],
        ],
      ),
    );
  }
}

class _DoctorCard extends StatelessWidget {
  const _DoctorCard({
    required this.doctor,
    required this.copy,
    required this.disabled,
    required this.onTap,
  });

  final HospitalDoctor doctor;
  final HospitalCopy copy;
  final bool disabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: disabled ? 0.5 : 1,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: disabled ? null : onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: KioskPalette.primarySoft,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.medical_services_rounded,
                      color: KioskPalette.primary, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(doctor.name,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 15),
                          overflow: TextOverflow.ellipsis),
                      if (doctor.specialization.isNotEmpty)
                        Text(doctor.specialization,
                            style: const TextStyle(
                                fontSize: 12, color: Color(0xFF64748B)),
                            overflow: TextOverflow.ellipsis),
                    ],
                  ),
                ),
                if (doctor.feeRupees != null)
                  Directionality(
                    textDirection: TextDirection.ltr,
                    child: Text('${copy.fee} ₹${doctor.feeRupees}',
                        style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF475569))),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Confirm step ─────────────────────────────────────────────
class _ConfirmStep extends StatelessWidget {
  const _ConfirmStep({
    required this.dept,
    required this.doctor,
    required this.lang,
    required this.priorityEnabled,
    required this.priority,
    required this.issuing,
    required this.error,
    required this.copy,
    required this.onBack,
    required this.onPriority,
    required this.onConfirm,
  });

  final HospitalDepartment dept;
  final HospitalDoctor? doctor;
  final String lang;
  final bool priorityEnabled;
  final String? priority;
  final bool issuing;
  final String? error;
  final HospitalCopy copy;
  final VoidCallback onBack;
  final ValueChanged<String> onPriority;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _BackButton(label: copy.back, onTap: onBack),
          const SizedBox(height: 8),
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                children: [
                  _card(Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(dept.nameFor(lang),
                          style: const TextStyle(color: Color(0xFF64748B))),
                      if (doctor != null) ...[
                        const SizedBox(height: 2),
                        Text(doctor!.name,
                            style: const TextStyle(
                                fontSize: 18, fontWeight: FontWeight.w700)),
                      ],
                    ],
                  )),
                  if (priorityEnabled) ...[
                    const SizedBox(height: 14),
                    _card(Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(copy.priority,
                            style:
                                const TextStyle(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (final p in HospitalPriorityCategory.all)
                              GestureDetector(
                                onTap: () => onPriority(p.key),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 9),
                                  decoration: BoxDecoration(
                                    color: priority == p.key
                                        ? KioskPalette.primarySoft
                                        : Colors.white,
                                    borderRadius: BorderRadius.circular(11),
                                    border: Border.all(
                                      color: priority == p.key
                                          ? KioskPalette.primary
                                          : const Color(0xFFE2E8F0),
                                      width: priority == p.key ? 2 : 1,
                                    ),
                                  ),
                                  child: Text(p.label(lang),
                                      style: TextStyle(
                                          fontSize: 13,
                                          fontWeight: priority == p.key
                                              ? FontWeight.w700
                                              : FontWeight.w500,
                                          color: priority == p.key
                                              ? KioskPalette.primary
                                              : const Color(0xFF475569))),
                                ),
                              ),
                          ],
                        ),
                      ],
                    )),
                  ],
                  if (error != null) ...[
                    const SizedBox(height: 12),
                    Text(error!,
                        style: const TextStyle(color: Color(0xFFDC2626))),
                  ],
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: issuing ? null : onConfirm,
                      style: FilledButton.styleFrom(
                        backgroundColor: KioskPalette.primary,
                        padding: const EdgeInsets.symmetric(vertical: 18),
                      ),
                      child: Text(issuing ? copy.issuing : copy.confirm,
                          style: const TextStyle(
                              fontSize: 18, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _card(Widget child) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: child,
      );
}

// ── Hero ─────────────────────────────────────────────────────
class _HeroView extends StatelessWidget {
  const _HeroView({required this.hero, required this.lang, required this.copy});

  final _Hero hero;
  final String lang;
  final HospitalCopy copy;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(copy.yourToken.toUpperCase(),
                style: const TextStyle(
                    fontSize: 13,
                    letterSpacing: 3,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF94A3B8))),
            const SizedBox(height: 8),
            Directionality(
              textDirection: TextDirection.ltr,
              child: Text(
                hero.token.tokenCode,
                style: TextStyle(
                  fontSize: 88,
                  fontWeight: FontWeight.w900,
                  height: 1,
                  color: KioskPalette.primary,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(hero.department.nameFor(lang),
                style: const TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w600)),
            if (hero.doctor != null)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(hero.doctor!.name,
                    style: const TextStyle(color: Color(0xFF475569))),
              ),
            if (hero.waitingAhead != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text.rich(TextSpan(children: [
                  TextSpan(
                    text: '${hero.waitingAhead} ',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  TextSpan(text: copy.waiting),
                ]), style: const TextStyle(color: Color(0xFF64748B))),
              ),
            if (hero.publicUrl != null) ...[
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.all(10),
                color: Colors.white,
                child: QrImageView(
                  data: hero.publicUrl!,
                  size: 132,
                  padding: EdgeInsets.zero,
                ),
              ),
              const SizedBox(height: 6),
              const Text('Scan to track your turn',
                  style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
            ],
            const SizedBox(height: 16),
            Text(copy.proceed,
                style: const TextStyle(color: Color(0xFF94A3B8))),
          ],
        ),
      ),
    );
  }
}

// ── Small shared bits ────────────────────────────────────────
class _BackButton extends StatelessWidget {
  const _BackButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.chevron_left_rounded, size: 20, color: Color(0xFF64748B)),
          Text(label, style: const TextStyle(color: Color(0xFF64748B))),
        ],
      ),
    );
  }
}

class _CenterMessage extends StatelessWidget {
  const _CenterMessage({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: const BoxDecoration(
                    color: Color(0xFFE2E8F0), shape: BoxShape.circle),
                child: Icon(icon, size: 32, color: const Color(0xFF94A3B8)),
              ),
              const SizedBox(height: 16),
              Text(text,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 16, height: 1.4, color: Color(0xFF475569))),
            ],
          ),
        ),
      ),
    );
  }
}

class _BootError extends StatelessWidget {
  const _BootError({
    required this.error,
    required this.onRetry,
    required this.onReset,
  });

  final Object error;
  final VoidCallback onRetry;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    final unregistered =
        error is ApiException && (error as ApiException).isUnregistered;
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 460),
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                unregistered ? Icons.link_off_rounded : Icons.wifi_off_rounded,
                size: 40,
                color: const Color(0xFF94A3B8),
              ),
              const SizedBox(height: 16),
              Text(
                unregistered
                    ? 'This kiosk is not registered'
                    : 'Cannot reach the queue server',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 20),
              Wrap(
                spacing: 12,
                children: [
                  OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
                  if (unregistered)
                    FilledButton(
                        onPressed: onReset, child: const Text('Set up again')),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
