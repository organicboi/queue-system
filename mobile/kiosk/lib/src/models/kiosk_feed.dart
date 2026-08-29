import 'school_token.dart';

/// Response of `GET /api/kiosk/[branchToken]/feed`.
/// Mirrors `SchoolKioskFeed` from lib/db/school-types.ts.
///
/// The web kiosk polls this every 6s (FEED_POLL_MS in SchoolKiosk.tsx) — match
/// that interval so behaviour is identical.
class KioskFeed {
  const KioskFeed({
    required this.status,
    required this.serviceDate,
    required this.recent,
    required this.waitingByDepartment,
    required this.waitingTotal,
    required this.issuedToday,
  });

  /// 'ok' | 'not-found'
  final String status;
  final String? serviceDate;
  final List<SchoolToken> recent;

  /// Keyed by departmentId.
  final Map<String, int> waitingByDepartment;
  final int waitingTotal;
  final int issuedToday;

  static const empty = KioskFeed(
    status: 'ok',
    serviceDate: null,
    recent: [],
    waitingByDepartment: {},
    waitingTotal: 0,
    issuedToday: 0,
  );

  int waitingFor(String departmentId) => waitingByDepartment[departmentId] ?? 0;

  /// Returns a copy with [token] prepended to `recent`, capped at [limit] —
  /// the web kiosk does this so the just-issued ticket shows before the next
  /// poll lands (RECENT_LIMIT = 30 in SchoolKiosk.tsx).
  KioskFeed withNewToken(SchoolToken token, {int limit = 30}) {
    return KioskFeed(
      status: status,
      serviceDate: serviceDate,
      recent: [token, ...recent].take(limit).toList(),
      waitingByDepartment: waitingByDepartment,
      waitingTotal: waitingTotal,
      issuedToday: issuedToday,
    );
  }

  factory KioskFeed.fromJson(Map<String, dynamic> json) {
    return KioskFeed(
      status: json['status'] as String? ?? 'ok',
      serviceDate: json['serviceDate'] as String?,
      recent: (json['recent'] as List<dynamic>?)
              ?.map((e) => SchoolToken.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
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
