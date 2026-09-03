import 'locale_map.dart';

/// The slice of `HospitalSettingsDTO` (lib/db/hospital-types.ts) the kiosk app
/// needs. Null when the branch has no `hospital_settings` row yet — callers
/// fall back to sensible defaults, exactly as `HospitalKiosk.tsx` does.
class HospitalSettings {
  const HospitalSettings({
    required this.hospitalName,
    required this.logoUrl,
    required this.languages,
    required this.ticketFooter,
    required this.kioskIdleSeconds,
    required this.priorityEnabled,
    required this.printEnabled,
  });

  final LocaleMap hospitalName;
  final String logoUrl;
  final List<String> languages;
  final LocaleMap ticketFooter;
  final int kioskIdleSeconds;
  final bool priorityEnabled;
  final bool printEnabled;

  String hospitalNameFor(String lang) => pickLocale(hospitalName, lang);
  String ticketFooterFor(String lang) => pickLocale(ticketFooter, lang);

  factory HospitalSettings.fromJson(Map<String, dynamic> json) {
    return HospitalSettings(
      hospitalName: parseLocaleMap(json['hospitalName']),
      logoUrl: json['logoUrl'] as String? ?? '',
      languages: (json['languages'] as List<dynamic>?)
              ?.map((e) => '$e')
              .where((e) => e.isNotEmpty)
              .toList() ??
          const ['en'],
      ticketFooter: parseLocaleMap(json['ticketFooter']),
      kioskIdleSeconds: (json['kioskIdleSeconds'] as num?)?.toInt() ?? 20,
      priorityEnabled: json['priorityEnabled'] as bool? ?? true,
      printEnabled: json['printEnabled'] as bool? ?? true,
    );
  }
}
