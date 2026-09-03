import 'package:dio/dio.dart';

import '../models/hospital/hospital_kiosk_bootstrap.dart';
import '../models/hospital/hospital_kiosk_feed.dart';
import '../models/hospital/hospital_token.dart';
import 'api_exception.dart';

/// What `POST /tokens` answers with: the committed token, plus how many
/// patients were still ahead of it at that instant. `waitingAhead` is null when
/// the server could not count them — the ticket then prints without that line.
typedef IssuedHospitalToken = ({HospitalToken token, int? waitingAhead});

/// Thin client for the `app/api/hospital-kiosk/[branchToken]/*` route handlers.
/// Same framing as [KioskApi] (opaque branch token in the path, re-verified
/// server-side; `{error}` body on failure; 404 = unregistered) but a different
/// base path and the hospital DTO shapes.
class HospitalKioskApi {
  HospitalKioskApi({
    required String baseUrl,
    required this.branchToken,
    Dio? dio,
    this.onReachability,
  }) : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: _normalizeBase(baseUrl),
              connectTimeout: const Duration(seconds: 8),
              receiveTimeout: const Duration(seconds: 10),
              sendTimeout: const Duration(seconds: 10),
              validateStatus: (_) => true,
              headers: {'accept': 'application/json'},
            ));

  final Dio _dio;
  final String branchToken;
  final void Function(bool reachable)? onReachability;

  static String _normalizeBase(String raw) {
    final trimmed = raw.trim().replaceAll(RegExp(r'/+$'), '');
    return trimmed.isEmpty ? trimmed : '$trimmed/api/hospital-kiosk';
  }

  String get _prefix => '/${Uri.encodeComponent(branchToken)}';

  Future<HospitalKioskBootstrap> bootstrap() async {
    final data = await _get('$_prefix/bootstrap');
    return HospitalKioskBootstrap.fromJson(data);
  }

  Future<HospitalKioskFeed> feed() async {
    final data = await _get('$_prefix/feed');
    return HospitalKioskFeed.fromJson(data);
  }

  Future<IssuedHospitalToken> issueToken({
    required String departmentId,
    String? doctorId,
    String? priorityCategory,
    String? locale,
  }) async {
    final data = await _post('$_prefix/tokens', {
      'departmentId': departmentId,
      if (doctorId != null && doctorId.isNotEmpty) 'doctorId': doctorId,
      if (priorityCategory != null && priorityCategory.isNotEmpty)
        'priorityCategory': priorityCategory,
      if (locale != null && locale.isNotEmpty) 'locale': locale,
    });
    return (
      token: HospitalToken.fromJson(data['token'] as Map<String, dynamic>),
      waitingAhead: (data['waitingAhead'] as num?)?.toInt(),
    );
  }

  // ── transport (identical to KioskApi) ──────────────────────

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
    onReachability?.call(true);
    final status = res.statusCode ?? 0;
    final body = res.data;
    final map = body is Map<String, dynamic> ? body : <String, dynamic>{};
    if (status >= 200 && status < 300) return map;
    throw ApiException(
      map['error'] as String? ?? 'Request failed ($status)',
      statusCode: status,
    );
  }

  ApiException _fromDio(DioException e) {
    if (e.type == DioExceptionType.badResponse && e.response != null) {
      onReachability?.call(true);
      final map = e.response!.data;
      final msg =
          map is Map && map['error'] is String ? map['error'] as String : null;
      return ApiException(msg ?? 'Request failed',
          statusCode: e.response!.statusCode);
    }
    onReachability?.call(false);
    return ApiException('Cannot reach the queue server.', isNetwork: true);
  }
}
