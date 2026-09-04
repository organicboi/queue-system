import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'device_vertical.dart';

/// A tiny key/value store abstraction so tests can inject an in-memory fake
/// instead of hitting the platform keystore.
abstract class SecureStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class FlutterSecureStorageStore implements SecureStore {
  FlutterSecureStorageStore([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

class InMemorySecureStore implements SecureStore {
  final Map<String, String> _map = {};

  @override
  Future<String?> read(String key) async => _map[key];

  @override
  Future<void> write(String key, String value) async => _map[key] = value;

  @override
  Future<void> delete(String key) async => _map.remove(key);
}

/// The operator's Supabase session plus the profile summary the UI shows. Stored
/// as one JSON blob in secure storage. It is **only** needed to (re)provision
/// the device and to edit tenant settings — a kiosk/board keeps running on its
/// long branch/screen token after this lapses, so every read path treats a
/// missing or expired session as "not signed in", never as an error.
class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresAt,
    required this.email,
    required this.fullName,
    required this.customerName,
    required this.vertical,
    required this.userRole,
  });

  final String accessToken;
  final String refreshToken;

  /// Absolute expiry of [accessToken]. The server sends unix **seconds**.
  final DateTime expiresAt;

  final String email;
  final String fullName;
  final String customerName;
  final DeviceVertical vertical;
  final String userRole;

  bool get isExpired => DateTime.now().isAfter(expiresAt);

  bool expiresWithin(Duration window) =>
      DateTime.now().add(window).isAfter(expiresAt);

  AuthSession copyWith({
    String? accessToken,
    String? refreshToken,
    DateTime? expiresAt,
  }) {
    return AuthSession(
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
      expiresAt: expiresAt ?? this.expiresAt,
      email: email,
      fullName: fullName,
      customerName: customerName,
      vertical: vertical,
      userRole: userRole,
    );
  }

  Map<String, dynamic> toJson() => {
        'accessToken': accessToken,
        'refreshToken': refreshToken,
        'expiresAt': expiresAt.toIso8601String(),
        'email': email,
        'fullName': fullName,
        'customerName': customerName,
        'vertical': vertical.storageValue,
        'userRole': userRole,
      };

  static AuthSession fromJson(Map<String, dynamic> j) => AuthSession(
        accessToken: j['accessToken'] as String,
        refreshToken: j['refreshToken'] as String,
        expiresAt: DateTime.parse(j['expiresAt'] as String),
        email: (j['email'] as String?) ?? '',
        fullName: (j['fullName'] as String?) ?? '',
        customerName: (j['customerName'] as String?) ?? '',
        vertical: DeviceVertical.fromStorage(j['vertical'] as String?),
        userRole: (j['userRole'] as String?) ?? '',
      );

  /// Convert a server `expires_at` (unix seconds, may be null) to an absolute
  /// time. Falls back to a short window so a missing value forces an early
  /// refresh rather than a session that never expires.
  static DateTime expiresAtFromSeconds(Object? seconds) {
    if (seconds is num) {
      return DateTime.fromMillisecondsSinceEpoch((seconds * 1000).round());
    }
    return DateTime.now().add(const Duration(minutes: 5));
  }

  static const _kKey = 'app.authSession';

  /// Returns `null` on any failure — no session, a corrupt blob, or a keystore
  /// that throws. The device must keep working without one.
  static Future<AuthSession?> load(SecureStore store) async {
    try {
      final raw = await store.read(_kKey);
      if (raw == null || raw.isEmpty) return null;
      return fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> save(SecureStore store) =>
      store.write(_kKey, jsonEncode(toJson()));

  static Future<void> clear(SecureStore store) => store.delete(_kKey);
}
