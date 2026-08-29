import 'package:dio/dio.dart';

import '../models/board_packet.dart';
import 'api_exception.dart';

/// Client for `GET /api/display/[screenToken]` — the one route the display
/// role needs. Same framing as [KioskApi] (opaque token in the path,
/// `{error}` body on failure, 404 = unregistered) but a different token type
/// (`screen_token`, not `branch_token`) and a read-only surface: the display
/// never writes anything, calling/recalling stays staff-only on the web.
class DisplayApi {
  DisplayApi({required String baseUrl, required this.screenToken, Dio? dio})
      : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: _normalizeBase(baseUrl),
              connectTimeout: const Duration(seconds: 8),
              receiveTimeout: const Duration(seconds: 10),
              sendTimeout: const Duration(seconds: 10),
              validateStatus: (_) => true,
              headers: {'accept': 'application/json'},
            ));

  final Dio _dio;
  final String screenToken;

  static String _normalizeBase(String raw) {
    final trimmed = raw.trim().replaceAll(RegExp(r'/+$'), '');
    return trimmed.isEmpty ? trimmed : '$trimmed/api/display';
  }

  Future<BoardPacket> fetchBoard() async {
    try {
      final res = await _dio
          .get<dynamic>('/${Uri.encodeComponent(screenToken)}');
      final status = res.statusCode ?? 0;
      final body = res.data;
      final map = body is Map<String, dynamic> ? body : <String, dynamic>{};

      if (status < 200 || status >= 300) {
        throw ApiException(
          map['error'] as String? ?? 'Request failed ($status)',
          statusCode: status,
        );
      }
      return BoardPacket.fromJson(map);
    } on DioException {
      throw ApiException('Cannot reach the queue server. Retrying…', isNetwork: true);
    }
  }
}
