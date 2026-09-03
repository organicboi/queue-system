/// Response of `GET /api/hospital-kiosk/[branchToken]/feed`.
/// Mirrors `HospitalKioskFeed` from lib/db/hospital-types.ts — per-department
/// queue depth for the grid tiles, plus today's count. Token codes only, no
/// patient data. The app polls this every 8s (FEED_POLL_MS in HospitalKiosk.tsx).
class HospitalKioskFeed {
  const HospitalKioskFeed({
    required this.status,
    required this.serviceDate,
    required this.waitingByDepartment,
    required this.waitingTotal,
    required this.issuedToday,
  });

  /// 'ok' | 'not-found'
  final String status;
  final String? serviceDate;

  /// Keyed by departmentId.
  final Map<String, int> waitingByDepartment;
  final int waitingTotal;
  final int issuedToday;

  static const empty = HospitalKioskFeed(
    status: 'ok',
    serviceDate: null,
    waitingByDepartment: {},
    waitingTotal: 0,
    issuedToday: 0,
  );

  int waitingFor(String departmentId) => waitingByDepartment[departmentId] ?? 0;

  factory HospitalKioskFeed.fromJson(Map<String, dynamic> json) {
    return HospitalKioskFeed(
      status: json['status'] as String? ?? 'ok',
      serviceDate: json['serviceDate'] as String?,
      waitingByDepartment:
          (json['waitingByDepartment'] as Map<String, dynamic>?)?.map(
                (k, v) => MapEntry(k, (v as num).toInt()),
              ) ??
              const {},
      waitingTotal: (json['waitingTotal'] as num?)?.toInt() ?? 0,
      issuedToday: (json['issuedToday'] as num?)?.toInt() ?? 0,
    );
  }
}
