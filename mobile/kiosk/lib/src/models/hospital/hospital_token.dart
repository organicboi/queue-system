/// Mirrors `HospitalTokenDTO` from lib/db/hospital-types.ts — the row
/// `claim_hospital_token` returns, wrapped by `hospitalIssueTokenAction`.
///
/// `stage` is one of: registration | triage | consult | lab | radiology |
/// pharmacy | billing | review. `status` is one of: waiting | called | serving |
/// held | served | no-show | cancelled.
class HospitalToken {
  const HospitalToken({
    required this.id,
    required this.departmentId,
    required this.doctorId,
    required this.roomId,
    required this.serviceDate,
    required this.number,
    required this.tokenCode,
    required this.stage,
    required this.status,
    required this.priorityCategory,
    required this.publicCode,
    required this.locale,
    required this.joinedAt,
  });

  final String id;
  final String departmentId;
  final String? doctorId;
  final String? roomId;
  final String serviceDate;
  final int number;
  final String tokenCode;
  final String stage;
  final String status;
  final String? priorityCategory;

  /// Short, non-enumerable handle for the public tracking page / printed QR.
  final String publicCode;
  final String? locale;
  final String joinedAt;

  bool get isPriority => (priorityCategory ?? '').isNotEmpty;

  factory HospitalToken.fromJson(Map<String, dynamic> json) {
    return HospitalToken(
      id: json['id'] as String,
      departmentId: json['departmentId'] as String? ?? '',
      doctorId: json['doctorId'] as String?,
      roomId: json['roomId'] as String?,
      serviceDate: json['serviceDate'] as String? ?? '',
      number: (json['number'] as num?)?.toInt() ?? 0,
      tokenCode: json['tokenCode'] as String? ?? '',
      stage: json['stage'] as String? ?? 'consult',
      status: json['status'] as String? ?? 'waiting',
      priorityCategory: json['priorityCategory'] as String?,
      publicCode: json['publicCode'] as String? ?? '',
      locale: json['locale'] as String?,
      joinedAt: json['joinedAt'] as String? ?? '',
    );
  }
}
