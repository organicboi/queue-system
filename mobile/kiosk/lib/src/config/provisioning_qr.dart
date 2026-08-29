import 'dart:convert';

import 'device_role.dart';

/// Payload encoded in the provisioning QR shown on the web admin's Screens
/// page (`components/school/SchoolScreensManager.tsx`) — scanning it fills
/// in the server URL, role, and token in one step instead of three manual
/// entries. Version-tagged so a future field addition doesn't silently
/// misparse an old QR still printed on a sticker somewhere.
class ProvisioningPayload {
  const ProvisioningPayload({
    required this.baseUrl,
    required this.role,
    required this.token,
  });

  final String baseUrl;
  final DeviceRole role;
  final String token;

  static ProvisioningPayload? tryParse(String raw) {
    try {
      final map = jsonDecode(raw) as Map<String, dynamic>;
      if (map['v'] != 1) return null;
      final role = DeviceRole.fromStorage(map['role'] as String?);
      final baseUrl = map['baseUrl'] as String?;
      final token = map['token'] as String?;
      if (role == null || baseUrl == null || token == null) return null;
      if (baseUrl.trim().isEmpty || token.trim().isEmpty) return null;
      return ProvisioningPayload(baseUrl: baseUrl, role: role, token: token);
    } catch (_) {
      return null;
    }
  }
}
