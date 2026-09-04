import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../api/api_exception.dart';
import '../../config/app_config.dart';
import '../../i18n/hospital_copy.dart';
import '../../models/hospital/hospital_department.dart';
import '../../models/hospital/hospital_doctor.dart';
import '../../models/hospital/hospital_kiosk_bootstrap.dart';
import '../../state/app_auth_providers.dart';
import '../../state/hospital_providers.dart';
import '../dept_icon.dart';
import '../theme.dart';
import '../widgets/kiosk_header.dart';
import 'hospital_token_view.dart';

/// The hospital registration kiosk. Ported from
/// components/hospital/HospitalKiosk.tsx: language picker → department grid →
/// (OPD) doctor list → token hero with a public tracking QR, then an auto-reset
/// back to the grid for the next patient.
///
/// Deliberately one screen shorter than the web: the priority-category question
/// ("do any of these apply?") rides along the top of the doctor list as an
/// optional band instead of getting its own confirm screen, so an OPD patient
/// picks a doctor and walks away with a token in two taps. A non-OPD desk still
/// issues on the tap itself.
///
/// Simpler than the school kiosk on purpose — no recent-tickets rail and no
/// amend actions.
class HospitalKioskScreen extends ConsumerStatefulWidget {
  const HospitalKioskScreen({super.key});

  @override
  ConsumerState<HospitalKioskScreen> createState() =>
      _HospitalKioskScreenState();
}

class _HospitalKioskScreenState extends ConsumerState<HospitalKioskScreen> {
  String _lang = 'en';
  bool _langInitialised = false;

  HospitalDepartment? _dept;
  HospitalDoctor? _doctor;
  String? _priority;
  HospitalIssuedToken? _hero;
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
      final issued = await ref
          .read(hospitalKioskControllerProvider)
          .issue(
            department: dept,
            doctor: doctor,
            priorityCategory: _priority,
            lang: _lang,
          );
      if (!mounted) return;
      final token = issued.token;
      final publicUrl =
          bootstrap.publicTrackingEnabled &&
              token.publicCode.isNotEmpty &&
              bootstrap.publicBaseUrl.isNotEmpty
          ? '${bootstrap.publicBaseUrl}/t/${token.publicCode}'
          : null;
      setState(() {
        _hero = HospitalIssuedToken(
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
        await deprovision(ref);
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
                onReset: () => deprovision(ref),
              );
            },
            data: (bootstrap) {
              _cancelBootRetry();
              // Hospital kiosks always expose the three supported patient
              // languages. Backend settings can still choose the initial
              // language, but a missing setting must not hide Hindi or Marathi.
              const languages = ['en', 'hi', 'mr'];
              if (!_langInitialised) {
                _langInitialised = true;
                _lang = bootstrap.languages.firstWhere(
                  languages.contains,
                  orElse: () => languages.first,
                );
              }
              return _Shell(
                bootstrap: bootstrap,
                lang: _lang,
                onLang: (l) => setState(() => _lang = l),
                languages: languages,
                showLangPicker: _hero == null,
                activeStep: _hero != null ? 2 : (_dept != null ? 1 : 0),
                // Steps cross-fade rather than cut. Each one is a different
                // widget type, so the switcher fires on exactly the four
                // moves that are real transitions — grid → doctor → token →
                // grid — and never on a feed poll landing inside one screen.
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 240),
                  switchInCurve: Curves.easeOutCubic,
                  switchOutCurve: Curves.easeIn,
                  // The default layout centres children under loose
                  // constraints; every step here expects the tight box the
                  // shell hands down, so keep giving them one.
                  layoutBuilder: (current, previous) => Stack(
                    fit: StackFit.expand,
                    children: [...previous, ?current],
                  ),
                  transitionBuilder: (child, animation) => FadeTransition(
                    opacity: animation,
                    child: SlideTransition(
                      position: Tween(
                        begin: const Offset(0, 0.02),
                        end: Offset.zero,
                      ).animate(animation),
                      child: child,
                    ),
                  ),
                  child: _body(bootstrap),
                ),
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
      return HospitalTokenView(
        hero: _hero!,
        lang: _lang,
        copy: c,
        linger: Duration(seconds: bootstrap.settings?.kioskIdleSeconds ?? 20),
        // The same reset the idle timer performs, reachable early: a patient
        // who has read their number, or the one behind them, should not have
        // to wait the screen out.
        onDismiss: _resetToGrid,
      );
    }

    if (bootstrap.departments.isEmpty) {
      return _CenterMessage(icon: Icons.dns_outlined, text: c.noServices);
    }

    final dept = _dept;
    // A desk that isn't an OPD speciality issues on the tap itself, so hold
    // the grid — with the pressed card spinning — instead of flashing a
    // screen the patient never gets to use. The same is true while an OPD
    // token is in flight: that is [_DoctorStep]'s job, below.
    if (dept == null || !dept.isOpd) {
      return _Grid(
        departments: bootstrap.departments,
        lang: _lang,
        waitingFor: (id) => feed?.waitingFor(id) ?? 0,
        doctorsOnDuty: (id) => bootstrap.doctorsFor(id).length,
        issuingDeptId: _issuing ? dept?.id : null,
        error: _error,
        onTap: (d) {
          setState(() {
            _dept = d;
            _doctor = null;
            _priority = null;
            _error = null;
          });
          if (!d.isOpd) _issue(bootstrap, d, null);
        },
        copy: c,
      );
    }

    // OPD: doctor list with the optional priority band on top. Picking a
    // doctor issues the token straight away — no confirm screen.
    return _DoctorStep(
      dept: dept,
      doctors: bootstrap.doctorsFor(dept.id),
      lang: _lang,
      priorityEnabled: bootstrap.settings?.priorityEnabled ?? true,
      priority: _priority,
      issuing: _issuing,
      issuingDoctorId: _issuing ? _doctor?.id : null,
      error: _error,
      copy: c,
      onBack: () => setState(() {
        _dept = null;
        _doctor = null;
        _priority = null;
        _error = null;
      }),
      onPriority: (key) =>
          setState(() => _priority = _priority == key ? null : key),
      onPick: (d) {
        setState(() {
          _doctor = d;
          _error = null;
        });
        _issue(bootstrap, dept, d);
      },
    );
  }
}

// ── Shell (header + language picker) ─────────────────────────
/// The chrome the whole kiosk sits inside. It is the school kiosk's
/// [KioskHeader] verbatim — a white rail, the hospital's own logo when it has
/// uploaded one, the clock, and the language words. Two terminals in the same
/// lobby, one paired to a school and one to a hospital, should not disagree
/// about what a header is.
class _Shell extends StatelessWidget {
  const _Shell({
    required this.bootstrap,
    required this.lang,
    required this.onLang,
    required this.languages,
    required this.showLangPicker,
    required this.activeStep,
    required this.child,
  });

  final HospitalKioskBootstrap bootstrap;
  final String lang;
  final ValueChanged<String> onLang;
  final List<String> languages;
  final bool showLangPicker;
  final int activeStep;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        KioskHeader(
          title: bootstrap.hospitalName(lang),
          logoUrl: bootstrap.settings?.logoUrl ?? '',
          // Hidden on the token screen: switching language there would only
          // re-label a decision the patient has already made and printed.
          languages: showLangPicker ? languages : const [],
          lang: lang,
          onLangChange: onLang,
          activeStep: activeStep,
        ),
        Expanded(
          // One step deeper than the app ground, so a screen full of
          // saturated colour has something to sit *on* rather than float over.
          child: ColoredBox(color: KioskPalette.bgDeep, child: child),
        ),
      ],
    );
  }
}

// ── Grid ─────────────────────────────────────────────────────
/// Choose a department — the one screen every patient sees, and the only one
/// most of them read.
///
/// Colour blocks, not white cards with a coloured hairline. A patient who
/// comes in every month learns "the teal one" long before they read a word of
/// it, and a solid field carries that from the lobby door where a tinted
/// border does not. Everything on a card is therefore a single ink laid on the
/// fill — the colour does the identifying, so nothing else has to compete for
/// it. [departmentBlock] is what makes that safe for any hex an admin picks.
///
/// Two layout rules, in the order they matter:
///
/// * **Column count follows a target card width, then rebalances** so the last
///   row is never one orphan beside two empty slots — the same rule the school
///   grid uses, so the two verticals lay out identically.
/// * **Row height is bounded at both ends and the block is centred.** Three
///   departments should be three cards, not three banners; twelve should still
///   land on one screen, because a department a patient has to scroll to find
///   is a department they will queue at the wrong desk for.
class _Grid extends StatelessWidget {
  const _Grid({
    required this.departments,
    required this.lang,
    required this.waitingFor,
    required this.doctorsOnDuty,
    required this.issuingDeptId,
    required this.error,
    required this.onTap,
    required this.copy,
  });

  final List<HospitalDepartment> departments;
  final String lang;
  final int Function(String id) waitingFor;

  /// Doctors scheduled and not on leave today, per department. Said on the
  /// card so nobody picks a speciality that has nobody in it and only finds
  /// out on the next screen.
  final int Function(String id) doctorsOnDuty;

  /// The card whose token is in flight, if any — it holds its pressed look and
  /// takes a spinner while the rest of the grid dims.
  final String? issuingDeptId;

  /// A failed issue from a walk-up desk. Those issue on the tap itself and
  /// stay on this screen, so the failure has to be said here — otherwise the
  /// tap just appears to do nothing.
  final String? error;
  final ValueChanged<HospitalDepartment> onTap;
  final HospitalCopy copy;

  static const _spacing = 16.0;

  /// A row card is wider than it is tall, so its bounds sit well below the
  /// school grid's stacked-card ones. The floor is what the compact layout
  /// actually needs; the ceiling is where a card stops looking like something
  /// to press and starts looking like a banner.
  static const _minRowExtent = 104.0;
  static const _maxRowExtent = 172.0;

  /// How wide a card wants to be at the reference scale. Not a hard rule — the
  /// column count is derived from it and then rebalanced.
  static const _targetCardWidth = 470.0;

  int _columns(double width, int count, double scale) {
    if (count <= 0) return 1;
    var cols = (width / (_targetCardWidth * scale)).round().clamp(1, count);
    final rows = (count / cols).ceil();
    return (count / rows).ceil().clamp(1, count);
  }

  @override
  Widget build(BuildContext context) {
    final sorted = [...departments]
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

    final scale = kioskScale(context);
    final spacing = _spacing * scale;
    // Thresholds never scale *down*: the icon tile and the paddings inside a
    // card are fixed sizes, so a small panel needs just as much height for the
    // layout as a large one — only the text shrinks.
    final tier = math.max(1.0, scale);

    return Padding(
      padding: EdgeInsets.fromLTRB(
        26 * scale,
        22 * scale,
        26 * scale,
        24 * scale,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                copy.pick,
                style: const TextStyle(
                  fontSize: 27,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.4,
                  color: KioskPalette.ink,
                ),
              ),
              const SizedBox(height: 7),
              Text(
                copy.pickHint,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 15,
                  color: KioskPalette.inkSoft,
                ),
              ),
            ],
          ),
          if (error != null) ...[
            SizedBox(height: 14 * scale),
            _ErrorLine(text: error!),
          ],
          SizedBox(height: 18 * scale),
          Expanded(
            child: LayoutBuilder(
              builder: (context, box) {
                final columns = _columns(box.maxWidth, sorted.length, scale);
                final rows = (sorted.length / columns).ceil();
                final rowExtent =
                    ((box.maxHeight - spacing * (rows - 1)) / rows).clamp(
                      _minRowExtent * tier,
                      _maxRowExtent * scale,
                    );
                final contentHeight = rows * rowExtent + spacing * (rows - 1);

                // Keep the service wall attached to the instruction header.
                // Centering a short two-row grid in the remaining viewport
                // creates a large dead band above the cards on wide kiosks.
                return Align(
                  alignment: Alignment.topCenter,
                  child: SizedBox(
                    height: math.min(contentHeight, box.maxHeight),
                    child: GridView.builder(
                      padding: EdgeInsets.zero,
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: columns,
                        mainAxisSpacing: spacing,
                        crossAxisSpacing: spacing,
                        mainAxisExtent: rowExtent,
                      ),
                      itemCount: sorted.length,
                      itemBuilder: (context, i) {
                        final d = sorted[i];
                        return _DeptCard(
                          key: ValueKey(d.id),
                          dept: d,
                          lang: lang,
                          waiting: waitingFor(d.id),
                          onDuty: doctorsOnDuty(d.id),
                          busy: issuingDeptId == d.id,
                          dimmed:
                              issuingDeptId != null && issuingDeptId != d.id,
                          copy: copy,
                          onTap: () => onTap(d),
                        );
                      },
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// One department, as a block of its own colour.
///
/// Pressing sinks the card and deepens the fill. That is the whole press
/// state: on a coloured card there is no lighter surface left to tint, so the
/// affordance has to come from the fill itself. Busy holds that look until the
/// token comes back, so the eye never loses which block it chose.
///
/// Motion is deliberately cheap — opacity and transform only, no blur, no
/// animated shadows. The panel is a low-power RK3566.
class _DeptCard extends StatefulWidget {
  const _DeptCard({
    super.key,
    required this.dept,
    required this.lang,
    required this.waiting,
    required this.onDuty,
    required this.busy,
    required this.dimmed,
    required this.copy,
    required this.onTap,
  });

  final HospitalDepartment dept;
  final String lang;
  final int waiting;
  final int onDuty;
  final bool busy;
  final bool dimmed;
  final HospitalCopy copy;
  final VoidCallback onTap;

  @override
  State<_DeptCard> createState() => _DeptCardState();
}

class _DeptCardState extends State<_DeptCard> {
  /// Under this width the chevron is the first thing to go: it is the least
  /// informative part of the card and the queue figure is the most.
  static const _chevronAbove = 330.0;

  /// …and under this the queue figure loses its caption rather than its digits.
  static const _captionAbove = 250.0;

  static const _fast = Duration(milliseconds: 140);
  static const _calm = Duration(milliseconds: 180);

  bool _down = false;

  void _setDown(bool value) {
    if (_down != value && mounted) setState(() => _down = value);
  }

  /// The second line: what a patient needs to know before choosing, which for
  /// an OPD speciality is whether anyone is sitting in it today.
  String get _sub {
    final c = widget.copy;
    if (!widget.dept.isOpd) return c.walkIn;
    if (widget.onDuty == 0) return c.noDoctorsToday;
    if (widget.onDuty == 1) return c.doctorOnDuty;
    return '${widget.onDuty} ${c.doctorsOnDuty}';
  }

  @override
  Widget build(BuildContext context) {
    final block = departmentBlock(departmentColor(widget.dept.color));
    final fill = block.fill;
    final on = block.on;
    final radius = BorderRadius.circular(24);
    final enabled = !widget.busy && !widget.dimmed;
    final active = _down || widget.busy;

    return LayoutBuilder(
      builder: (context, box) {
        final w = box.maxWidth;
        final showChevron = w >= _chevronAbove;
        final showCaption = w >= _captionAbove;
        final tile = box.maxHeight >= 128 ? 56.0 : 46.0;

        return AnimatedOpacity(
          duration: _calm,
          opacity: widget.dimmed ? 0.42 : 1,
          child: AnimatedScale(
            duration: _fast,
            curve: Curves.easeOut,
            scale: widget.dimmed ? 0.985 : (_down ? 0.965 : 1),
            child: Semantics(
              button: true,
              enabled: enabled,
              label: widget.dept.nameFor(widget.lang),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: radius,
                  // Tinted with the card's own colour so the block sits on the
                  // ground instead of floating over it.
                  boxShadow: [
                    BoxShadow(
                      color: fill.withValues(alpha: 0.26),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: AnimatedContainer(
                  duration: _fast,
                  decoration: BoxDecoration(
                    color: active ? departmentFillPressed(fill) : fill,
                    borderRadius: radius,
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: enabled ? widget.onTap : null,
                      onHighlightChanged: enabled ? _setDown : null,
                      highlightColor: on.withValues(alpha: 0.05),
                      splashColor: on.withValues(alpha: 0.10),
                      child: Stack(
                        children: [
                          // One soft highlight bled off the trailing corner:
                          // enough to keep a large flat field from reading as
                          // printed paper, cheap enough for the panel (no
                          // blur, no gradient — a translucent circle).
                          PositionedDirectional(
                            top: -84,
                            end: -56,
                            child: Container(
                              width: 190,
                              height: 190,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: on.withValues(alpha: 0.07),
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 20,
                              vertical: 16,
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Container(
                                      width: tile,
                                      height: tile,
                                      decoration: BoxDecoration(
                                        color: on.withValues(alpha: 0.16),
                                        borderRadius: BorderRadius.circular(14),
                                      ),
                                      child: Icon(
                                        departmentIcon(widget.dept.icon),
                                        color: on,
                                        size: tile * 0.5,
                                      ),
                                    ),
                                    if (showChevron)
                                      Icon(
                                        Icons.arrow_forward_rounded,
                                        size: 22,
                                        color: on.withValues(alpha: 0.72),
                                      ),
                                  ],
                                ),
                                const Spacer(),
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            widget.dept.nameFor(widget.lang),
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              fontSize: 21,
                                              fontWeight: FontWeight.w700,
                                              height: 1.15,
                                              letterSpacing: -0.2,
                                              color: on,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            _sub,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w500,
                                              color: on.withValues(alpha: 0.76),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Column(
                                      mainAxisSize: MainAxisSize.min,
                                      crossAxisAlignment:
                                          CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          '${widget.waiting}',
                                          style: TextStyle(
                                            fontSize: 30,
                                            fontWeight: FontWeight.w900,
                                            height: 1,
                                            color: on,
                                            fontFeatures: const [
                                              FontFeature.tabularFigures(),
                                            ],
                                          ),
                                        ),
                                        if (showCaption)
                                          Text(
                                            widget.waiting == 0
                                                ? widget.copy.noQueue
                                                : widget.copy.waitingHere,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.w600,
                                              letterSpacing: 0.4,
                                              color: on.withValues(alpha: 0.76),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          if (widget.busy)
                            Positioned.fill(
                              child: ColoredBox(
                                color: const Color(0x40000000),
                                child: Center(
                                  child: SizedBox(
                                    width: 30,
                                    height: 30,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 3,
                                      valueColor: AlwaysStoppedAnimation(on),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

// ── Doctor step ──────────────────────────────────────────────
/// The one OPD screen. A fixed head — back, the department the patient just
/// pressed, and the optional priority band — sits above a doctor list that
/// scrolls under it, so a patient who scrolls to find their doctor never loses
/// the "do any of these apply?" question. Tapping a doctor is the commit: the
/// token issues on that tap and the card holds a spinner until it comes back.
///
/// The head repeats the department as its own colour block in miniature. That
/// is the whole continuity trick of this flow: the tile a patient pressed on
/// the grid follows them here, and again onto the chip on the token screen, so
/// three screens read as one errand rather than three forms.
class _DoctorStep extends StatelessWidget {
  const _DoctorStep({
    required this.dept,
    required this.doctors,
    required this.lang,
    required this.priorityEnabled,
    required this.priority,
    required this.issuing,
    required this.issuingDoctorId,
    required this.error,
    required this.copy,
    required this.onBack,
    required this.onPriority,
    required this.onPick,
  });

  final HospitalDepartment dept;
  final List<HospitalDoctor> doctors;
  final String lang;
  final bool priorityEnabled;
  final String? priority;

  /// A token is in flight — the whole list is inert and [issuingDoctorId]'s
  /// card carries the spinner.
  final bool issuing;
  final String? issuingDoctorId;
  final String? error;
  final HospitalCopy copy;
  final VoidCallback onBack;
  final ValueChanged<String> onPriority;
  final ValueChanged<HospitalDoctor> onPick;

  @override
  Widget build(BuildContext context) {
    final showBand = priorityEnabled && doctors.isNotEmpty;
    final block = departmentBlock(departmentColor(dept.color));

    final head = Builder(
      builder: (context) => Padding(
        padding: EdgeInsets.fromLTRB(26, 18, 26, showBand ? 14 : 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _BackButton(label: copy.back, onTap: onBack),
            const SizedBox(height: 12),
            Row(
              children: [
                // The block they pressed, in miniature.
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: block.fill,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(
                    departmentIcon(dept.icon),
                    color: block.on,
                    size: 26,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        dept.nameFor(lang),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.3,
                          height: 1.15,
                          color: KioskPalette.ink,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        copy.pickDoctor,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 15,
                          color: KioskPalette.inkSoft,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (showBand) ...[
              const SizedBox(height: 16),
              _PriorityBand(
                lang: lang,
                selected: priority,
                onSelect: issuing ? (_) {} : onPriority,
                copy: copy,
              ),
            ],
            if (error != null) ...[
              const SizedBox(height: 12),
              _ErrorLine(text: error!),
            ],
          ],
        ),
      ),
    );

    Widget card(HospitalDoctor d) => _DoctorCard(
      key: ValueKey(d.id),
      doctor: d,
      copy: copy,
      busy: issuing && d.id == issuingDoctorId,
      dimmed: issuing && d.id != issuingDoctorId,
      onTap: () => onPick(d),
    );

    return Center(
      child: ConstrainedBox(
        // Wider than a form, narrower than the grid: a kiosk panel has room
        // for two doctors abreast, and a 720-wide column on a 1366 screen left
        // a third of the glass empty on either side.
        constraints: const BoxConstraints(maxWidth: 1120),
        child: LayoutBuilder(
          builder: (context, box) {
            // Two abreast once a card can still hold a name, a speciality and
            // a fee without truncating all three.
            final cols = box.maxWidth >= 880 ? 2 : 1;

            if (doctors.isEmpty) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  head,
                  Expanded(
                    child: _CenterMessage(
                      icon: Icons.event_busy_rounded,
                      text: copy.notSetUp,
                    ),
                  ),
                ],
              );
            }

            // A short viewport — a dev phone in landscape, or a panel turned
            // the wrong way — can't hold the head *and* a scrollable list
            // under it without the head overflowing. There, the head scrolls
            // with the doctors rather than being clipped: one scroll surface
            // is worse than a pinned head, and much better than a screen with
            // its back button cut off.
            if (box.maxHeight < 430) {
              return ListView(
                padding: const EdgeInsets.only(bottom: 26),
                children: [
                  head,
                  for (var i = 0; i < doctors.length; i += cols)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(26, 0, 26, 10),
                      child: Row(
                        children: [
                          for (var j = i; j < i + cols; j++) ...[
                            if (j > i) const SizedBox(width: 10),
                            Expanded(
                              child: j < doctors.length
                                  ? SizedBox(
                                      height: 88,
                                      child: card(doctors[j]),
                                    )
                                  : const SizedBox(height: 88),
                            ),
                          ],
                        ],
                      ),
                    ),
                ],
              );
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                head,
                Expanded(
                  child: GridView.builder(
                    padding: const EdgeInsets.fromLTRB(26, 2, 26, 26),
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: cols,
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      mainAxisExtent: 88,
                    ),
                    itemCount: doctors.length,
                    itemBuilder: (context, i) => card(doctors[i]),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// The self-declared priority question, as a row of toggles. Optional by
/// design — nothing here is required to get a token, so it takes no confirm
/// button of its own; the patient just taps a doctor when they are ready.
class _PriorityBand extends StatelessWidget {
  const _PriorityBand({
    required this.lang,
    required this.selected,
    required this.onSelect,
    required this.copy,
  });

  final String lang;
  final String? selected;
  final ValueChanged<String> onSelect;
  final HospitalCopy copy;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 13, 16, 15),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            copy.priority,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: KioskPalette.ink,
            ),
          ),
          const SizedBox(height: 11),
          Wrap(
            spacing: 9,
            runSpacing: 9,
            children: [
              for (final p in HospitalPriorityCategory.all)
                _PriorityChip(
                  label: p.label(lang),
                  active: selected == p.key,
                  onTap: () => onSelect(p.key),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PriorityChip extends StatelessWidget {
  const _PriorityChip({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: active,
      child: Material(
        color: active ? KioskPalette.primarySoft : const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 120),
            padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: active ? KioskPalette.primary : const Color(0xFFE2E8F0),
                width: active ? 2 : 1,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (active) ...[
                  const Icon(
                    Icons.check_rounded,
                    size: 16,
                    color: KioskPalette.primary,
                  ),
                  const SizedBox(width: 6),
                ],
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                    color: active
                        ? KioskPalette.primary
                        : const Color(0xFF475569),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DoctorCard extends StatefulWidget {
  const _DoctorCard({
    super.key,
    required this.doctor,
    required this.copy,
    required this.busy,
    required this.dimmed,
    required this.onTap,
  });

  final HospitalDoctor doctor;
  final HospitalCopy copy;

  /// This doctor's token is being issued right now.
  final bool busy;

  /// Another doctor's token is being issued — this card steps back and out of
  /// reach until it returns.
  final bool dimmed;
  final VoidCallback onTap;

  @override
  State<_DoctorCard> createState() => _DoctorCardState();
}

class _DoctorCardState extends State<_DoctorCard> {
  bool _down = false;

  void _setDown(bool v) {
    if (_down != v && mounted) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    final doctor = widget.doctor;
    final copy = widget.copy;
    final enabled = !widget.busy && !widget.dimmed;
    final active = _down || widget.busy;
    final radius = BorderRadius.circular(16);

    return AnimatedOpacity(
      duration: const Duration(milliseconds: 160),
      opacity: widget.dimmed ? 0.45 : 1,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        decoration: BoxDecoration(
          color: active ? const Color(0xFFF5F7FF) : Colors.white,
          borderRadius: radius,
          border: Border.all(
            color: widget.busy ? KioskPalette.primary : const Color(0x00000000),
            width: 1.6,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: enabled ? widget.onTap : null,
            onHighlightChanged: enabled ? _setDown : null,
            child: Stack(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Container(
                        width: 46,
                        height: 46,
                        decoration: BoxDecoration(
                          color: KioskPalette.primarySoft,
                          borderRadius: BorderRadius.circular(13),
                        ),
                        child: const Icon(
                          Icons.medical_services_rounded,
                          color: KioskPalette.primary,
                          size: 21,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              doctor.name,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 16,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                            if (doctor.specialization.isNotEmpty)
                              Text(
                                doctor.specialization,
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  color: Color(0xFF64748B),
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                          ],
                        ),
                      ),
                      if (doctor.feeRupees != null) ...[
                        const SizedBox(width: 10),
                        Directionality(
                          textDirection: TextDirection.ltr,
                          child: Text(
                            '${copy.fee} ₹${doctor.feeRupees}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF475569),
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(width: 6),
                      Icon(
                        Icons.chevron_right_rounded,
                        size: 24,
                        color: KioskPalette.ink.withValues(alpha: 0.35),
                      ),
                    ],
                  ),
                ),
                if (widget.busy)
                  Positioned.fill(
                    child: ColoredBox(
                      color: const Color(0xCCFFFFFF),
                      child: const Center(
                        child: SizedBox(
                          width: 26,
                          height: 26,
                          child: CircularProgressIndicator(
                            strokeWidth: 3,
                            valueColor: AlwaysStoppedAnimation(
                              KioskPalette.primary,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Small shared bits ────────────────────────────────────────
/// Back, as something a finger can actually hit. The old version was a 20px
/// chevron and a line of grey text with no padding — a ~24px target on a panel
/// people press with a thumb, and the only way out of the doctor list.
class _BackButton extends StatelessWidget {
  const _BackButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(KioskPalette.radiusPill),
        child: InkWell(
          borderRadius: BorderRadius.circular(KioskPalette.radiusPill),
          onTap: onTap,
          child: Container(
            height: 48,
            padding: const EdgeInsetsDirectional.fromSTEB(12, 0, 20, 0),
            alignment: Alignment.center,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Mirrors with the text direction, so "back" points back in
                // Arabic too.
                const Icon(
                  Icons.arrow_back_rounded,
                  size: 20,
                  color: KioskPalette.inkSoft,
                ),
                const SizedBox(width: 8),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: KioskPalette.inkSoft,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A failed issue, said where the patient is already looking rather than in a
/// toast that expires while they are reading the doctor list.
class _ErrorLine extends StatelessWidget {
  const _ErrorLine({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
      decoration: BoxDecoration(
        color: KioskPalette.dangerSoft,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.error_outline_rounded,
            size: 20,
            color: KioskPalette.danger,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w500,
                color: KioskPalette.danger,
              ),
            ),
          ),
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
                  color: Color(0xFFE2E8F0),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 32, color: const Color(0xFF94A3B8)),
              ),
              const SizedBox(height: 16),
              Text(
                text,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 16,
                  height: 1.4,
                  color: Color(0xFF475569),
                ),
              ),
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
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 20),
              Wrap(
                spacing: 12,
                children: [
                  OutlinedButton(
                    onPressed: onRetry,
                    child: const Text('Retry'),
                  ),
                  if (unregistered)
                    FilledButton(
                      onPressed: onReset,
                      child: const Text('Set up again'),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
