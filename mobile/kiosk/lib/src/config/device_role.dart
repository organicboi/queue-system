/// What this physical device is provisioned as. Chosen once during the setup
/// wizard and then locked — see `docs/flutter-kiosk-plan.md` and the
/// multi-role build plan. A device shows exactly one role's UI for its
/// lifetime; changing roles is a deliberate admin action (see AdminGate),
/// never something a visitor can stumble into.
enum DeviceRole {
  /// Self-service ticket dispenser. Branch-token auth. The original app.
  kiosk,

  /// Waiting-area announcement board (TV / monitor). Screen-token auth.
  display,

  /// Thin WebView wrapper around a public web page (join/track). No token —
  /// just a URL.
  web;

  String get storageValue => name;

  static DeviceRole? fromStorage(String? value) {
    for (final role in DeviceRole.values) {
      if (role.name == value) return role;
    }
    return null;
  }

  String get label => switch (this) {
        DeviceRole.kiosk => 'Ticket kiosk',
        DeviceRole.display => 'Announcement display',
        DeviceRole.web => 'Web screen',
      };

  String get description => switch (this) {
        DeviceRole.kiosk =>
          'Visitors tap a department to get a printed queue ticket.',
        DeviceRole.display =>
          'Shows open counters and announces called tokens out loud.',
        DeviceRole.web =>
          'Displays a single web page full-screen (e.g. a join or track link).',
      };
}
