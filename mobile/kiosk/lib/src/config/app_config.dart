/// Compile-time / behavioural constants. Values that must match the web kiosk
/// are labelled with their source.
class AppConfig {
  AppConfig._();

  /// Prefilled in the setup screen. Set the real deployment URL per build with
  /// `--dart-define=KIOSK_BASE_URL=https://…`; the operator can still edit it.
  /// `10.0.2.2` is the Android emulator's alias for the host's localhost, handy
  /// when testing against `next dev`.
  static const String defaultBaseUrl = String.fromEnvironment(
    'KIOSK_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );

  /// FEED_POLL_MS in components/school/SchoolKiosk.tsx.
  static const Duration feedPollInterval = Duration(seconds: 6);

  /// RECENT_LIMIT in components/school/SchoolKiosk.tsx.
  static const int recentLimit = 30;

  /// How long the just-issued ticket stays shown in the hero area before the
  /// grid returns to the neutral prompt. The web kiosk keeps it until the next
  /// tap; a timeout is friendlier on an unattended terminal.
  static const Duration heroLinger = Duration(seconds: 20);

  /// Backoff for the bootstrap/feed retry loop on network failure — mirrors
  /// MainActivity.kt's reload-on-error in android-kiosk/.
  static const Duration retryInterval = Duration(seconds: 5);
}
