import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:school_kiosk/src/api/hospital_kiosk_api.dart';
import 'package:school_kiosk/src/api/pair_api.dart';
import 'package:school_kiosk/src/config/device_config.dart';
import 'package:school_kiosk/src/config/device_role.dart';
import 'package:school_kiosk/src/config/device_vertical.dart';
import 'package:school_kiosk/src/config/provisioning_qr.dart';
import 'package:school_kiosk/src/models/hospital/hospital_board_packet.dart';
import 'package:school_kiosk/src/models/hospital/hospital_kiosk_bootstrap.dart';
import 'package:school_kiosk/src/models/hospital/hospital_kiosk_feed.dart';
import 'package:school_kiosk/src/printing/printer_settings.dart';
import 'package:school_kiosk/src/printing/ticket_widget.dart';
import 'package:school_kiosk/src/ui/theme.dart';

class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.respond);
  final Future<ResponseBody> Function(RequestOptions options) respond;
  @override
  Future<ResponseBody> fetch(
          RequestOptions options, Stream<Uint8List>? stream, Future<void>? c) =>
      respond(options);
  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('hospital models', () {
    test('HospitalKioskBootstrap parses departments, doctors and settings', () {
      final b = HospitalKioskBootstrap.fromJson({
        'branchId': 'br-1',
        'branchName': 'Ruby Hall',
        'serviceDate': '2026-09-10',
        'departments': [
          {
            'id': 'd1',
            'name': {'en': 'General Medicine', 'hi': 'सामान्य चिकित्सा'},
            'prefix': 'G',
            'type': 'opd',
            'color': '#0EA5E9',
            'icon': 'Stethoscope',
            'displayOrder': 1,
            'isActive': true,
          },
          {
            'id': 'd2',
            'name': {'en': 'Registration'},
            'prefix': 'R',
            'type': 'triage',
            'color': '#6366F1',
            'icon': 'UserPlus',
            'displayOrder': 0,
            'isActive': true,
          },
        ],
        'doctors': [
          {
            'id': 'doc1',
            'name': 'Dr. Sharma',
            'departmentId': 'd1',
            'specialization': 'Physician',
            'feePaise': 30000,
          }
        ],
        'settings': {
          'hospitalName': {'en': 'Ruby Hall Clinic'},
          'languages': ['en', 'hi'],
          'priorityEnabled': true,
          'printEnabled': true,
          'kioskIdleSeconds': 25,
        },
        'publicTrackingEnabled': true,
        'publicBaseUrl': 'https://q.example',
      });

      expect(b.hospitalName('hi'), 'Ruby Hall Clinic');
      expect(b.departments.length, 2);
      expect(b.departments.first.nameFor('hi'), 'सामान्य चिकित्सा');
      expect(b.doctorsFor('d1').single.name, 'Dr. Sharma');
      expect(b.doctorsFor('d1').single.feeRupees, 300);
      expect(b.languages, ['en', 'hi']);
      expect(b.settings?.kioskIdleSeconds, 25);
    });

    test('HospitalKioskFeed reads per-department depth', () {
      final f = HospitalKioskFeed.fromJson({
        'status': 'ok',
        'serviceDate': '2026-09-10',
        'waitingByDepartment': {'d1': 3, 'd2': 0},
        'waitingTotal': 3,
        'issuedToday': 12,
      });
      expect(f.waitingFor('d1'), 3);
      expect(f.waitingFor('missing'), 0);
      expect(f.issuedToday, 12);
    });

    test('HospitalBoardPacket parses snake_case room rows + announce fields', () {
      final p = HospitalBoardPacket.fromJson({
        'status': 'ok',
        'branchId': 'br-1',
        'hospitalName': 'Ruby Hall',
        'announcementLang': 'both',
        'announceLocales': ['en', 'hi', 'mr'],
        'announceEnabled': true,
        'announceTemplateI18n': {'en': 'Token {token} to {room}'},
        'showClock': true,
        'rooms': [
          {
            'id': 'r1',
            'label': 'Room 4',
            'display_order': 1,
            'is_open': true,
            'department_name': {'en': 'General Medicine'},
            'department_color': '#0EA5E9',
            'doctor_name': 'Dr. Sharma',
            'token_id': 't1',
            'token_code': 'G104',
            'recall_count': 0,
          }
        ],
        'recent': [
          {'token_code': 'G103', 'served_at': '2026-09-10T09:00:00Z', 'room_label': 'Room 4'}
        ],
        'departments': [
          {'id': 'd1', 'name_en': 'General Medicine', 'color': '#0EA5E9', 'type': 'opd', 'display_order': 1, 'waiting': 2}
        ],
        'ads': [],
        'tickers': [],
      });

      expect(p.isOk, true);
      expect(p.rooms.single.tokenCode, 'G104');
      expect(p.rooms.single.callKey, 'r1:t1:0');
      expect(p.rooms.single.isCalled, true);
      expect(p.announceLocalesResolved, ['en', 'hi', 'mr']);
      expect(p.departments.single.waiting, 2);
    });
  });

  group('vertical plumbing', () {
    setUp(() => SharedPreferences.setMockInitialValues({}));

    test('DeviceConfig round-trips vertical', () async {
      const cfg = DeviceConfig(
        baseUrl: 'https://example.com',
        role: DeviceRole.kiosk,
        vertical: DeviceVertical.hospital,
        setupComplete: true,
        branchToken: 'tok',
        screenToken: '',
        webUrl: '',
        adminPinHash: null,
        adminPinSalt: null,
        adminPinLength: 4,
        printer: PrinterSettings(),
      );
      await cfg.save();
      final loaded = await DeviceConfig.load();
      expect(loaded.vertical, DeviceVertical.hospital);
    });

    test('DeviceConfig defaults to business and clearProvisioning wipes vertical',
        () async {
      SharedPreferences.setMockInitialValues({
        'kiosk.baseUrl': 'https://x',
        'device.role': 'kiosk',
        'device.vertical': 'hospital',
        'kiosk.branchToken': 'tok',
        'device.setupComplete': true,
      });
      expect((await DeviceConfig.load()).vertical, DeviceVertical.hospital);
      await DeviceConfig.clearProvisioning();
      expect((await DeviceConfig.load()).vertical, DeviceVertical.business);
    });

    test('ProvisioningPayload parses vertical, defaults to business', () {
      final withV = ProvisioningPayload.tryParse(jsonEncode({
        'v': 1,
        'baseUrl': 'https://x',
        'role': 'kiosk',
        'token': 'abc',
        'vertical': 'hospital',
      }));
      expect(withV?.vertical, DeviceVertical.hospital);

      final legacy = ProvisioningPayload.tryParse(jsonEncode({
        'v': 1,
        'baseUrl': 'https://x',
        'role': 'display',
        'token': 'abc',
      }));
      expect(legacy?.vertical, DeviceVertical.business);
    });

    test('PairApi.redeem reads vertical from the response', () async {
      final api = PairApi(
        baseUrl: 'https://x',
        dio: Dio(BaseOptions(baseUrl: 'https://x'))
          ..httpClientAdapter = _FakeAdapter((options) async {
            return ResponseBody.fromString(
              jsonEncode({
                'role': 'kiosk',
                'token': 'realtoken',
                'name': 'Ruby Hall',
                'vertical': 'hospital',
              }),
              200,
              headers: {
                Headers.contentTypeHeader: [Headers.jsonContentType],
              },
            );
          }),
      );
      final result = await api.redeem('123456');
      expect(result.vertical, DeviceVertical.hospital);
      expect(result.token, 'realtoken');
    });
  });

  group('hospital kiosk API', () {
    test('bootstrap hits /api/hospital-kiosk and parses', () async {
      late String path;
      final api = HospitalKioskApi(
        baseUrl: 'https://x',
        branchToken: 'br-tok',
        dio: Dio(BaseOptions(baseUrl: 'https://x/api/hospital-kiosk'))
          ..httpClientAdapter = _FakeAdapter((options) async {
            path = options.path;
            return ResponseBody.fromString(
              jsonEncode({'branchId': 'b1', 'branchName': 'Ruby Hall'}),
              200,
              headers: {
                Headers.contentTypeHeader: [Headers.jsonContentType],
              },
            );
          }),
      );
      final b = await api.bootstrap();
      expect(path, contains('/br-tok/bootstrap'));
      expect(b.branchName, 'Ruby Hall');
    });
  });

  testWidgets('hospital ticket renders LTR secondary + doctor line', (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: buildKioskTheme(),
      home: Scaffold(
        body: SingleChildScrollView(
          child: buildTicketWidget(
            data: TicketData(
              schoolNameEn: 'रुबी हॉल',
              schoolNameAr: 'Ruby Hall',
              secondaryDir: TextDirection.ltr,
              builtinArabicStrings: false,
              tokenCode: 'G104',
              departmentNameEn: 'सामान्य चिकित्सा',
              departmentNameAr: 'General Medicine',
              doctorLine: 'Dr. Sharma',
              isPriority: true,
              footerEn: 'धन्यवाद',
              footerAr: 'Thank you',
              issuedAt: DateTime(2026, 9, 10, 9, 30),
              waitingAhead: 2,
              publicUrl: 'https://q.example/t/abc123',
            ),
            widthDots: 576,
          ),
        ),
      ),
    ));
    await tester.pump();
    expect(find.text('Dr. Sharma'), findsOneWidget);
    expect(find.text('G104'), findsOneWidget);
    // The built-in Arabic QR caption must be absent for a hospital ticket.
    expect(find.text('امسح لمتابعة دورك'), findsNothing);
    expect(find.text('Scan to track your turn'), findsOneWidget);
  });
}
