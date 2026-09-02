import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_kiosk/src/i18n/copy.dart';
import 'package:school_kiosk/src/models/school_department.dart';
import 'package:school_kiosk/src/models/school_token.dart';
import 'package:school_kiosk/src/ui/theme.dart';
import 'package:school_kiosk/src/ui/widgets/confirmation_overlay.dart';
import 'package:school_kiosk/src/ui/widgets/department_grid.dart';
import 'package:school_kiosk/src/ui/widgets/kiosk_header.dart';
import 'package:school_kiosk/src/ui/widgets/priority_banner.dart';

SchoolDepartment dept(int i) => SchoolDepartment(
      id: 'd$i',
      customerId: 'c',
      branchId: 'b',
      nameEn: 'Admissions Office $i',
      nameAr: 'مكتب القبول $i',
      prefix: 'A',
      numberStart: 1,
      color: '#2563EB',
      icon: 'GraduationCap',
      isPriority: false,
      displayOrder: i,
      isActive: true,
      createdAt: '',
    );

SchoolToken tok(int i) => SchoolToken(
      id: 't$i',
      customerId: 'c',
      branchId: 'b',
      departmentId: 'd1',
      counterId: null,
      serviceDate: '2026-08-30',
      number: i,
      tokenCode: 'A-00$i',
      publicCode: 'PC$i',
      status: 'waiting',
      isPriority: i.isEven,
      source: 'kiosk',
      transferredFromDepartmentId: null,
      notes: '',
      joinedAt: '2026-08-30T09:41:00.000Z',
      calledAt: null,
      servedAt: null,
      callCount: 0,
      recallCount: 0,
      createdAt: '2026-08-30T09:41:00.000Z',
    );

/// Mirrors the production MediaQuery override in app.dart: OS text scaling is
/// pinned off and replaced with the screen-size-proportional factor, so these
/// tests exercise the same text sizes a real device would render.
Widget host(Widget child, {String lang = 'en'}) => MaterialApp(
      theme: buildKioskTheme(),
      builder: (context, inner) {
        final media = MediaQuery.of(context);
        return MediaQuery(
          data: media.copyWith(
            textScaler: TextScaler.linear(kioskTextScaleForSize(media.size)),
          ),
          child: inner!,
        );
      },
      home: Directionality(
        textDirection: KioskCopy.directionOf(lang),
        child: Scaffold(body: child),
      ),
    );

void main() {
  // The card changes shape twice as it gets shorter — two-line name, one-line
  // name, then a single centred row — and each of those thresholds is a place
  // a card can overflow by a pixel or two on the wrong device. Sweep the whole
  // height range the grid can hand a card, one row at a time, rather than
  // hoping the viewport list happens to land on a boundary.
  for (var h = 100.0; h <= 520.0; h += 10.0) {
    // One department exercises the single-service hero layout, two the
    // ordinary card; both share every density threshold.
    for (final n in const [1, 2]) {
    for (final lang in const ['en', 'ar']) {
      testWidgets('card of height $h holds $n / $lang', (tester) async {
        tester.view.physicalSize = const Size(1366, 768);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(host(
          lang: lang,
          Center(
            child: SizedBox(
              width: 900,
              height: h,
              child: DepartmentGrid(
                departments: [for (var i = 1; i <= n; i++) dept(i)],
                lang: lang,
                waitingByDepartment: const {'d1': 12},
                issuingDeptId: null,
                copy: KioskCopy.of(lang),
                onTap: (_) {},
              ),
            ),
          ),
        ));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      });
    }
    }
  }

  // Many services on a short screen is what forces the grid to its minimum row
  // height — the case where a card has the least room for its own content.
  for (final count in const [1, 2, 4, 6, 9, 12]) {
    for (final vp in const [Size(1000, 420), Size(640, 360), Size(2560, 1440)]) {
    for (final lang in const ['en', 'ar']) {
      testWidgets('grid of $count fits $vp / $lang', (tester) async {
        tester.view.physicalSize = vp;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(host(
          lang: lang,
          Padding(
            padding: const EdgeInsets.all(24),
            child: DepartmentGrid(
              departments: [for (var i = 1; i <= count; i++) dept(i)],
              lang: lang,
              waitingByDepartment: const {'d1': 12},
              issuingDeptId: null,
              copy: KioskCopy.of(lang),
              onTap: (_) {},
            ),
          ),
        ));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      });
    }
    }
  }

  for (final size in const [
    Size(1366, 768),
    Size(1280, 800),
    Size(800, 480),
    Size(1920, 1080),
    Size(2560, 1440),
    Size(1024, 600),
    Size(960, 540),
    Size(2400, 1000), // ultra-wide bar panel
  ]) {
    for (final lang in const ['en', 'ar']) {
      testWidgets('kiosk surfaces lay out at $size / $lang', (tester) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        final copy = KioskCopy.of(lang);
        final depts = [for (var i = 1; i <= 6; i++) dept(i)];

        await tester.pumpWidget(host(
          lang: lang,
          Column(
            children: [
              KioskHeader(
                title: 'Vibe International School',
                logoUrl: '',
                copy: copy,
                languages: const ['en', 'ar'],
                lang: lang,
                onLangChange: (_) {},
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      PriorityBanner(
                        armed: true,
                        onToggle: () {},
                        copy: copy,
                        compact: true,
                      ),
                      const SizedBox(height: 20),
                      Expanded(
                        child: DepartmentGrid(
                          departments: depts,
                          lang: lang,
                          waitingByDepartment: const {'d1': 3},
                          issuingDeptId: null,
                          copy: copy,
                          onTap: (_) {},
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      });

      testWidgets('confirmation overlay lays out at $size / $lang',
          (tester) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(host(
          lang: lang,
          Stack(
            children: [
              ConfirmationOverlay(
                token: tok(7),
                department: dept(1),
                lang: lang,
                copy: KioskCopy.of(lang),
                onDismiss: () {},
              ),
            ],
          ),
        ));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      });
    }
  }
}
