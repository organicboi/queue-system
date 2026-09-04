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
import 'package:school_kiosk/src/state/app_auth_providers.dart';
import 'package:school_kiosk/src/state/providers.dart';
import 'package:school_kiosk/src/ui/setup/setup_wizard.dart';

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

AppApi _fakeApi(String baseUrl) {
  final dio = Dio(BaseOptions(baseUrl: '$baseUrl/api/app', validateStatus: (_) => true))
    ..httpClientAdapter = _FakeAdapter((o) async => ResponseBody.fromString(
          jsonEncode({
            'session': {'accessToken': 'a', 'refreshToken': 'r', 'expiresAt': 1893456000},
            'profile': {
              'vertical': 'hospital',
              'role': 'admin',
              'customerName': 'Ruby Hall',
              'fullName': 'Op',
              'email': 'op@ruby.test',
            },
            'branches': [
              {'id': 'b1', 'name': 'Main Campus', 'branchToken': 'bt1'},
            ],
            'screens': const [],
            'availableLanguages': ['en'],
          }),
          200,
          headers: {
            Headers.contentTypeHeader: [Headers.jsonContentType],
          },
        ));
  return AppApi(
    baseUrl: baseUrl,
    currentSession: () => null,
    onSessionRefreshed: (_) async {},
    dio: dio,
  );
}

class _FakeConfigController extends DeviceConfigController {
  @override
  Future<DeviceConfig> build() async => DeviceConfig.load();
}

void main() {
  testWidgets('sign-in step drives the wizard and never shows a product picker',
      (tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          secureStoreProvider.overrideWithValue(InMemorySecureStore()),
          deviceConfigProvider.overrideWith(_FakeConfigController.new),
          appApiFactoryProvider.overrideWithValue(_fakeApi),
        ],
        child: const MaterialApp(home: SetupWizard()),
      ),
    );
    await tester.pumpAndSettle();

    // Step 1: Server — a default URL is prefilled, move on.
    expect(find.text('Server'), findsWidgets);
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();

    // Step 2: Sign in.
    expect(find.text('Sign in'), findsWidgets);
    await tester.enterText(find.widgetWithText(TextField, 'Email'), 'op@ruby.test');
    await tester.enterText(find.widgetWithText(TextField, 'Password'), 'secret');
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Signed in as op@ruby.test'), findsOneWidget);

    // Advance to Role, then Facility — the product came from the account, so
    // there is no "Product" / vertical dropdown anywhere.
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    expect(find.text('What is this screen?'), findsOneWidget);
    await tester.tap(find.text('Ticket kiosk'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();

    expect(find.text('Which facility?'), findsOneWidget);
    expect(find.textContaining('Product: Hospital'), findsOneWidget);
    expect(find.text('Product'), findsNothing);

    // The facility dropdown is populated from the sign-in response.
    await tester.tap(find.byType(DropdownButtonFormField<AppBranch>));
    await tester.pumpAndSettle();
    expect(find.text('Main Campus'), findsWidgets);
  });
}
