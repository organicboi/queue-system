/// One doctor on duty today, as returned by
/// `GET /api/hospital-kiosk/[branchToken]/bootstrap` (the `HospitalKioskAppDoctor`
/// shape in lib/dal/hospital.ts). Names are staff identity, not patient PII.
class HospitalDoctor {
  const HospitalDoctor({
    required this.id,
    required this.name,
    required this.departmentId,
    required this.specialization,
    required this.feePaise,
  });

  final String id;
  final String name;
  final String departmentId;
  final String specialization;
  final int feePaise;

  /// Fee in whole rupees for display ("₹300"), or null when there is no fee.
  int? get feeRupees => feePaise > 0 ? (feePaise / 100).round() : null;

  factory HospitalDoctor.fromJson(Map<String, dynamic> json) {
    return HospitalDoctor(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      departmentId: json['departmentId'] as String? ?? '',
      specialization: json['specialization'] as String? ?? '',
      feePaise: (json['feePaise'] as num?)?.toInt() ?? 0,
    );
  }
}
