import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../i18n/copy.dart';
import '../../models/school_department.dart';
import '../dept_icon.dart';
import '../theme.dart';

/// The service-selection grid — the primary surface a parent interacts with,
/// and now the only one on the screen. Big cards, generous hit targets.
/// Tapping issues a token; the handler returns immediately (printing is
/// queued), so a card only shows progress while its own request is in flight.
///
/// Layout rules, in order of what they protect:
///
/// * **Column count follows a target card width, not fixed breakpoints.** A
///   card that reads well is about 400dp wide at the reference scale; the grid
///   asks how many of those fit and then *rebalances* so the last row is never
///   a single orphan card next to two empty slots (4 services become 2×2, not
///   3+1).
/// * **Rows fill a bounded height** rather than leaving a strip of dead space
///   under the last row — on a kiosk nobody should have to discover that the
///   screen scrolls to find their service.
/// * **The result is always an explicit extent, never a bare aspect ratio.** A
///   ratio lets a narrow card collapse to a height its own content cannot fit
///   in; the clamp is what guarantees it can.
///
/// Motion is deliberately cheap — opacity and transform only, no blur, no
/// animated shadows. The panel is a low-power RK3566 and every frame here is
/// composited behind a finger that is already moving.
class DepartmentGrid extends StatefulWidget {
  const DepartmentGrid({
    super.key,
    required this.departments,
    required this.lang,
    required this.waitingByDepartment,
    required this.issuingDeptId,
    required this.copy,
    required this.onTap,
    this.shrinkWrap = false,
  });

  final List<SchoolDepartment> departments;
  final String lang;
  final Map<String, int> waitingByDepartment;
  final String? issuingDeptId;
  final KioskCopy copy;
  final ValueChanged<SchoolDepartment> onTap;
  final bool shrinkWrap;

  @override
  State<DepartmentGrid> createState() => _DepartmentGridState();
}

class _DepartmentGridState extends State<DepartmentGrid>
    with SingleTickerProviderStateMixin {
  static const _spacing = 18.0;

  /// A card is never shorter than this — below it even the dense layout stops
  /// fitting. Both ends scale with the device so a large panel fills instead
  /// of stranding a band of dead space under the last row, and a small one
  /// still fits its content.
  ///
  /// The floor is set by what the dense card actually needs, not by what looks
  /// generous: a branch with twelve services has to fit on one screen, because
  /// a service a parent has to scroll to find is a service they will queue at
  /// the wrong desk for.
  static const _minRowExtent = 104.0;
  static const _maxRowExtent = 290.0;

  /// A branch whose services all fit on one row has the whole column height to
  /// itself, and a 290-tall card stranded in the middle of it looks like a
  /// mistake. Let that row grow instead.
  static const _maxSingleRowExtent = 400.0;

  /// How wide a card wants to be at the reference scale. Not a hard rule — the
  /// column count is derived from it and then rebalanced.
  static const _targetCardWidth = 400.0;

  /// …and how wide it is ever allowed to *get*. A branch with one or two
  /// services used to stretch a single card the full width of a 1366 panel and
  /// leave the bottom two thirds of the screen empty; past this width a card
  /// stops looking like something to press and starts looking like a banner.
  /// Whatever the grid doesn't use is given back as margin — the block is
  /// centred in the space it was handed, horizontally and vertically.
  static const _maxCardWidth = 520.0;

  /// A lone service gets to be bigger than one of six: there is nothing else
  /// on the screen for it to be in proportion with, and at this size it can
  /// carry the centred hero layout in [_Card] instead of a corner-anchored one.
  static const _soloCardWidth = 760.0;
  static const _soloRowExtent = 480.0;

  /// One card's entrance, and the gap between neighbours. The stagger is
  /// capped after a handful of cards so a twelve-service branch doesn't spend
  /// most of a second dealing itself out.
  static const _entranceMs = 320;
  static const _staggerMs = 55;
  static const _maxStaggered = 7;

  late final AnimationController _entrance;

  @override
  void initState() {
    super.initState();
    _entrance = AnimationController(
      vsync: this,
      duration: const Duration(
        milliseconds: _entranceMs + _staggerMs * _maxStaggered,
      ),
    )..forward();
  }

  @override
  void dispose() {
    _entrance.dispose();
    super.dispose();
  }

  /// The slice of the shared controller belonging to card [i]. One controller
  /// for the whole grid, not one per card: the cards are rebuilt every time
  /// the feed poll lands, and an animation owned by the child would restart
  /// itself on each of those rebuilds.
  Animation<double> _slot(int i) {
    final total = _entrance.duration!.inMilliseconds;
    final start = (_staggerMs * math.min(i, _maxStaggered)) / total;
    final end = math.min(1.0, start + _entranceMs / total);
    return CurvedAnimation(
      parent: _entrance,
      curve: Interval(start, end, curve: Curves.easeOutCubic),
    );
  }

  /// Columns that fit, then rebalanced so the last row isn't an orphan: fix
  /// the row count the first guess implies and ask how many columns *that*
  /// needs. 4 services in a 3-wide space become 2×2; 6 in a 4-wide become 3×2.
  int _columns(double width, int count, double scale) {
    if (count <= 0) return 1;
    final target = _targetCardWidth * scale;
    var cols = (width / target).round().clamp(1, count);
    final rows = (count / cols).ceil();
    cols = (count / rows).ceil().clamp(1, count);
    return cols;
  }

  @override
  Widget build(BuildContext context) {
    final sorted = [...widget.departments]
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
    final scale = kioskScale(context);
    final minRow = _minRowExtent * scale;
    final maxRow = _maxRowExtent * scale;
    final spacing = _spacing * scale;

    final solo = sorted.length == 1;

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = _columns(constraints.maxWidth, sorted.length, scale);
        final rows = sorted.isEmpty ? 0 : (sorted.length / columns).ceil();

        double rowExtent;
        if (constraints.maxHeight.isFinite && sorted.isNotEmpty) {
          rowExtent = (constraints.maxHeight - spacing * (rows - 1)) / rows;
        } else {
          // Taller than the old ratios: this branch is the portrait/scrolling
          // fallback, where a short card leaves the bottom half of the screen
          // empty rather than filling it.
          final aspect = columns == 1 ? 2.6 : (columns == 2 ? 1.62 : 1.45);
          rowExtent =
              (constraints.maxWidth - spacing * (columns - 1)) / columns / aspect;
        }
        rowExtent = rowExtent.clamp(
          minRow,
          solo
              ? _soloRowExtent * scale
              : rows <= 1
                  ? _maxSingleRowExtent * scale
                  : maxRow,
        );

        // The block the cards actually occupy, centred in whatever the parent
        // gave us. On a full grid this is the whole box and centring is a
        // no-op; on a one- or two-service branch it is what turns an empty
        // screen into a composed one.
        final cardCap = (solo ? _soloCardWidth : _maxCardWidth) * scale;
        final contentWidth = math.min(
          constraints.maxWidth,
          columns * cardCap + spacing * (columns - 1),
        );
        final contentHeight = rows * rowExtent + spacing * (rows - 1);

        final grid = GridView.builder(
          shrinkWrap: widget.shrinkWrap,
          physics: widget.shrinkWrap ? const NeverScrollableScrollPhysics() : null,
          padding: EdgeInsets.zero,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            mainAxisSpacing: spacing,
            crossAxisSpacing: spacing,
            mainAxisExtent: rowExtent,
          ),
          itemCount: sorted.length,
          itemBuilder: (context, i) {
            final dept = sorted[i];
            final slot = _slot(i);
            return FadeTransition(
              opacity: slot,
              child: SlideTransition(
                position: Tween(
                  begin: const Offset(0, 0.055),
                  end: Offset.zero,
                ).animate(slot),
                child: _Card(
                  key: ValueKey(dept.id),
                  department: dept,
                  solo: solo,
                  lang: widget.lang,
                  waiting: widget.waitingByDepartment[dept.id] ?? 0,
                  busy: widget.issuingDeptId == dept.id,
                  dimmed: widget.issuingDeptId != null &&
                      widget.issuingDeptId != dept.id,
                  copy: widget.copy,
                  onTap: () => widget.onTap(dept),
                ),
              ),
            );
          },
        );

        return Center(
          child: SizedBox(
            width: contentWidth,
            // Unbounded height (inside a parent scroll view) has to stay
            // unbounded — the grid is shrink-wrapping there.
            height: constraints.maxHeight.isFinite
                ? math.min(contentHeight, constraints.maxHeight)
                : null,
            child: grid,
          ),
        );
      },
    );
  }
}

/// One service.
///
/// The card is white and quiet at rest; the department's own colour is carried
/// by three small things — the rail down its leading edge, the icon tile, and
/// the arrow — so a parent who comes here every week recognises "the green
/// one" before reading a word of it.
///
/// Pressing it commits, visibly, before the network answers: the card sinks a
/// little, the rail thickens, and the icon tile and arrow fill with that
/// colour. That is the whole point of the press state on a kiosk — the person
/// has to know the machine heard them while the request is still in flight.
class _Card extends StatefulWidget {
  const _Card({
    super.key,
    required this.department,
    required this.solo,
    required this.lang,
    required this.waiting,
    required this.busy,
    required this.dimmed,
    required this.copy,
    required this.onTap,
  });

  final SchoolDepartment department;

  /// The only service in the branch — the card is the screen, so it centres
  /// itself instead of anchoring its parts to the corners of a wide box.
  final bool solo;
  final String lang;
  final int waiting;
  final bool busy;
  final bool dimmed;
  final KioskCopy copy;
  final VoidCallback onTap;

  @override
  State<_Card> createState() => _CardState();
}

class _CardState extends State<_Card> {
  /// Under this height (at the reference scale) the stacked layout — icon
  /// above a two-line name — stops fitting, and the card turns itself into a
  /// single centred row instead of cramming the same parts into less space.
  /// Many services on a short screen is the case that gets here.
  static const _denseBelow = 168.0;

  /// Above this the card has room for the full treatment: a bigger icon, a
  /// two-line name and the second-language name under it. Between the two
  /// thresholds it keeps the same shape with one line of name.
  static const _roomyAbove = 248.0;

  /// Above this a card stops anchoring its parts to its corners and centres
  /// them instead. Past roughly this height the stacked layout is mostly the
  /// hole between the name and the footer — which is exactly what a branch
  /// with one or two services was getting, since a short grid gives every card
  /// the whole column to itself. Under it, the centred layout has less room
  /// than its own parts need and the stacked card is the honest answer.
  static const _heroAbove = 360.0;

  static const _fast = Duration(milliseconds: 140);
  static const _calm = Duration(milliseconds: 180);

  bool _down = false;

  void _setDown(bool value) {
    if (_down != value && mounted) setState(() => _down = value);
  }

  @override
  Widget build(BuildContext context) {
    final color = departmentInk(departmentColor(widget.department.color));
    final scale = kioskScale(context);
    final radius = BorderRadius.circular(KioskPalette.radius);
    final enabled = !widget.busy && !widget.dimmed;
    // Busy holds the pressed look: the card that was tapped stays lit until
    // its ticket comes back, so the eye never loses which one it chose.
    final active = _down || widget.busy;

    return LayoutBuilder(
      builder: (context, box) {
        // Thresholds never scale *down*: the icon tile, the paddings and the
        // arrow are fixed pixel sizes, so a card on a small panel needs just
        // as much height for the stacked layout as one on a large panel — only
        // the text shrinks. Scaling the thresholds below 1.0 would promote a
        // card into a layout its own content no longer fits in.
        final tier = math.max(1.0, scale);
        final h = box.maxHeight;
        final dense = h.isFinite && h < _denseBelow * tier;
        final roomy = !dense && (!h.isFinite || h >= _roomyAbove * tier);
        final hero = h.isFinite && h >= _heroAbove * tier;

        return AnimatedOpacity(
          duration: _calm,
          opacity: widget.dimmed ? 0.42 : 1,
          child: AnimatedScale(
            duration: _fast,
            curve: Curves.easeOut,
            scale: widget.dimmed
                ? 0.985
                : _down
                    ? 0.965
                    : 1,
            child: Semantics(
              button: true,
              enabled: enabled,
              label: widget.department.name(widget.lang),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: radius,
                  boxShadow: KioskPalette.cardShadow,
                ),
                child: Material(
                  color: KioskPalette.surface,
                  borderRadius: radius,
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: enabled ? widget.onTap : null,
                    onHighlightChanged: enabled ? _setDown : null,
                    highlightColor: color.withValues(alpha: 0.05),
                    splashColor: color.withValues(alpha: 0.09),
                    child: AnimatedContainer(
                      duration: _calm,
                      decoration: BoxDecoration(
                        borderRadius: radius,
                        border: Border.all(
                          color: active
                              ? color.withValues(alpha: 0.55)
                              : KioskPalette.border,
                          width: active ? 1.6 : 1,
                        ),
                      ),
                      child: Stack(
                        children: [
                          // The colour rail. Thickens under a finger — the
                          // cheapest possible "this one".
                          PositionedDirectional(
                            start: 0,
                            top: 0,
                            bottom: 0,
                            child: AnimatedContainer(
                              duration: _fast,
                              width: active ? 9 : 5,
                              color: color,
                            ),
                          ),
                          Positioned.fill(
                            child: hero
                                ? _hero(context, color, active, h)
                                : dense
                                    ? _dense(context, color, active, h)
                                    : _stacked(context, color, active, roomy, h),
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

  /// Identity first — icon, then the name directly under it, read as one
  /// block — and the queue and the arrow together on a footer line. The two
  /// things a parent is deciding between (which service, how long) never share
  /// a line, and the card fills top to bottom instead of leaving a hole in its
  /// middle.
  Widget _stacked(
    BuildContext context,
    Color color,
    bool active,
    bool roomy,
    double height,
  ) {
    final primary = widget.department.name(widget.lang);
    final secondary =
        widget.lang == 'ar' ? widget.department.nameEn : widget.department.nameAr;

    // The roomy card sizes its own parts from the height it was given rather
    // than from a fixed table, so a lone service on a big panel — a 620×340
    // card with nothing beside it — fills itself instead of floating a small
    // icon in a large white box. Capped at both ends: a card can't shrink its
    // glyph below legible or grow it into a poster.
    final tile = roomy ? (height * 0.24).clamp(56.0, 88.0) : 50.0;
    final title = roomy ? (height * 0.10).clamp(24.0, 34.0) : 22.0;
    final cue = roomy ? (height * 0.14).clamp(40.0, 52.0) : 38.0;

    return Padding(
      padding: EdgeInsetsDirectional.fromSTEB(
        roomy ? 26 : 22,
        roomy ? 22 : 17,
        roomy ? 20 : 17,
        roomy ? 20 : 17,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _IconTile(
            icon: departmentIcon(widget.department.icon),
            color: color,
            active: active,
            size: tile,
          ),
          SizedBox(height: roomy ? 16 : 12),
          Text(
            primary,
            maxLines: roomy ? 2 : 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: title,
              height: 1.14,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.2,
              color: KioskPalette.ink,
            ),
          ),
          if (roomy && secondary.isNotEmpty && secondary != primary) ...[
            const SizedBox(height: 3),
            Text(
              secondary,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 14,
                color: KioskPalette.inkFaint,
              ),
            ),
          ],
          const Spacer(),
          Row(
            children: [
              // Flexible, not a Spacer: a long localised label ("12 في
              // الانتظار") must ellipsize inside a narrow card rather than
              // push past its edge.
              Expanded(
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: _QueueChip(
                    waiting: widget.waiting,
                    busy: widget.busy,
                    color: color,
                    copy: widget.copy,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              _TapCue(
                color: color,
                active: active,
                busy: widget.busy,
                size: cue,
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// The whole screen, as one object. With nothing to compare it against, a
  /// corner-anchored layout just reads as a large empty rectangle with a label
  /// in it — so the icon, the name, the queue and the arrow stack down the
  /// middle and the card becomes the thing a parent walks up to and presses.
  Widget _hero(BuildContext context, Color color, bool active, double height) {
    final tile = (height * 0.22).clamp(72.0, 112.0);
    final title = (height * 0.10).clamp(28.0, 42.0);
    final cue = (height * 0.115).clamp(46.0, 62.0);
    final primary = widget.department.name(widget.lang);
    final secondary =
        widget.lang == 'ar' ? widget.department.nameEn : widget.department.nameAr;

    return Padding(
      padding: const EdgeInsets.fromLTRB(28, 18, 24, 18),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          _IconTile(
            icon: departmentIcon(widget.department.icon),
            color: color,
            active: active,
            size: tile,
          ),
          const SizedBox(height: 18),
          Text(
            primary,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: title,
              height: 1.12,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.4,
              color: KioskPalette.ink,
            ),
          ),
          if (secondary.isNotEmpty && secondary != primary) ...[
            const SizedBox(height: 4),
            Text(
              secondary,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 15, color: KioskPalette.inkFaint),
            ),
          ],
          const SizedBox(height: 14),
          _QueueChip(
            waiting: widget.waiting,
            busy: widget.busy,
            color: color,
            copy: widget.copy,
          ),
          const SizedBox(height: 18),
          // The spelled-out call to action belongs to the one-service branch.
          // Six of them, one per card, would be six competing buttons on a
          // screen whose whole job is to make the choice between them obvious.
          if (widget.solo)
            _HeroCta(
              color: color,
              busy: widget.busy,
              height: cue,
              label: widget.busy ? widget.copy.issuing : widget.copy.takeNumber,
            )
          else
            _TapCue(
              color: color,
              active: active,
              busy: widget.busy,
              size: cue,
            ),
        ],
      ),
    );
  }

  /// One centred row for a card too short to stack anything: icon, name with
  /// the queue as a plain line under it, arrow. Same parts, same order, a
  /// third of the height.
  Widget _dense(BuildContext context, Color color, bool active, double height) {
    // The tile grows with whatever height the row was given, so a two-row
    // grid on a short panel doesn't leave a band of white inside every card.
    final tile = height.isFinite ? (height * 0.4).clamp(42.0, 62.0) : 44.0;

    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(20, 14, 16, 14),
      child: Row(
        children: [
          _IconTile(
            icon: departmentIcon(widget.department.icon),
            color: color,
            active: active,
            size: tile,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.department.name(widget.lang),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 19,
                    height: 1.15,
                    fontWeight: FontWeight.w700,
                    color: KioskPalette.ink,
                  ),
                ),
                const SizedBox(height: 2),
                _QueueLine(
                  waiting: widget.waiting,
                  busy: widget.busy,
                  color: color,
                  copy: widget.copy,
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          _TapCue(color: color, active: active, busy: widget.busy, size: 34),
        ],
      ),
    );
  }
}

/// The department's glyph. Tinted at rest, solid the moment the card is
/// touched — the single element that carries the press across the whole card.
class _IconTile extends StatelessWidget {
  const _IconTile({
    required this.icon,
    required this.color,
    required this.active,
    required this.size,
  });

  final IconData icon;
  final Color color;
  final bool active;
  final double size;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      curve: Curves.easeOut,
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: active ? color : color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(size * 0.32),
      ),
      child: Icon(
        icon,
        color: active ? Colors.white : color,
        size: size * 0.5,
      ),
    );
  }
}

/// A card is a big flat rectangle; this arrow is what says "tappable" without
/// adding a second, competing hit target. It carries the in-flight state too —
/// the spinner replaces the arrow in place, so nothing on the card moves while
/// the ticket is being issued.
class _TapCue extends StatelessWidget {
  const _TapCue({
    required this.color,
    required this.active,
    required this.busy,
    required this.size,
  });

  final Color color;
  final bool active;
  final bool busy;
  final double size;

  @override
  Widget build(BuildContext context) {
    final rtl = Directionality.of(context) == TextDirection.rtl;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      curve: Curves.easeOut,
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: active ? color : color.withValues(alpha: 0.10),
        shape: BoxShape.circle,
      ),
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 180),
        child: busy
            ? Padding(
                key: const ValueKey('busy'),
                padding: EdgeInsets.all(size * 0.28),
                child: const CircularProgressIndicator(
                  strokeWidth: 2.4,
                  color: Colors.white,
                ),
              )
            : Icon(
                rtl ? Icons.arrow_back_rounded : Icons.arrow_forward_rounded,
                key: const ValueKey('idle'),
                size: size * 0.5,
                color: active ? Colors.white : color,
              ),
      ),
    );
  }
}

/// The hero card's call to action. Not a separate button — the whole card is
/// the target — but on a one-service branch the arrow alone had nothing to
/// explain it, and "select a service" above the grid is advice for a choice
/// this parent doesn't have to make.
class _HeroCta extends StatelessWidget {
  const _HeroCta({
    required this.color,
    required this.busy,
    required this.height,
    required this.label,
  });

  final Color color;
  final bool busy;
  final double height;
  final String label;

  @override
  Widget build(BuildContext context) {
    final rtl = Directionality.of(context) == TextDirection.rtl;

    return Container(
      height: height,
      padding: const EdgeInsets.symmetric(horizontal: 28),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(KioskPalette.radiusPill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(width: 12),
          SizedBox(
            width: 22,
            height: 22,
            child: busy
                ? const CircularProgressIndicator(
                    strokeWidth: 2.4,
                    color: Colors.white,
                  )
                : Icon(
                    rtl ? Icons.arrow_back_rounded : Icons.arrow_forward_rounded,
                    size: 22,
                    color: Colors.white,
                  ),
          ),
        ],
      ),
    );
  }
}

/// Same pill whatever the queue is doing, so the eye can compare six cards at a
/// glance without re-reading each one: a dot, then a number of people. Only a
/// real queue is tinted in the department's colour — an empty one is the good
/// news and stays quiet, and while a ticket is printing the pill says so.
class _QueueChip extends StatelessWidget {
  const _QueueChip({
    required this.waiting,
    required this.busy,
    required this.color,
    required this.copy,
  });

  final int waiting;
  final bool busy;
  final Color color;
  final KioskCopy copy;

  @override
  Widget build(BuildContext context) {
    final queued = waiting > 0;
    final tint = busy || queued ? color : KioskPalette.success;
    final label = busy
        ? copy.issuing
        : queued
            ? '$waiting ${copy.waitingHere}'
            : copy.noneWaiting;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
      decoration: BoxDecoration(
        color: busy || queued
            ? color.withValues(alpha: 0.11)
            : KioskPalette.surfaceMuted,
        borderRadius: BorderRadius.circular(KioskPalette.radiusPill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: tint, shape: BoxShape.circle),
          ),
          const SizedBox(width: 7),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
                color: busy || queued ? tint : KioskPalette.inkSoft,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The chip's content without the chip — a dense card has no vertical room to
/// spend on padding around three words.
class _QueueLine extends StatelessWidget {
  const _QueueLine({
    required this.waiting,
    required this.busy,
    required this.color,
    required this.copy,
  });

  final int waiting;
  final bool busy;
  final Color color;
  final KioskCopy copy;

  @override
  Widget build(BuildContext context) {
    final queued = waiting > 0;
    final label = busy
        ? copy.issuing
        : queued
            ? '$waiting ${copy.waitingHere}'
            : copy.noneWaiting;

    return Text(
      label,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
        fontSize: 13.5,
        fontWeight: FontWeight.w600,
        color: busy || queued ? color : KioskPalette.inkFaint,
      ),
    );
  }
}
