/// Which VibeQueue product this device's branch/screen belongs to. Resolved at
/// pairing time (the `/api/pair` response and the provisioning QR both carry
/// it) and then locked alongside [DeviceRole] — a kiosk paired to a hospital
/// branch opens the hospital kiosk, one paired to a school opens the school
/// kiosk, and the API base path differs (`/api/hospital-kiosk` vs `/api/kiosk`).
///
/// `business` is the default and the fallback for anything unrecognised — the
/// original hotel/restaurant product predates this field, and an old pairing
/// payload with no `vertical` key must keep working exactly as before.
enum DeviceVertical {
  business,
  school,
  hospital;

  String get storageValue => name;

  static DeviceVertical fromStorage(String? value) {
    for (final v in DeviceVertical.values) {
      if (v.name == value) return v;
    }
    return DeviceVertical.business;
  }

  String get label => switch (this) {
        DeviceVertical.business => 'Hotel / Restaurant',
        DeviceVertical.school => 'School',
        DeviceVertical.hospital => 'Hospital',
      };
}
