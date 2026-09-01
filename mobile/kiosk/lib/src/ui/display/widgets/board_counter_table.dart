import 'package:flutter/material.dart';

import '../../../models/board_packet.dart';
import '../../dept_icon.dart';
import '../../theme.dart';

/// The `TOKEN NO. / DEPARTMENT / COUNTER / STATUS` table — one row per **open**
/// counter, not "last N called". A counter must never vanish from the board
/// three calls later just because other counters kept calling (the layout
/// mistake docs/school-queue-plan.md explicitly calls out).
///
/// Row height is derived from the space available, not fixed: this is read
/// from across a lobby, and two open counters on a 40" panel must fill the
/// screen with the numbers people came to read rather than leave two thirds
/// of it blank under table-sized type. Everything inside a row — the token
/// glyphs above all — is then sized off that row height.
class BoardCounterTable extends StatelessWidget {
  const BoardCounterTable({super.key, required this.counters, required this.scale});

  final List<BoardCounter> counters;
  final double scale;

  /// Column weights, shared by the header and every row so they stay aligned.
  static const _flexToken = 5;
  static const _flexDept = 4;
  static const _flexCounter = 4;
  static const _flexStatus = 4;

  @override
  Widget build(BuildContext context) {
    final open = counters.where((c) => c.isOpen).toList()
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

    return LayoutBuilder(builder: (context, c) {
      final headerHeight = 100 * scale;
      final avail = (c.maxHeight - headerHeight).clamp(0.0, double.infinity);

      // Grow rows to fill, but cap them: one lone open counter should read as
      // a headline, not a billboard with a single line stranded mid-screen.
      final rowHeight = open.isEmpty
          ? avail
          : (avail / open.length).clamp(110.0 * scale, 300.0 * scale);
      // Only scroll when the rows genuinely overflow (many counters open).
      final overflows = rowHeight * open.length > avail + 1;

      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(height: headerHeight, child: _HeaderRow(scale: scale)),
          Container(height: 2 * scale, color: KioskPalette.borderStrong),
          Expanded(
            child: open.isEmpty
                ? Center(
                    child: Text(
                      'No counters open',
                      style: TextStyle(
                        fontSize: 40 * scale,
                        fontWeight: FontWeight.w600,
                        color: KioskPalette.inkFaint,
                      ),
                    ),
                  )
                : ListView.separated(
                    physics: overflows
                        ? const ClampingScrollPhysics()
                        : const NeverScrollableScrollPhysics(),
                    padding: EdgeInsets.zero,
                    itemCount: open.length,
                    separatorBuilder: (_, _) =>
                        Container(height: 1, color: KioskPalette.border),
                    itemBuilder: (context, i) => _CounterRow(
                      counter: open[i],
                      scale: scale,
                      height: rowHeight,
                    ),
                  ),
          ),
        ],
      );
    });
  }
}

class _HeaderRow extends StatelessWidget {
  const _HeaderRow({required this.scale});
  final double scale;

  @override
  Widget build(BuildContext context) {
    // These labels are the legend for the whole board — what each column of
    // numbers *means* — so they have to be readable from the same distance as
    // the rows beneath them, not set at caption size.
    final style = TextStyle(
      fontSize: 34 * scale,
      fontWeight: FontWeight.w800,
      color: KioskPalette.ink,
      letterSpacing: 1.8,
      height: 1.1,
    );
    final subStyle = TextStyle(
      fontSize: 24 * scale,
      fontWeight: FontWeight.w600,
      color: KioskPalette.inkSoft,
      height: 1.2,
    );
    // Shrink-to-fit for the same reason the rows do: a clipped "DEPARTM…" in
    // the legend is worse than the word a couple of points smaller.
    Widget line(String text, TextStyle style, TextAlign align) => FittedBox(
          fit: BoxFit.scaleDown,
          alignment: align == TextAlign.end ? Alignment.centerRight : Alignment.centerLeft,
          child: Text(text, maxLines: 1, style: style),
        );
    Widget col(String en, String ar, {TextAlign align = TextAlign.start}) => Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment:
              align == TextAlign.end ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            line(en, style, align),
            Directionality(
              textDirection: TextDirection.rtl,
              child: line(ar, subStyle, align),
            ),
          ],
        );

    return Container(
      color: KioskPalette.surfaceMuted,
      padding: EdgeInsets.symmetric(horizontal: 24 * scale),
      child: Row(
        children: [
          Expanded(
            flex: BoardCounterTable._flexToken,
            child: col('TOKEN NO.', 'رقم التذكرة'),
          ),
          Expanded(
            flex: BoardCounterTable._flexDept,
            child: col('DEPARTMENT', 'القسم'),
          ),
          Expanded(
            flex: BoardCounterTable._flexCounter,
            child: col('COUNTER', 'المنضدة'),
          ),
          Expanded(
            flex: BoardCounterTable._flexStatus,
            child: col('STATUS', 'الحالة', align: TextAlign.end),
          ),
        ],
      ),
    );
  }
}

class _CounterRow extends StatelessWidget {
  const _CounterRow({required this.counter, required this.scale, required this.height});
  final BoardCounter counter;
  final double scale;
  final double height;

  @override
  Widget build(BuildContext context) {
    final called = counter.isCalled;
    final color = counter.departmentColor != null
        ? departmentColor(counter.departmentColor!)
        : KioskPalette.primary;

    // Everything in the row is a fraction of its height, so the same code
    // reads correctly whether two counters are open or eight.
    final tokenFont = (height * 0.40).clamp(38.0 * scale, 132.0 * scale);
    final nameFont = (height * 0.155).clamp(20.0 * scale, 44.0 * scale);
    final subFont = nameFont * 0.68;

    return Container(
      height: height,
      decoration: BoxDecoration(
        color: called ? color.withValues(alpha: 0.08) : Colors.transparent,
        border: Border(
          left: BorderSide(color: called ? color : Colors.transparent, width: 10 * scale),
        ),
      ),
      padding: EdgeInsets.symmetric(horizontal: 20 * scale),
      child: Row(
        children: [
          Expanded(
            flex: BoardCounterTable._flexToken,
            child: Row(
              children: [
                if (counter.isPriority && called)
                  Padding(
                    padding: EdgeInsets.only(right: 10 * scale),
                    child: Icon(Icons.star_rounded, color: color, size: tokenFont * 0.55),
                  ),
                Flexible(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(
                      called ? counter.tokenCode! : '—',
                      maxLines: 1,
                      style: TextStyle(
                        fontSize: tokenFont,
                        fontWeight: FontWeight.w900,
                        height: 1.0,
                        letterSpacing: -1,
                        fontFeatures: const [FontFeature.tabularFigures()],
                        color: called ? KioskPalette.ink : KioskPalette.inkFaint,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            flex: BoardCounterTable._flexDept,
            child: _DepartmentCell(
              counter: counter,
              color: color,
              called: called,
              nameFont: nameFont,
              subFont: subFont,
              scale: scale,
            ),
          ),
          Expanded(
            flex: BoardCounterTable._flexCounter,
            child: _BilingualCell(
              en: counter.nameEn,
              ar: counter.nameAr,
              nameFont: nameFont,
              subFont: subFont,
              enColor: KioskPalette.ink,
              arColor: KioskPalette.inkSoft,
            ),
          ),
          Expanded(
            flex: BoardCounterTable._flexStatus,
            child: Align(
              alignment: Alignment.centerRight,
              child: Container(
                padding: EdgeInsets.symmetric(horizontal: 22 * scale, vertical: 10 * scale),
                decoration: BoxDecoration(
                  color: called ? color : KioskPalette.surfaceMuted,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      called ? 'Please proceed' : 'Available',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: nameFont * 0.82,
                        fontWeight: FontWeight.w800,
                        height: 1.1,
                        color: called ? Colors.white : KioskPalette.inkSoft,
                      ),
                    ),
                    Directionality(
                      textDirection: TextDirection.rtl,
                      child: Text(
                        called ? 'يرجى التوجه' : 'متاح',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: subFont * 0.9,
                          fontWeight: FontWeight.w600,
                          height: 1.2,
                          color: called ? Colors.white70 : KioskPalette.inkFaint,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The department the called token belongs to. A parent holding "AC71" needs
/// to know it is the Accounts queue being served, not just that *some* number
/// came up at counter 1 — the board packet carries it per counter
/// (`department_en/ar/color`), it simply was never rendered.
class _DepartmentCell extends StatelessWidget {
  const _DepartmentCell({
    required this.counter,
    required this.color,
    required this.called,
    required this.nameFont,
    required this.subFont,
    required this.scale,
  });

  final BoardCounter counter;
  final Color color;
  final bool called;
  final double nameFont;
  final double subFont;
  final double scale;

  @override
  Widget build(BuildContext context) {
    final en = counter.departmentEn ?? '';
    final ar = counter.departmentAr ?? '';
    if (!called || en.isEmpty) {
      return Text(
        '—',
        style: TextStyle(
          fontSize: nameFont,
          fontWeight: FontWeight.w600,
          color: KioskPalette.inkFaint,
        ),
      );
    }

    return Padding(
      padding: EdgeInsets.only(right: 12 * scale),
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 16 * scale, vertical: 10 * scale),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(14 * scale),
          border: Border.all(color: color.withValues(alpha: 0.35), width: 2 * scale),
        ),
        child: _BilingualCell(
          en: en.toUpperCase(),
          ar: ar,
          nameFont: nameFont,
          subFont: subFont,
          enColor: color,
          arColor: color.withValues(alpha: 0.8),
          enWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _BilingualCell extends StatelessWidget {
  const _BilingualCell({
    required this.en,
    required this.ar,
    required this.nameFont,
    required this.subFont,
    required this.enColor,
    required this.arColor,
    this.enWeight = FontWeight.w700,
  });

  final String en;
  final String ar;
  final double nameFont;
  final double subFont;
  final Color enColor;
  final Color arColor;
  final FontWeight enWeight;

  @override
  Widget build(BuildContext context) {
    // Shrink-to-fit rather than ellipsize. At board type sizes a name like
    // "COUNTER NO 1" only just clears its column, and "COUNTER NO…" on a wall
    // display is worse than the same name a few points smaller — the point of
    // the column is to tell someone where to walk.
    Widget line(String text, TextStyle style) => FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(text, maxLines: 1, style: style),
        );

    return Column(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        line(
          en,
          TextStyle(
            fontSize: nameFont,
            fontWeight: enWeight,
            height: 1.15,
            color: enColor,
          ),
        ),
        if (ar.isNotEmpty)
          Directionality(
            textDirection: TextDirection.rtl,
            child: line(
              ar,
              TextStyle(
                fontSize: subFont,
                fontWeight: FontWeight.w600,
                height: 1.25,
                color: arColor,
              ),
            ),
          ),
      ],
    );
  }
}
