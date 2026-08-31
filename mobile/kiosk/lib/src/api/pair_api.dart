import 'package:dio/dio.dart';

import '../config/device_role.dart';
import 'api_exception.dart';

/// Result of redeeming a pairing code: the role the code was minted for and
/// the real long token the device stores and uses from now on.
class PairingResult {
  const PairingResult({required this.role, required this.token, required this.name});

  final DeviceRole role;
  final String token;
  final String name;
}

/// Client for `POST /api/pair` — swaps the dashboard's short-lived 6-digit
/// code for the branch/screen's real `branch_token` / `screen_token`. Used
/// once, from the setup wizard's Pair step; every call after provisioning goes
/// through [KioskApi] / [DisplayApi] with the token this returns.
class PairApi {
  PairApi({required String baseUrl, Dio? dio})
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

  static String _normalizeBase(String raw) => raw.trim().replaceAll(RegExp(r'/+$'), '');

  Future<PairingResult> redeem(String code) async {
    try {
      final res = await _dio.post<dynamic>('/api/pair', data: {'code': code.trim()});
      final status = res.statusCode ?? 0;
      final body = res.data;
      final map = body is Map<String, dynamic> ? body : <String, dynamic>{};

      if (status < 200 || status >= 300) {
        throw ApiException(
          map['error'] as String? ?? 'Request failed ($status)',
          statusCode: status,
        );
      }

      final role = DeviceRole.fromStorage(map['role'] as String?);
      final token = map['token'] as String?;
      if (role == null || token == null || token.trim().isEmpty) {
        throw ApiException('The server sent an unexpected response.');
      }
      return PairingResult(
        role: role,
        token: token.trim(),
        name: (map['name'] as String?)?.trim() ?? '',
      );
    } on DioException {
      throw ApiException('Cannot reach the queue server.', isNetwork: true);
    }
  }
}
