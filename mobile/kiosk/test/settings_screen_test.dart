import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:school_kiosk/src/api/app_api.dart';
import 'package:school_kiosk/src/config/auth_session.dart';
import 'package:school_kiosk/src/config/device_config.dart';
import 'package:school_kiosk/src/config/device_role.dart';
import 'package:school_kiosk/src/config/device_vertical.dart';
import 'package:school_kiosk/src/printing/printer_settings.dart';
import 'package:school_kiosk/src/state/app_auth_providers.dart';
import 'package:school_kiosk/src/state/providers.dart';
import 'package:school_kiosk/src/ui/settings/settings_screen.dart';

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

class _Cfg extends DeviceConfigController {
  _Cfg(this._c);
  final DeviceConfig _c;
  @override
  Future<DeviceConfig> build() async => _c;
}

DeviceConfig _config(DeviceVertical vertical) => DeviceConfig(
      baseUrl: 'https://example.test',
      role: DeviceRole.display,
      vertical: vertical,
      setupComplete: true,
      branchToken: '',
      branchId: 'b1',
      screenToken: 'st1',
      webUrl: '',
      adminPinHash: null,
      adminPinSalt: null,
      adminPinLength: 4,
      printer: const PrinterSettings(),
    );

AppApi _settingsApi(DeviceVertical vertical, AuthSession session) {
  final dio = Dio(BaseOptions(
      baseUrl: 'https://example.test/api/app', validateStatus: (_) => true))
    ..httpClientAdapter = _FakeAdapter((o) async => ResponseBody.fromString(
          jsonEncode({
            'vertical': vertical.storageValue,
            'settings': {'kioskIdleSeconds': 20, 'priorityEnabled': true},
            'availableLanguages': ['en'],
          }),
          200,
          headers: {
            Headers.contentTypeHeader: [Headers.jsonContentType],
          },
        ));
  return AppApi(
    baseUrl: 'https://example.test',
    currentSession: () => session,
    onSessionRefreshed: (_) async {},
    dio: dio,
  );
}

Future<void> _pump(WidgetTester tester, {required DeviceVertical vertical}) async {
  SharedPreferences.setMockInitialValues({});
  final store = InMemorySecureStore();
  final session = AuthSession(
    accessToken: 'a',
    refreshToken: 'r',
    expiresAt: DateTime.now().add(const Duration(hours: 1)),
    email: 'op@ruby.test',
    fullName: 'Op',
    customerName: 'Ruby Hall',
    vertical: vertical,
    userRole: 'admin',
  );
  await session.save(store);

  tester.view.physicalSize = const Size(1200, 4000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        secureStoreProvider.overrideWithValue(store),
        deviceConfigProvider.overrideWith(() => _Cfg(_config(vertical))),
        appApiProvider.overrideWithValue(_settingsApi(vertical, session)),
      ],
      child: const MaterialApp(home: SettingsScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('renders the account + sign-out and hospital field set',
      (tester) async {
    await _pump(tester, vertical: DeviceVertical.hospital);

    expect(find.text('op@ruby.test'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'Sign out'), findsOneWidget);
    expect(find.text('Priority grace (min)'), findsOneWidget);
    expect(find.text('Free follow-up days'), findsOneWidget);
  });

  testWidgets('school vertical does not show the hospital-only fields',
      (tester) async {
    await _pump(tester, vertical: DeviceVertical.school);

    expect(find.text('Kiosk idle seconds'), findsOneWidget);
    expect(find.text('Priority grace (min)'), findsNothing);
    expect(find.text('Patient data retention (days)'), findsNothing);
  });
}
