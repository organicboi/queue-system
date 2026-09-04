import 'package:flutter_test/flutter_test.dart';
import 'package:school_kiosk/src/config/auth_session.dart';
import 'package:school_kiosk/src/config/device_vertical.dart';

class _ThrowingStore implements SecureStore {
  @override
  Future<String?> read(String key) async => throw StateError('keystore down');
  @override
  Future<void> write(String key, String value) async {}
  @override
  Future<void> delete(String key) async {}
}

void main() {
  AuthSession sample({DateTime? expiresAt}) => AuthSession(
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresAt: expiresAt ?? DateTime.now().add(const Duration(hours: 1)),
        email: 'op@example.com',
        fullName: 'Op Erator',
        customerName: 'Ruby Hall',
        vertical: DeviceVertical.hospital,
        userRole: 'admin',
      );

  test('save / load round-trip', () async {
    final store = InMemorySecureStore();
    await sample().save(store);
    final loaded = await AuthSession.load(store);
    expect(loaded, isNotNull);
    expect(loaded!.email, 'op@example.com');
    expect(loaded.vertical, DeviceVertical.hospital);
    expect(loaded.refreshToken, 'refresh');
  });

  test('clear removes the session', () async {
    final store = InMemorySecureStore();
    await sample().save(store);
    await AuthSession.clear(store);
    expect(await AuthSession.load(store), isNull);
  });

  test('load returns null on a corrupt blob', () async {
    final store = InMemorySecureStore();
    await store.write('app.authSession', 'not json{');
    expect(await AuthSession.load(store), isNull);
  });

  test('load returns null when the keystore throws', () async {
    expect(await AuthSession.load(_ThrowingStore()), isNull);
  });

  test('isExpired / expiresWithin', () {
    final past = sample(expiresAt: DateTime.now().subtract(const Duration(minutes: 1)));
    expect(past.isExpired, isTrue);

    final soon = sample(expiresAt: DateTime.now().add(const Duration(seconds: 30)));
    expect(soon.isExpired, isFalse);
    expect(soon.expiresWithin(const Duration(minutes: 1)), isTrue);
    expect(soon.expiresWithin(const Duration(seconds: 5)), isFalse);
  });

  test('expiresAtFromSeconds treats the value as unix seconds', () {
    final at = AuthSession.expiresAtFromSeconds(1893456000); // 2030-01-01Z
    expect(at.toUtc().year, 2030);
    // A missing value still yields a near-future expiry, not "never".
    final fallback = AuthSession.expiresAtFromSeconds(null);
    expect(fallback.isAfter(DateTime.now()), isTrue);
    expect(fallback.isBefore(DateTime.now().add(const Duration(hours: 1))), isTrue);
  });
}
