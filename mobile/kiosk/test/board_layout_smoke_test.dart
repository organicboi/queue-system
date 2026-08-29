import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_kiosk/src/models/board_packet.dart';
import 'package:school_kiosk/src/ui/display/widgets/board_counter_table.dart';
import 'package:school_kiosk/src/ui/display/widgets/board_ticker.dart';
import 'package:school_kiosk/src/ui/display/widgets/now_calling_overlay.dart';
import 'package:school_kiosk/src/ui/theme.dart';

BoardCounter counter(int i, {bool called = false}) => BoardCounter(
      id: 'c$i',
      nameEn: 'Counter $i',
      nameAr: 'المنضدة $i',
      displayOrder: i,
      isOpen: true,
      tokenId: called ? 't$i' : null,
      tokenCode: called ? 'A10$i' : null,
      calledAt: called ? '2026-01-01T00:00:00Z' : null,
      recallCount: 0,
      isPriority: i.isEven,
      departmentEn: 'Admissions',
      departmentAr: 'القبول',
      departmentColor: '#2563EB',
    );

/// Mirrors the production MediaQuery override for the board (boardScaleForSize
/// instead of the kiosk's), same idea as layout_smoke_test.dart's `host`.
Widget host(Widget child) => MaterialApp(
      theme: buildKioskTheme(),
      builder: (context, inner) {
        final media = MediaQuery.of(context);
        return MediaQuery(
          data: media.copyWith(textScaler: TextScaler.linear(boardTextScaleForSize(media.size))),
          child: inner!,
        );
      },
      home: Scaffold(body: child),
    );

/// Wraps in a Stack — NowCallingOverlay is a `Positioned.fill`, valid only
/// directly inside a Stack ancestor, matching how board_screen.dart actually
/// uses it.
Widget overlayHost(Widget overlay) => host(Stack(children: [overlay]));

void setViewport(WidgetTester tester, Size size) {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

void main() {
  // A TV board renders bilingual EN/AR labels on every row simultaneously
  // (unlike the kiosk's language *toggle*) — this is what would first
  // overflow if a label got too wide for its cell.
  for (final size in const [Size(1920, 1080), Size(1280, 720), Size(3840, 2160)]) {
    testWidgets('counter table lays out at $size', (tester) async {
      setViewport(tester, size);
      await tester.pumpWidget(host(
        BoardCounterTable(
          counters: [for (var i = 0; i < 6; i++) counter(i, called: i.isEven)],
          scale: boardScaleForSize(size),
        ),
      ));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('now-calling overlay lays out at $size', (tester) async {
      setViewport(tester, size);
      await tester.pumpWidget(overlayHost(
        NowCallingOverlay(counter: counter(1, called: true), onDismiss: () {}),
      ));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('ticker lays out with a long message', (tester) async {
    setViewport(tester, const Size(1920, 1080));
    await tester.pumpWidget(host(
      const BoardTicker(message: 'Welcome to Al Noor School — please have your ID ready.'),
    ));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(tester.takeException(), isNull);
  });

  testWidgets('an empty counter list shows the empty state, not an overflow', (tester) async {
    setViewport(tester, const Size(1920, 1080));
    await tester.pumpWidget(host(BoardCounterTable(counters: const [], scale: 1)));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('No counters open'), findsOneWidget);
  });
}
