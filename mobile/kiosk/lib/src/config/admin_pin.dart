import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';

/// Hashing for the settings-re-entry PIN (see AdminGate). Never store the PIN
/// itself — only a salted hash, so a `shared_preferences` backup/leak doesn't
/// hand out the PIN in plaintext.
class AdminPin {
  AdminPin._();

  static String _randomSalt() {
    final rand = Random.secure();
    final bytes = List<int>.generate(16, (_) => rand.nextInt(256));
    return base64UrlEncode(bytes);
  }

  static String hash(String pin, String salt) {
    final digest = sha256.convert(utf8.encode('$salt:$pin'));
    return digest.toString();
  }

  /// Returns (hash, salt) for a freshly-chosen PIN.
  static (String hash, String salt) create(String pin) {
    final salt = _randomSalt();
    return (hash(pin, salt), salt);
  }

  static bool verify(String pin, String salt, String expectedHash) {
    return hash(pin, salt) == expectedHash;
  }
}
