import 'hospital_department.dart';
import 'hospital_doctor.dart';
import 'hospital_settings.dart';

/// Response of `GET /api/hospital-kiosk/[branchToken]/bootstrap`.
/// Mirrors `HospitalKioskAppPacket` in lib/dal/hospital.ts (plus `publicBaseUrl`
/// added by the route).
class HospitalKioskBootstrap {
  const HospitalKioskBootstrap({
    required this.branchId,
    required this.branchName,
    required this.serviceDate,
    required this.departments,
    required this.doctors,
    required this.settings,
    required this.silentPrint,
    required this.printerName,
    required this.publicTrackingEnabled,
    required this.publicBaseUrl,
  });

  final String branchId;
  final String branchName;
  final String serviceDate;
  final List<HospitalDepartment> departments;
  final List<HospitalDoctor> doctors;
  final HospitalSettings? settings;

  /// Informational — the app manages its own printer connection.
  final bool silentPrint;
  final String printerName;

  /// Effective public-tracking gate (distributor grant AND the hospital's own
  /// switch, ANDed server-side). Gates whether the printed ticket carries a QR.
  final bool publicTrackingEnabled;

  /// The origin the QR points at — never this device's API base URL, which can
  /// be a LAN address a visitor's phone can't reach.
  final String publicBaseUrl;

  List<String> get languages =>
      settings != null && settings!.languages.isNotEmpty
          ? settings!.languages
          : const ['en'];

  String hospitalName(String lang) {
    final fromSettings = settings?.hospitalNameFor(lang) ?? '';
    if (fromSettings.isNotEmpty) return fromSettings;
    return branchName.isNotEmpty ? branchName : 'Hospital';
  }

  List<HospitalDoctor> doctorsFor(String departmentId) =>
      doctors.where((d) => d.departmentId == departmentId).toList();

  factory HospitalKioskBootstrap.fromJson(Map<String, dynamic> json) {
    return HospitalKioskBootstrap(
      branchId: json['branchId'] as String? ?? '',
      branchName: json['branchName'] as String? ?? '',
      serviceDate: json['serviceDate'] as String? ?? '',
      departments: (json['departments'] as List<dynamic>?)
              ?.map((e) => HospitalDepartment.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      doctors: (json['doctors'] as List<dynamic>?)
              ?.map((e) => HospitalDoctor.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      settings: json['settings'] == null
          ? null
          : HospitalSettings.fromJson(json['settings'] as Map<String, dynamic>),
      silentPrint: json['silentPrint'] as bool? ?? false,
      printerName: json['printerName'] as String? ?? '',
      publicTrackingEnabled: json['publicTrackingEnabled'] as bool? ?? false,
      publicBaseUrl: json['publicBaseUrl'] as String? ?? '',
    );
  }
}
