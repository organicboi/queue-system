import '../board_packet.dart' show BoardAd, BoardTickerRow;
import 'locale_map.dart';

/// Mirrors the `get_hospital_board` RPC output (migration
/// 20260908_hospital_queue_system.sql, `json_build_object` at line ~1047) and
/// `HospitalBoardPacket` in lib/db/hospital-types.ts.
///
/// Like the school board packet this arrives **snake_case** for the row lists
/// (the RPC `json_agg`s raw rows) but camelCase for the top-level scalars the
/// RPC hand-builds. Ads and tickers reuse the school [BoardAd] / [BoardTickerRow]
/// models — those columns are identical across both boards.
class HospitalBoardPacket {
  const HospitalBoardPacket({
    required this.status,
    required this.branchId,
    required this.serviceDate,
    required this.hospitalName,
    required this.hospitalNameI18n,
    required this.logoUrl,
    required this.announcementLang,
    required this.announceLocales,
    required this.announceEnabled,
    required this.announceTemplateI18n,
    required this.showClock,
    required this.tickerText,
    required this.rooms,
    required this.recent,
    required this.departments,
    required this.ads,
    required this.tickers,
  });

  final String status; // 'ok' | 'expired' | 'not-found'
  final String? branchId;
  final String? serviceDate;
  final String hospitalName;
  final LocaleMap hospitalNameI18n;
  final String logoUrl;

  /// Per-screen `announcement_lang`: 'en' | 'ar' | 'mr' | 'hi' | 'both'.
  final String announcementLang;

  /// The branch's configured languages, in order — the primary source for which
  /// locales to speak (see [announceLocalesResolved]).
  final List<String> announceLocales;
  final bool announceEnabled;
  final LocaleMap announceTemplateI18n;
  final bool showClock;
  final String tickerText;

  final List<HospitalBoardRoom> rooms;
  final List<HospitalBoardRecent> recent;
  final List<HospitalBoardDepartment> departments;
  final List<BoardAd> ads;
  final List<BoardTickerRow> tickers;

  bool get isOk => status == 'ok';

  /// Locales to speak, in order. `get_hospital_board` always sends
  /// `announceLocales` (the branch language list, or `['en']`), which is the
  /// primary source in HospitalBoard.tsx too; the `announcement_lang` fallbacks
  /// only matter for an empty list.
  List<String> get announceLocalesResolved {
    if (announceLocales.isNotEmpty) return announceLocales;
    if (announcementLang.isNotEmpty && announcementLang != 'both') {
      return [announcementLang];
    }
    return const ['en'];
  }

  factory HospitalBoardPacket.fromJson(Map<String, dynamic> json) {
    return HospitalBoardPacket(
      status: json['status'] as String? ?? 'not-found',
      branchId: json['branchId'] as String?,
      serviceDate: json['serviceDate'] as String?,
      hospitalName: json['hospitalName'] as String? ?? '',
      hospitalNameI18n: parseLocaleMap(json['hospitalNameI18n']),
      logoUrl: json['logoUrl'] as String? ?? '',
      announcementLang: json['announcementLang'] as String? ?? 'en',
      announceLocales: (json['announceLocales'] as List<dynamic>?)
              ?.map((e) => '$e')
              .where((e) => e.isNotEmpty)
              .toList() ??
          const [],
      announceEnabled: json['announceEnabled'] as bool? ?? true,
      announceTemplateI18n: parseLocaleMap(json['announceTemplateI18n']),
      showClock: json['showClock'] as bool? ?? true,
      tickerText: json['tickerText'] as String? ?? '',
      rooms: (json['rooms'] as List<dynamic>?)
              ?.map((e) => HospitalBoardRoom.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      recent: (json['recent'] as List<dynamic>?)
              ?.map((e) => HospitalBoardRecent.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      departments: (json['departments'] as List<dynamic>?)
              ?.map((e) =>
                  HospitalBoardDepartment.fromJson(e as Map<String, dynamic>))
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

/// One row of the TOKEN | ROOM | DOCTOR table — one per open room, always
/// visible, showing that room's current `called` token or nothing.
class HospitalBoardRoom {
  const HospitalBoardRoom({
    required this.id,
    required this.label,
    required this.displayOrder,
    required this.isOpen,
    required this.departmentName,
    required this.departmentColor,
    required this.doctorName,
    required this.doctorMissing,
    required this.doctorOnLeave,
    required this.tokenId,
    required this.tokenCode,
    required this.calledAt,
    required this.recallCount,
    required this.priorityCategory,
    required this.stage,
  });

  final String id;
  final String label;
  final int displayOrder;
  final bool isOpen;
  final LocaleMap departmentName;
  final String? departmentColor;
  final String? doctorName;
  final bool doctorMissing;
  final bool doctorOnLeave;
  final String? tokenId;
  final String? tokenCode;
  final String? calledAt;
  final int recallCount;
  final String? priorityCategory;
  final String? stage;

  bool get isCalled => (tokenCode ?? '').isNotEmpty;
  bool get isPriority => (priorityCategory ?? '').isNotEmpty;

  /// Identifies "this specific call" for announce-dedupe: a recall changes no
  /// other visible column, so `recallCount` has to be in the key (same as the
  /// school board's `BoardCounter.callKey`).
  String get callKey => '$id:$tokenId:$recallCount';

  String departmentNameFor(String lang) => pickLocale(departmentName, lang);

  factory HospitalBoardRoom.fromJson(Map<String, dynamic> json) {
    return HospitalBoardRoom(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      displayOrder: (json['display_order'] as num?)?.toInt() ?? 0,
      isOpen: json['is_open'] as bool? ?? true,
      departmentName: parseLocaleMap(json['department_name']),
      departmentColor: json['department_color'] as String?,
      doctorName: json['doctor_name'] as String?,
      doctorMissing: json['doctor_missing'] as bool? ?? false,
      doctorOnLeave: json['doctor_on_leave'] as bool? ?? false,
      tokenId: json['token_id'] as String?,
      tokenCode: json['token_code'] as String?,
      calledAt: json['called_at'] as String?,
      recallCount: (json['recall_count'] as num?)?.toInt() ?? 0,
      priorityCategory: json['priority_category'] as String?,
      stage: json['stage'] as String?,
    );
  }
}

class HospitalBoardRecent {
  const HospitalBoardRecent({
    required this.tokenCode,
    required this.servedAt,
    required this.roomLabel,
  });

  final String tokenCode;
  final String servedAt;
  final String? roomLabel;

  factory HospitalBoardRecent.fromJson(Map<String, dynamic> json) {
    return HospitalBoardRecent(
      tokenCode: json['token_code'] as String? ?? '',
      servedAt: json['served_at'] as String? ?? '',
      roomLabel: json['room_label'] as String?,
    );
  }
}

class HospitalBoardDepartment {
  const HospitalBoardDepartment({
    required this.id,
    required this.nameEn,
    required this.name,
    required this.color,
    required this.type,
    required this.displayOrder,
    required this.waiting,
  });

  final String id;
  final String nameEn;
  final LocaleMap name;
  final String color;
  final String type;
  final int displayOrder;
  final int waiting;

  String nameFor(String lang) {
    final v = pickLocale(name, lang);
    return v.isNotEmpty ? v : nameEn;
  }

  factory HospitalBoardDepartment.fromJson(Map<String, dynamic> json) {
    return HospitalBoardDepartment(
      id: json['id'] as String? ?? '',
      nameEn: json['name_en'] as String? ?? '',
      name: parseLocaleMap(json['name']),
      color: json['color'] as String? ?? '#334155',
      type: json['type'] as String? ?? 'opd',
      displayOrder: (json['display_order'] as num?)?.toInt() ?? 0,
      waiting: (json['waiting'] as num?)?.toInt() ?? 0,
    );
  }
}
