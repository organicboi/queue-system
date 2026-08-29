import 'package:flutter/material.dart';

import '../../../models/board_packet.dart';
import '../../dept_icon.dart';
import '../../theme.dart';

/// The `TOKEN NO. / COUNTER / STATUS` table — one row per **open** counter,
/// not "last N called". A counter must never vanish from the board three
/// calls later just because other counters kept calling (the layout mistake
/// docs/school-queue-plan.md explicitly calls out).
class BoardCounterTable extends StatelessWidget {
  const BoardCounterTable({super.key, required this.counters, required this.scale});

  final List<BoardCounter> counters;
  final double scale;

  @override
  Widget build(BuildContext context) {
    final open = counters.where((c) => c.isOpen).toList()
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _HeaderRow(scale: scale),
        Divider(height: 1, color: KioskPalette.border, thickness: 1 * scale),
        Expanded(
          child: open.isEmpty
              ? Center(
                  child: Text(
                    'No counters open',
                    style: TextStyle(fontSize: 22 * scale, color: KioskPalette.inkFaint),
                  ),
                )
              : ListView.separated(
                  padding: EdgeInsets.symmetric(vertical: 8 * scale),
                  itemCount: open.length,
                  separatorBuilder: (_, _) =>
                      Divider(height: 1, color: KioskPalette.border),
                  itemBuilder: (context, i) => _CounterRow(counter: open[i], scale: scale),
                ),
        ),
      ],
    );
  }
}

class _HeaderRow extends StatelessWidget {
  const _HeaderRow({required this.scale});
  final double scale;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
      fontSize: 18 * scale,
      fontWeight: FontWeight.w700,
      color: KioskPalette.inkSoft,
      letterSpacing: 1.2,
    );
    final subStyle = style.copyWith(fontSize: 13 * scale, letterSpacing: 0);
    Widget col(String en, String ar, {TextAlign align = TextAlign.start}) => Column(
          crossAxisAlignment:
              align == TextAlign.end ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Text(en, style: style, textAlign: align),
            Directionality(
              textDirection: TextDirection.rtl,
              child: Text(ar, style: subStyle, textAlign: align),
            ),
          ],
        );

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 20 * scale, vertical: 14 * scale),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(flex: 4, child: col('TOKEN NO.', 'رقم التذكرة')),
          Expanded(flex: 4, child: col('COUNTER', 'المنضدة')),
          Expanded(flex: 5, child: col('STATUS', 'الحالة', align: TextAlign.end)),
        ],
      ),
    );
  }
}

class _CounterRow extends StatelessWidget {
  const _CounterRow({required this.counter, required this.scale});
  final BoardCounter counter;
  final double scale;

  @override
  Widget build(BuildContext context) {
    final called = counter.isCalled;
    final color = counter.departmentColor != null
        ? departmentColor(counter.departmentColor!)
        : KioskPalette.primary;

    return Container(
      color: called ? color.withValues(alpha: 0.07) : Colors.transparent,
      padding: EdgeInsets.symmetric(horizontal: 20 * scale, vertical: 18 * scale),
      child: Row(
        children: [
          Expanded(
            flex: 4,
            child: Row(
              children: [
                if (counter.isPriority && called)
                  Padding(
                    padding: EdgeInsets.only(right: 8 * scale),
                    child: Icon(Icons.star_rounded, color: color, size: 22 * scale),
                  ),
                Text(
                  called ? counter.tokenCode! : '—',
                  style: TextStyle(
                    fontSize: (36 * scale).clamp(20, 96),
                    fontWeight: FontWeight.w800,
                    fontFeatures: const [FontFeature.tabularFigures()],
                    color: called ? KioskPalette.ink : KioskPalette.inkFaint,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            flex: 4,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  counter.nameEn,
                  style: TextStyle(fontSize: 22 * scale, fontWeight: FontWeight.w600, color: KioskPalette.ink),
                ),
                if (counter.nameAr.isNotEmpty)
                  Directionality(
                    textDirection: TextDirection.rtl,
                    child: Text(
                      counter.nameAr,
                      style: TextStyle(fontSize: 16 * scale, color: KioskPalette.inkSoft),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            flex: 5,
            child: Align(
              alignment: Alignment.centerRight,
              child: Container(
                padding: EdgeInsets.symmetric(horizontal: 14 * scale, vertical: 6 * scale),
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
                      style: TextStyle(
                        fontSize: 16 * scale,
                        fontWeight: FontWeight.w700,
                        color: called ? Colors.white : KioskPalette.inkSoft,
                      ),
                    ),
                    Directionality(
                      textDirection: TextDirection.rtl,
                      child: Text(
                        called ? 'يرجى التوجه' : 'متاح',
                        style: TextStyle(
                          fontSize: 12 * scale,
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
