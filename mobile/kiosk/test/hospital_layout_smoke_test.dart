import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_kiosk/src/i18n/hospital_copy.dart';
import 'package:school_kiosk/src/models/hospital/hospital_department.dart';
import 'package:school_kiosk/src/models/hospital/hospital_doctor.dart';
import 'package:school_kiosk/src/models/hospital/hospital_token.dart';
import 'package:school_kiosk/src/ui/hospital/hospital_token_view.dart';
import 'package:school_kiosk/src/ui/theme.dart';

/// The token screen is the one hospital surface with no ceiling on its own
/// size: the numeral scales off the viewport height and two cards sit side by
/// side above a certain width. Both of those are places a layout stops fitting
/// on the wrong panel, so sweep the sizes the app actually runs on — the
/// deployed 1366×768 terminal, the budget panels, and the dev phone in both
/// orientations — in every script the kiosk speaks.
HospitalDepartment dept({String name = 'General Medicine OPD'}) =>
    HospitalDepartment.fromJson({
      'id': 'd1',
      'name': {'en': name, 'hi': 'सामान्य चिकित्सा ओपीडी', 'mr': name, 'ar': 'الطب العام'},
      'prefix': 'GM',
      'type': 'opd',
      'color': '#0F766E',
      'icon': 'Stethoscope',
      'displayOrder': 1,
      'isActive': true,
    });

HospitalDoctor doctor() => HospitalDoctor.fromJson({
      'id': 'doc1',
      'departmentId': 'd1',
      'name': 'Dr. Anjali Deshmukh',
      'specialization': 'MBBS, MD (Internal Medicine)',
      'feePaise': 30000,
      'isActive': true,
    });

HospitalToken token({String? priority}) => HospitalToken.fromJson({
      'id': 't1',
      'departmentId': 'd1',
      'serviceDate': '2026-09-04',
      'number': 42,
      'tokenCode': 'GM-042',
      'stage': 'consult',
      'status': 'waiting',
      'priorityCategory': priority,
      'publicCode': 'ABC123',
      'joinedAt': '2026-09-04T09:41:00.000Z',
    });

/// Mirrors the production MediaQuery override in app.dart: OS text scaling is
/// pinned off and replaced with the screen-size-proportional factor, so these
/// tests render the same text sizes a real device would.
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
        textDirection: HospitalCopy.directionOf(lang),
        child: Scaffold(body: child),
      ),
    );

void main() {
  for (final size in const [
    Size(1366, 768), // the deployed terminal
    Size(1280, 800),
    Size(1920, 1080),
    Size(1024, 600), // budget panel
    Size(800, 480), // small panel
    Size(2400, 1080), // dev phone, landscape
    Size(1080, 2400), // dev phone, portrait
  ]) {
    for (final lang in const ['en', 'hi', 'mr', 'ar']) {
      // With and without a QR: the QR card is what turns one centred card into
      // a two-card row, and it is gated per branch.
      for (final url in <String?>[null, 'https://q.example.com/t/ABC123']) {
        final withQr = url == null ? 'no QR' : 'with QR';
        testWidgets('token screen lays out at $size / $lang / $withQr',
            (tester) async {
          tester.view.physicalSize = size;
          tester.view.devicePixelRatio = 1.0;
          addTearDown(tester.view.reset);

          await tester.pumpWidget(host(
            lang: lang,
            HospitalTokenView(
              hero: HospitalIssuedToken(
                token: token(priority: 'senior'),
                department: dept(),
                doctor: doctor(),
                waitingAhead: 7,
                publicUrl: url,
              ),
              lang: lang,
              copy: HospitalCopy.of(lang),
              linger: const Duration(seconds: 20),
              onDismiss: () {},
            ),
          ));
          await tester.pump(const Duration(milliseconds: 400));
          expect(tester.takeException(), isNull);
        });
      }
    }
  }

  testWidgets('the button and a tap anywhere both end the screen',
      (tester) async {
    tester.view.physicalSize = const Size(1366, 768);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    var dismissed = 0;
    await tester.pumpWidget(host(
      HospitalTokenView(
        hero: HospitalIssuedToken(
          token: token(),
          department: dept(),
          doctor: null,
          waitingAhead: null,
          publicUrl: null,
        ),
        lang: 'en',
        copy: HospitalCopy.en,
        linger: const Duration(seconds: 20),
        onDismiss: () => dismissed++,
      ),
    ));
    await tester.pump(const Duration(milliseconds: 400));

    await tester.tap(find.text(HospitalCopy.en.nextPatient));
    expect(dismissed, 1);

    // Anywhere else on the screen, for the patient who has already read it.
    await tester.tapAt(const Offset(40, 40));
    expect(dismissed, 2);
  });

  testWidgets('a token with no doctor, no priority and no count still holds',
      (tester) async {
    tester.view.physicalSize = const Size(800, 480);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(host(
      HospitalTokenView(
        hero: HospitalIssuedToken(
          token: token(),
          department: dept(name: 'Registration'),
          doctor: null,
          waitingAhead: null,
          publicUrl: null,
        ),
        lang: 'en',
        copy: HospitalCopy.en,
        linger: const Duration(seconds: 20),
        onDismiss: () {},
      ),
    ));
    await tester.pump(const Duration(milliseconds: 400));
    expect(tester.takeException(), isNull);
    expect(find.text('GM-042'), findsOneWidget);
  });
}
