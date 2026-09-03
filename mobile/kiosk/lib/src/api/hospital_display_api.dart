import 'package:dio/dio.dart';

import '../models/hospital/hospital_board_packet.dart';
import 'api_exception.dart';

/// Client for `GET /api/hospital-display/[screenToken]` — the one route the
/// hospital display role needs. Same framing as [DisplayApi] with the hospital
/// board packet shape.
class HospitalDisplayApi {
  HospitalDisplayApi({
    required String baseUrl,
    required this.screenToken,
    Dio? dio,
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
  final String screenToken;

  static String _normalizeBase(String raw) {
    final trimmed = raw.trim().replaceAll(RegExp(r'/+$'), '');
    return trimmed.isEmpty ? trimmed : '$trimmed/api/hospital-display';
  }

  Future<HospitalBoardPacket> fetchBoard() async {
    try {
      final res =
          await _dio.get<dynamic>('/${Uri.encodeComponent(screenToken)}');
      final status = res.statusCode ?? 0;
      final body = res.data;
      final map = body is Map<String, dynamic> ? body : <String, dynamic>{};

      if (status < 200 || status >= 300) {
        throw ApiException(
          map['error'] as String? ?? 'Request failed ($status)',
          statusCode: status,
        );
      }
      return HospitalBoardPacket.fromJson(map);
    } on DioException {
      throw ApiException('Cannot reach the queue server. Retrying…',
          isNetwork: true);
    }
  }
}
