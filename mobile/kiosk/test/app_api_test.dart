import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_kiosk/src/api/api_exception.dart';
import 'package:school_kiosk/src/api/app_api.dart';
import 'package:school_kiosk/src/config/auth_session.dart';
import 'package:school_kiosk/src/config/device_vertical.dart';

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

ResponseBody _json(Object body, int status) => ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );

Dio _dio(Future<ResponseBody> Function(RequestOptions) respond) => Dio(
      BaseOptions(baseUrl: 'https://x/api/app', validateStatus: (_) => true),
    )..httpClientAdapter = _FakeAdapter(respond);

AuthSession _session({String access = 'a1', String refresh = 'r1'}) => AuthSession(
      accessToken: access,
      refreshToken: refresh,
      expiresAt: DateTime.now().add(const Duration(hours: 1)),
      email: 'op@x.com',
      fullName: 'Op',
      customerName: 'Ruby Hall',
      vertical: DeviceVertical.hospital,
      userRole: 'admin',
    );

void main() {
  test('login parses session / profile / branches / screens', () async {
    final api = AppApi(
      baseUrl: 'https://x',
      currentSession: () => null,
      onSessionRefreshed: (_) async {},
      dio: _dio((o) async => _json({
            'session': {
              'accessToken': 'acc',
              'refreshToken': 'ref',
              'expiresAt': 1893456000,
            },
            'profile': {
              'vertical': 'hospital',
              'role': 'admin',
              'customerName': 'Ruby Hall',
              'fullName': 'Op Erator',
              'email': 'op@x.com',
            },
            'branches': [
              {'id': 'b1', 'name': 'Main', 'branchToken': 'bt1'},
            ],
            'screens': [
              {'id': 's1', 'name': 'Lobby', 'kind': 'hospital', 'branchId': 'b1', 'screenToken': 'st1'},
            ],
            'availableLanguages': ['en', 'mr'],
          }, 200)),
    );

    final r = await api.login(email: 'op@x.com', password: 'secret');
    expect(r.session.accessToken, 'acc');
    expect(r.session.refreshToken, 'ref');
    expect(r.profile.vertical, DeviceVertical.hospital);
    expect(r.branches.single.branchToken, 'bt1');
    expect(r.screensFor(r.branches.single).single.screenToken, 'st1');
    expect(r.availableLanguages, ['en', 'mr']);
  });

  test('bad credentials surface the server message with status 401', () async {
    final api = AppApi(
      baseUrl: 'https://x',
      currentSession: () => null,
      onSessionRefreshed: (_) async {},
      dio: _dio((o) async => _json({'error': 'Invalid email or password.'}, 401)),
    );
    expect(
      () => api.login(email: 'x@y.z', password: 'nope'),
      throwsA(isA<ApiException>()
          .having((e) => e.statusCode, 'statusCode', 401)
          .having((e) => e.message, 'message', 'Invalid email or password.')),
    );
  });

  test('a 401 on getSettings triggers one refresh + retry', () async {
    var session = _session(access: 'stale', refresh: 'r1');
    var settingsCalls = 0;
    var refreshCalls = 0;
    AuthSession? persisted;

    final api = AppApi(
      baseUrl: 'https://x',
      currentSession: () => session,
      onSessionRefreshed: (s) async {
        persisted = s;
        session = s;
      },
      dio: _dio((o) async {
        if (o.path == '/refresh') {
          refreshCalls++;
          return _json({
            'session': {'accessToken': 'fresh', 'refreshToken': 'r2', 'expiresAt': 1893456000},
          }, 200);
        }
        // /settings
        settingsCalls++;
        final auth = o.headers['authorization'];
        if (auth == 'Bearer fresh') {
          return _json({'vertical': 'hospital', 'settings': {'kioskIdleSeconds': 20}, 'availableLanguages': ['en']}, 200);
        }
        return _json({'error': 'Session expired.'}, 401);
      }),
    );

    final result = await api.getSettings(branchId: 'b1');
    expect(refreshCalls, 1);
    expect(settingsCalls, 2);
    expect(persisted?.accessToken, 'fresh');
    expect(result.settings!['kioskIdleSeconds'], 20);
  });

  test('a failed refresh fires onAuthExpired and throws 401', () async {
    var expired = false;
    final api = AppApi(
      baseUrl: 'https://x',
      currentSession: () => _session(),
      onSessionRefreshed: (_) async {},
      onAuthExpired: () => expired = true,
      dio: _dio((o) async {
        if (o.path == '/refresh') return _json({'error': 'gone'}, 401);
        return _json({'error': 'Session expired.'}, 401);
      }),
    );

    await expectLater(
      () => api.provision(),
      throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 401)),
    );
    expect(expired, isTrue);
  });

  test('403 from the settings route surfaces verbatim', () async {
    final api = AppApi(
      baseUrl: 'https://x',
      currentSession: () => _session(),
      onSessionRefreshed: (_) async {},
      dio: _dio((o) async => _json({'error': 'You do not have access to this branch.'}, 403)),
    );
    expect(
      () => api.getSettings(branchId: 'b9'),
      throwsA(isA<ApiException>()
          .having((e) => e.statusCode, 'statusCode', 403)
          .having((e) => e.message, 'message', 'You do not have access to this branch.')),
    );
  });
}
