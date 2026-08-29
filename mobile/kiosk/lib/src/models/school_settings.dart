/// Mirrors `SchoolSettingsDTO` from lib/db/school-types.ts.
///
/// `kioskIdleSeconds` and the `announce*` fields are carried through but inert
/// until an attract-screen / TTS feature is built.
class SchoolSettings {
  const SchoolSettings({
    required this.id,
    required this.customerId,
    required this.branchId,
    required this.schoolNameEn,
    required this.schoolNameAr,
    required this.logoUrl,
    required this.languages,
    required this.ticketFooterEn,
    required this.ticketFooterAr,
    required this.kioskIdleSeconds,
    required this.priorityEnabled,
    required this.announceEnabled,
    required this.announceTemplateEn,
    required this.announceTemplateAr,
    required this.printEnabled,
    required this.timezone,
    required this.dayStartTime,
  });

  final String id;
  final String customerId;
  final String branchId;
  final String schoolNameEn;
  final String schoolNameAr;
  final String logoUrl;
  final List<String> languages;
  final String ticketFooterEn;
  final String ticketFooterAr;
  final int kioskIdleSeconds;
  final bool priorityEnabled;
  final bool announceEnabled;
  final String announceTemplateEn;
  final String announceTemplateAr;
  final bool printEnabled;
  final String timezone;
  final String dayStartTime;

  String schoolName(String lang) => lang == 'ar' ? schoolNameAr : schoolNameEn;
  String ticketFooter(String lang) =>
      lang == 'ar' ? ticketFooterAr : ticketFooterEn;

  factory SchoolSettings.fromJson(Map<String, dynamic> json) {
    return SchoolSettings(
      id: json['id'] as String? ?? '',
      customerId: json['customerId'] as String? ?? '',
      branchId: json['branchId'] as String? ?? '',
      schoolNameEn: json['schoolNameEn'] as String? ?? '',
      schoolNameAr: json['schoolNameAr'] as String? ?? '',
      logoUrl: json['logoUrl'] as String? ?? '',
      languages: (json['languages'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const ['en'],
      ticketFooterEn: json['ticketFooterEn'] as String? ?? '',
      ticketFooterAr: json['ticketFooterAr'] as String? ?? '',
      kioskIdleSeconds: (json['kioskIdleSeconds'] as num?)?.toInt() ?? 0,
      priorityEnabled: json['priorityEnabled'] as bool? ?? false,
      announceEnabled: json['announceEnabled'] as bool? ?? false,
      announceTemplateEn: json['announceTemplateEn'] as String? ?? '',
      announceTemplateAr: json['announceTemplateAr'] as String? ?? '',
      printEnabled: json['printEnabled'] as bool? ?? true,
      timezone: json['timezone'] as String? ?? 'UTC',
      dayStartTime: json['dayStartTime'] as String? ?? '00:00:00',
    );
  }
}
