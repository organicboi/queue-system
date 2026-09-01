import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_kiosk/src/api/api_exception.dart';
import 'package:school_kiosk/src/api/kiosk_api.dart';
import 'package:school_kiosk/src/state/providers.dart';

/// Stands in for the socket. Either answers with a response — whatever its
/// status — or fails the way a dead network fails.
class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.respond);

  final Future<ResponseBody> Function(RequestOptions options) respond;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) =>
      respond(options);

  @override
  void close({bool force = false}) {}
}

KioskApi apiWith({
  required Future<ResponseBody> Function(RequestOptions) respond,
  required void Function(bool) onReachability,
}) {
  final dio = Dio(BaseOptions(
    baseUrl: 'https://queue.test/api/kiosk',
    validateStatus: (_) => true,
  ))..httpClientAdapter = _FakeAdapter(respond);
  return KioskApi(
    baseUrl: 'https://queue.test',
    branchToken: 'br-token',
    dio: dio,
    onReachability: onReachability,
  );
}

ResponseBody jsonBody(Map<String, dynamic> body, int status) => ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );

void main() {
  group('reachability is reported from what happened on the wire', () {
    test('a successful call says the server is reachable', () async {
      final reports = <bool>[];
      final api = apiWith(
        respond: (_) async => jsonBody({
          'token': {'id': 't1', 'tokenCode': 'A-1'},
          'waitingAhead': 2,
        }, 200),
        onReachability: reports.add,
      );

      final issued = await api.issueToken(departmentId: 'd1');

      expect(issued.token.tokenCode, 'A-1');
      expect(issued.waitingAhead, 2);
      expect(reports, [true]);
    });

    test('a server that refuses the request is still reachable', () async {
      // The distinction the whole feature turns on: 4xx/5xx means the box
      // answered, so the visitor must NOT be told the network is down.
      final reports = <bool>[];
      final api = apiWith(
        respond: (_) async => jsonBody({'error': 'That branch is not active'}, 400),
        onReachability: reports.add,
      );

      await expectLater(
        api.issueToken(departmentId: 'd1'),
        throwsA(isA<ApiException>()
            .having((e) => e.isNetwork, 'isNetwork', false)
            .having((e) => e.message, 'message', 'That branch is not active')),
      );
      expect(reports, [true]);
    });

    test('a dead network reports unreachable and is flagged as network', () async {
      final reports = <bool>[];
      final api = apiWith(
        respond: (options) async => throw DioException.connectionError(
          requestOptions: options,
          reason: 'No route to host',
        ),
        onReachability: reports.add,
      );

      await expectLater(
        api.issueToken(departmentId: 'd1'),
        throwsA(isA<ApiException>().having((e) => e.isNetwork, 'isNetwork', true)),
      );
      expect(reports, [false]);
    });

    test('the reprint count lookup never throws, offline or not', () async {
      final reports = <bool>[];
      final api = apiWith(
        respond: (options) async => throw DioException.connectionError(
          requestOptions: options,
          reason: 'No route to host',
        ),
        onReachability: reports.add,
      );

      expect(await api.waitingAhead('t1'), isNull);
      expect(reports, [false]);
    });
  });

  group('ServerLink', () {
    test('starts optimistic, then follows the wire in both directions', () {
      final container = ProviderContainer.test();
      final link = container.read(serverLinkProvider.notifier);

      expect(container.read(serverLinkProvider), ServerLink.online);

      link.report(reachable: false);
      expect(container.read(serverLinkProvider), ServerLink.offline);

      // Recovery needs nothing but one call that lands — this is what the
      // 6-second feed poll does on its own while the banner is up.
      link.report(reachable: true);
      expect(container.read(serverLinkProvider), ServerLink.online);
    });
  });
}
