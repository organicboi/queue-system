/// Mirrors `SchoolDepartmentDTO` from lib/db/school-types.ts (camelCase — the
/// shape the /api/kiosk routes return).
class SchoolDepartment {
  const SchoolDepartment({
    required this.id,
    required this.customerId,
    required this.branchId,
    required this.nameEn,
    required this.nameAr,
    required this.prefix,
    required this.numberStart,
    required this.color,
    required this.icon,
    required this.isPriority,
    required this.displayOrder,
    required this.isActive,
    required this.createdAt,
  });

  final String id;
  final String customerId;
  final String branchId;
  final String nameEn;
  final String nameAr;
  final String prefix;
  final int numberStart;
  final String color;
  final String icon;
  final bool isPriority;
  final int displayOrder;
  final bool isActive;
  final String createdAt;

  String name(String lang) => lang == 'ar' ? nameAr : nameEn;

  factory SchoolDepartment.fromJson(Map<String, dynamic> json) {
    return SchoolDepartment(
      id: json['id'] as String,
      customerId: json['customerId'] as String? ?? '',
      branchId: json['branchId'] as String? ?? '',
      nameEn: json['nameEn'] as String? ?? '',
      nameAr: json['nameAr'] as String? ?? '',
      prefix: json['prefix'] as String? ?? '',
      numberStart: (json['numberStart'] as num?)?.toInt() ?? 1,
      color: json['color'] as String? ?? '#334155',
      icon: json['icon'] as String? ?? '',
      isPriority: json['isPriority'] as bool? ?? false,
      displayOrder: (json['displayOrder'] as num?)?.toInt() ?? 0,
      isActive: json['isActive'] as bool? ?? true,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }
}
