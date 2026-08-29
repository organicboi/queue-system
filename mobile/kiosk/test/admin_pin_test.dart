import 'package:flutter_test/flutter_test.dart';
import 'package:school_kiosk/src/config/admin_pin.dart';

void main() {
  test('a freshly created PIN verifies against its own hash and salt', () {
    final (hash, salt) = AdminPin.create('4821');
    expect(AdminPin.verify('4821', salt, hash), isTrue);
  });

  test('the wrong PIN does not verify', () {
    final (hash, salt) = AdminPin.create('4821');
    expect(AdminPin.verify('0000', salt, hash), isFalse);
  });

  test('the same PIN with a different salt produces a different hash — '
      'confirms the salt is actually mixed in, not just appended for show', () {
    final (hashA, saltA) = AdminPin.create('1234');
    final (hashB, saltB) = AdminPin.create('1234');
    expect(saltA, isNot(saltB));
    expect(hashA, isNot(hashB));
  });

  test('hashing is deterministic for a given pin+salt pair', () {
    expect(AdminPin.hash('1234', 'fixed-salt'), AdminPin.hash('1234', 'fixed-salt'));
  });
}
