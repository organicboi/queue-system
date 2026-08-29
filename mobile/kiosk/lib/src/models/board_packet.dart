/// Mirrors `SchoolBoardPacket` from lib/db/school-types.ts.
///
/// Unlike the kiosk DTOs (camelCase — they pass through the action layer's
/// own mappers), this arrives **snake_case**: `get_school_board` is a
/// Postgres RPC that `json_agg`s raw rows straight out, so the wire shape is
/// the database column names, not a hand-written DTO. Do not assume one
/// naming convention holds across both this app's APIs.
class BoardPacket {
  const BoardPacket({
    required this.status,
    required this.screenId,
    required this.branchId,
    required this.customerId,
    required this.serviceDate,
    required this.schoolNameEn,
    required this.schoolNameAr,
    required this.logoUrl,
    required this.primaryColor,
    required this.announcementLang,
    required this.announceEnabled,
    required this.announceTemplateEn,
    required this.announceTemplateAr,
    required this.showClock,
    required this.tickerText,
    required this.counters,
    required this.recent,
    required this.departments,
    required this.ads,
    required this.tickers,
  });

  final String status; // 'ok' | 'expired' | 'not-found'
  final String? screenId;
  final String? branchId;
  final String? customerId;
  final String? serviceDate;
  final String schoolNameEn;
  final String schoolNameAr;
  final String logoUrl;
  final String primaryColor;

  /// 'en' | 'ar' | 'both'.
  final String announcementLang;
  final bool announceEnabled;
  final String announceTemplateEn;
  final String announceTemplateAr;
  final bool showClock;
  final String tickerText;

  final List<BoardCounter> counters;
  final List<BoardRecent> recent;
  final List<BoardDepartment> departments;
  final List<BoardAd> ads;
  final List<BoardTickerRow> tickers;

  bool get isOk => status == 'ok';

  factory BoardPacket.fromJson(Map<String, dynamic> json) {
    return BoardPacket(
      status: json['status'] as String? ?? 'not-found',
      screenId: json['screenId'] as String?,
      branchId: json['branchId'] as String?,
      customerId: json['customerId'] as String?,
      serviceDate: json['serviceDate'] as String?,
      schoolNameEn: json['schoolName'] as String? ?? '',
      schoolNameAr: json['schoolNameAr'] as String? ?? '',
      logoUrl: json['logoUrl'] as String? ?? '',
      primaryColor: json['primaryColor'] as String? ?? '#0F766E',
      announcementLang: json['announcementLang'] as String? ?? 'en',
      announceEnabled: json['announceEnabled'] as bool? ?? true,
      announceTemplateEn: json['announceTemplateEn'] as String? ??
          'Token {token}, please proceed to {counter}',
      announceTemplateAr: json['announceTemplateAr'] as String? ?? '',
      showClock: json['showClock'] as bool? ?? true,
      tickerText: json['tickerText'] as String? ?? '',
      counters: (json['counters'] as List<dynamic>?)
              ?.map((e) => BoardCounter.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      recent: (json['recent'] as List<dynamic>?)
              ?.map((e) => BoardRecent.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      departments: (json['departments'] as List<dynamic>?)
              ?.map((e) => BoardDepartment.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      ads: (json['ads'] as List<dynamic>?)
              ?.map((e) => BoardAd.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      tickers: (json['tickers'] as List<dynamic>?)
              ?.map((e) => BoardTickerRow.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );
  }
}

/// One row of the "TOKEN NO. / COUNTER / STATUS" table — one per counter,
/// open or not. The board only shows the open ones (see board_screen.dart):
/// a "last N called" list would make a counter vanish from the board three
/// calls later, which is exactly the layout mistake docs/school-queue-plan.md
/// calls out.
class BoardCounter {
  const BoardCounter({
    required this.id,
    required this.nameEn,
    required this.nameAr,
    required this.displayOrder,
    required this.isOpen,
    required this.tokenId,
    required this.tokenCode,
    required this.calledAt,
    required this.recallCount,
    required this.isPriority,
    required this.departmentEn,
    required this.departmentAr,
    required this.departmentColor,
  });

  final String id;
  final String nameEn;
  final String nameAr;
  final int displayOrder;
  final bool isOpen;
  final String? tokenId;
  final String? tokenCode;
  final String? calledAt;
  final int recallCount;
  final bool isPriority;
  final String? departmentEn;
  final String? departmentAr;
  final String? departmentColor;

  bool get isCalled => tokenCode != null && tokenCode!.isNotEmpty;

  /// Identifies "this specific call" for announce-dedupe: a recall changes no
  /// other visible column, so `recallCount` has to be part of the key (see
  /// lib/school/announce.ts and the announcer port).
  String get callKey => '$id:$tokenId:$recallCount';

  factory BoardCounter.fromJson(Map<String, dynamic> json) {
    return BoardCounter(
      id: json['id'] as String? ?? '',
      nameEn: json['name_en'] as String? ?? '',
      nameAr: json['name_ar'] as String? ?? '',
      displayOrder: (json['display_order'] as num?)?.toInt() ?? 0,
      isOpen: json['is_open'] as bool? ?? true,
      tokenId: json['token_id'] as String?,
      tokenCode: json['token_code'] as String?,
      calledAt: json['called_at'] as String?,
      recallCount: (json['recall_count'] as num?)?.toInt() ?? 0,
      isPriority: json['is_priority'] as bool? ?? false,
      departmentEn: json['department_en'] as String?,
      departmentAr: json['department_ar'] as String?,
      departmentColor: json['department_color'] as String?,
    );
  }
}

class BoardRecent {
  const BoardRecent({
    required this.tokenCode,
    required this.servedAt,
    required this.counterEn,
    required this.counterAr,
  });

  final String tokenCode;
  final String servedAt;
  final String? counterEn;
  final String? counterAr;

  factory BoardRecent.fromJson(Map<String, dynamic> json) {
    return BoardRecent(
      tokenCode: json['token_code'] as String? ?? '',
      servedAt: json['served_at'] as String? ?? '',
      counterEn: json['counter_en'] as String?,
      counterAr: json['counter_ar'] as String?,
    );
  }
}

class BoardDepartment {
  const BoardDepartment({
    required this.id,
    required this.nameEn,
    required this.nameAr,
    required this.color,
    required this.displayOrder,
    required this.waiting,
  });

  final String id;
  final String nameEn;
  final String nameAr;
  final String color;
  final int displayOrder;
  final int waiting;

  factory BoardDepartment.fromJson(Map<String, dynamic> json) {
    return BoardDepartment(
      id: json['id'] as String? ?? '',
      nameEn: json['name_en'] as String? ?? '',
      nameAr: json['name_ar'] as String? ?? '',
      color: json['color'] as String? ?? '#334155',
      displayOrder: (json['display_order'] as num?)?.toInt() ?? 0,
      waiting: (json['waiting'] as num?)?.toInt() ?? 0,
    );
  }
}

class BoardAd {
  const BoardAd({
    required this.id,
    required this.fileUrl,
    required this.fileType,
    required this.durationSeconds,
    required this.isActive,
    required this.audioEnabled,
  });

  final String id;
  final String fileUrl;
  final String fileType; // 'image' | 'video'
  final int durationSeconds;
  final bool isActive;
  final bool audioEnabled;

  bool get isVideo => fileType == 'video';

  factory BoardAd.fromJson(Map<String, dynamic> json) {
    return BoardAd(
      id: json['id'] as String? ?? '',
      fileUrl: json['file_url'] as String? ?? '',
      fileType: json['file_type'] as String? ?? 'image',
      durationSeconds: (json['duration_seconds'] as num?)?.toInt() ?? 8,
      isActive: json['is_active'] as bool? ?? true,
      audioEnabled: json['audio_enabled'] as bool? ?? false,
    );
  }
}

class BoardTickerRow {
  const BoardTickerRow({required this.id, required this.message});

  final String id;
  final String message;

  factory BoardTickerRow.fromJson(Map<String, dynamic> json) {
    return BoardTickerRow(
      id: json['id'] as String? ?? '',
      message: json['message'] as String? ?? '',
    );
  }
}
