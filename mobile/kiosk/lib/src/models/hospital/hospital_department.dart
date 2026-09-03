import 'locale_map.dart';

/// Mirrors `HospitalDepartmentDTO` from lib/db/hospital-types.ts (camelCase —
/// the shape the /api/hospital-kiosk routes return). `type` is one of
/// opd | lab | radiology | pharmacy | billing | triage; the kiosk only ever
/// sees `opd` and `triage`.
class HospitalDepartment {
  const HospitalDepartment({
    required this.id,
    required this.name,
    required this.prefix,
    required this.type,
    required this.color,
    required this.icon,
    required this.displayOrder,
    required this.isActive,
  });

  final String id;
  final LocaleMap name;
  final String prefix;
  final String type;
  final String color;
  final String icon;
  final int displayOrder;
  final bool isActive;

  bool get isOpd => type == 'opd';

  String nameFor(String lang) => pickLocale(name, lang);

  factory HospitalDepartment.fromJson(Map<String, dynamic> json) {
    return HospitalDepartment(
      id: json['id'] as String,
      name: parseLocaleMap(json['name']),
      prefix: json['prefix'] as String? ?? '',
      type: json['type'] as String? ?? 'opd',
      color: json['color'] as String? ?? '#334155',
      icon: json['icon'] as String? ?? '',
      displayOrder: (json['displayOrder'] as num?)?.toInt() ?? 0,
      isActive: json['isActive'] as bool? ?? true,
    );
  }
}
