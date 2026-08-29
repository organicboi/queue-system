/// Mirrors `SchoolTokenDTO` from lib/db/school-types.ts.
///
/// `status` is one of: waiting | called | held | served | no-show | cancelled.
/// `source` is one of: kiosk | staff | web | api.
class SchoolToken {
  const SchoolToken({
    required this.id,
    required this.customerId,
    required this.branchId,
    required this.departmentId,
    required this.counterId,
    required this.serviceDate,
    required this.number,
    required this.tokenCode,
    required this.status,
    required this.isPriority,
    required this.source,
    required this.transferredFromDepartmentId,
    required this.notes,
    required this.joinedAt,
    required this.calledAt,
    required this.servedAt,
    required this.callCount,
    required this.recallCount,
    required this.createdAt,
  });

  final String id;
  final String customerId;
  final String branchId;
  final String departmentId;
  final String? counterId;
  final String serviceDate;
  final int number;
  final String tokenCode;
  final String status;
  final bool isPriority;
  final String source;
  final String? transferredFromDepartmentId;
  final String notes;
  final String joinedAt;
  final String? calledAt;
  final String? servedAt;
  final int callCount;
  final int recallCount;
  final String createdAt;

  /// Only 'waiting' and 'held' tokens can be amended from the kiosk — the
  /// server enforces this too (see amendable() in lib/actions/school-tokens.ts).
  bool get isAmendable => status == 'waiting' || status == 'held';

  factory SchoolToken.fromJson(Map<String, dynamic> json) {
    return SchoolToken(
      id: json['id'] as String,
      customerId: json['customerId'] as String? ?? '',
      branchId: json['branchId'] as String? ?? '',
      departmentId: json['departmentId'] as String? ?? '',
      counterId: json['counterId'] as String?,
      serviceDate: json['serviceDate'] as String? ?? '',
      number: (json['number'] as num?)?.toInt() ?? 0,
      tokenCode: json['tokenCode'] as String? ?? '',
      status: json['status'] as String? ?? 'waiting',
      isPriority: json['isPriority'] as bool? ?? false,
      source: json['source'] as String? ?? 'kiosk',
      transferredFromDepartmentId:
          json['transferredFromDepartmentId'] as String?,
      notes: json['notes'] as String? ?? '',
      joinedAt: json['joinedAt'] as String? ?? '',
      calledAt: json['calledAt'] as String?,
      servedAt: json['servedAt'] as String?,
      callCount: (json['callCount'] as num?)?.toInt() ?? 0,
      recallCount: (json['recallCount'] as num?)?.toInt() ?? 0,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }
}
