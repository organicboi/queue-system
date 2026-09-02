import 'school_department.dart';
import 'school_settings.dart';

/// Response of `GET /api/kiosk/[branchToken]/bootstrap`.
/// Mirrors the inline `SchoolKioskPacket` type in lib/dal/school.ts.
class KioskBootstrap {
  const KioskBootstrap({
    required this.branchId,
    required this.branchName,
    required this.customerId,
    required this.departments,
    required this.settings,
    required this.silentPrint,
    required this.printerName,
    required this.publicTrackingEnabled,
    required this.publicBaseUrl,
  });

  final String branchId;
  final String branchName;
  final String customerId;
  final List<SchoolDepartment> departments;

  /// Null when the branch has no `school_settings` row yet.
  final SchoolSettings? settings;

  /// Informational only — the app manages its own printer connection. Returned
  /// for parity with the web kiosk.
  final bool silentPrint;
  final String printerName;

  /// Effective public-tracking gate (distributor grant AND the school's own
  /// switch) — mirrors lib/dal/school-limits.ts#getSchoolPublicTrackingEnabled.
  /// Gates whether the printed ticket carries a QR at all.
  final bool publicTrackingEnabled;

  /// The origin the QR points at. Not `KioskApi`'s own base URL — that can be
  /// a LAN/internal address this device reaches but a visitor's own phone
  /// cannot. See lib/school/constants.ts#publicTrackingBaseUrl on the server.
  final String publicBaseUrl;

  List<String> get languages =>
      settings?.languages.isNotEmpty == true ? settings!.languages : const ['en'];

  factory KioskBootstrap.fromJson(Map<String, dynamic> json) {
    return KioskBootstrap(
      branchId: json['branchId'] as String? ?? '',
      branchName: json['branchName'] as String? ?? '',
      customerId: json['customerId'] as String? ?? '',
      departments: (json['departments'] as List<dynamic>?)
              ?.map((e) => SchoolDepartment.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      settings: json['settings'] == null
          ? null
          : SchoolSettings.fromJson(json['settings'] as Map<String, dynamic>),
      silentPrint: json['silentPrint'] as bool? ?? false,
      printerName: json['printerName'] as String? ?? '',
      publicTrackingEnabled: json['publicTrackingEnabled'] as bool? ?? false,
      publicBaseUrl: json['publicBaseUrl'] as String? ?? '',
    );
  }
}
