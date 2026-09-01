import 'package:dio/dio.dart';

import '../models/kiosk_bootstrap.dart';
import '../models/kiosk_feed.dart';
import '../models/school_token.dart';
import 'api_exception.dart';

/// What `POST /tokens` answers with: the committed token, plus how many
/// visitors were still ahead of it at that instant. `waitingAhead` is null
/// when the server could not count them — the ticket then prints without that
/// line rather than with a number that isn't true.
typedef IssuedToken = ({SchoolToken token, int? waitingAhead});

/// Thin client for the `app/api/kiosk/[branchToken]/*` route handlers.
///
/// Every call carries the opaque per-branch `branchToken` in the path; the
/// server re-verifies it against the `branches` table on each request (see the
/// existing school actions). The client never sends a branch id.
class KioskApi {
  KioskApi({
    required String baseUrl,
    required this.branchToken,
    Dio? dio,
    this.onReachability,
  })  : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: _normalizeBase(baseUrl),
              connectTimeout: const Duration(seconds: 8),
              receiveTimeout: const Duration(seconds: 10),
              sendTimeout: const Duration(seconds: 10),
              // We validate status ourselves so 4xx bodies are readable.
              validateStatus: (_) => true,
              headers: {'accept': 'application/json'},
            ));

  final Dio _dio;
  final String branchToken;

  /// Called after every request with whether the server actually answered.
  ///
  /// Any HTTP reply counts as reachable — 200, 409, 500 alike — because the
  /// box replied; only a transport failure (no route, DNS, refused, timed out)
  /// is `false`. That distinction is the whole point: it separates "the
  /// building's network is down" from "the server said no", which are the two
  /// things a visitor at a stuck kiosk cannot tell apart on their own.
  final void Function(bool reachable)? onReachability;

  static String _normalizeBase(String raw) {
    final trimmed = raw.trim().replaceAll(RegExp(r'/+$'), '');
    return trimmed.isEmpty ? trimmed : '$trimmed/api/kiosk';
  }

  String get _prefix => '/${Uri.encodeComponent(branchToken)}';

  Future<KioskBootstrap> bootstrap() async {
    final data = await _get('$_prefix/bootstrap');
    return KioskBootstrap.fromJson(data);
  }

  Future<KioskFeed> feed() async {
    final data = await _get('$_prefix/feed');
    return KioskFeed.fromJson(data);
  }

  Future<IssuedToken> issueToken({
    required String departmentId,
    bool isPriority = false,
  }) async {
    final data = await _post('$_prefix/tokens', {
      'departmentId': departmentId,
      'isPriority': isPriority,
    });
    return (
      token: SchoolToken.fromJson(data['token'] as Map<String, dynamic>),
      waitingAhead: (data['waitingAhead'] as num?)?.toInt(),
    );
  }

  /// How many visitors are ahead of an already-issued token, right now. Read
  /// for a reprint from the rail: the queue has moved since the ticket was
  /// first printed, so the count on the original paper is stale.
  ///
  /// Never throws — a reprint must not fail because a count couldn't be read.
  /// Null means "don't print the line".
  Future<int?> waitingAhead(String tokenId) async {
    try {
      final data =
          await _get('$_prefix/tokens/${Uri.encodeComponent(tokenId)}/waiting-ahead');
      return (data['waitingAhead'] as num?)?.toInt();
    } catch (_) {
      return null;
    }
  }

  Future<SchoolToken> cancelToken(String tokenId) async {
    final data = await _post('$_prefix/tokens/${Uri.encodeComponent(tokenId)}/cancel', null);
    return SchoolToken.fromJson(data['token'] as Map<String, dynamic>);
  }

  Future<SchoolToken> setPriority(String tokenId, bool isPriority) async {
    final data = await _post(
      '$_prefix/tokens/${Uri.encodeComponent(tokenId)}/priority',
      {'isPriority': isPriority},
    );
    return SchoolToken.fromJson(data['token'] as Map<String, dynamic>);
  }

  Future<SchoolToken> moveToken(String tokenId, String departmentId) async {
    final data = await _post(
      '$_prefix/tokens/${Uri.encodeComponent(tokenId)}/move',
      {'departmentId': departmentId},
    );
    return SchoolToken.fromJson(data['token'] as Map<String, dynamic>);
  }

  // ── transport ──────────────────────────────────────────────

  Future<Map<String, dynamic>> _get(String path) async {
    try {
      final res = await _dio.get<dynamic>(path);
      return _unwrap(res);
    } on DioException catch (e) {
      throw _fromDio(e);
    }
  }

  Future<Map<String, dynamic>> _post(String path, Object? body) async {
    try {
      final res = await _dio.post<dynamic>(path, data: body);
      return _unwrap(res);
    } on DioException catch (e) {
      throw _fromDio(e);
    }
  }

  Map<String, dynamic> _unwrap(Response<dynamic> res) {
    // We have a response, so the server is up whatever it says in it.
    onReachability?.call(true);
    final status = res.statusCode ?? 0;
    final body = res.data;
    final map = body is Map<String, dynamic> ? body : <String, dynamic>{};

    if (status >= 200 && status < 300) return map;

    final serverMessage = map['error'] as String?;
    throw ApiException(
      serverMessage ?? 'Request failed ($status)',
      statusCode: status,
    );
  }

  ApiException _fromDio(DioException e) {
    if (e.type == DioExceptionType.badResponse && e.response != null) {
      // Shouldn't happen (validateStatus lets everything through), but be safe.
      onReachability?.call(true);
      final map = e.response!.data;
      final msg = map is Map && map['error'] is String ? map['error'] as String : null;
      return ApiException(msg ?? 'Request failed', statusCode: e.response!.statusCode);
    }
    onReachability?.call(false);
    return ApiException(
      'Cannot reach the queue server.',
      isNetwork: true,
    );
  }
}
