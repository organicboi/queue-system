import 'package:flutter/material.dart';

/// Departments store a lucide-react icon name (e.g. `GraduationCap`). Flutter
/// has no lucide font bundled, so map the names the school admin can pick onto
/// the closest Material glyph. Unknown names fall back to a neutral tag icon.
IconData departmentIcon(String lucideName) {
  switch (lucideName) {
    case 'Building2':
    case 'Landmark':
      return Icons.account_balance_rounded;
    case 'UserPlus':
      return Icons.person_add_alt_1_rounded;
    case 'Users':
      return Icons.groups_rounded;
    case 'Receipt':
      return Icons.receipt_long_rounded;
    case 'CreditCard':
    case 'Wallet':
      return Icons.credit_card_rounded;
    case 'FileText':
    case 'ClipboardList':
      return Icons.description_rounded;
    case 'GraduationCap':
      return Icons.school_rounded;
    case 'BookOpen':
    case 'Library':
      return Icons.menu_book_rounded;
    case 'Bus':
    case 'Car':
      return Icons.directions_bus_rounded;
    case 'ConciergeBell':
      return Icons.room_service_rounded;
    case 'ShoppingBag':
    case 'ShoppingCart':
    case 'Shirt':
      return Icons.shopping_bag_rounded;
    case 'Accessibility':
    case 'HeartHandshake':
      return Icons.accessible_rounded;
    case 'Stethoscope':
    case 'Cross':
      return Icons.medical_services_rounded;
    case 'Phone':
      return Icons.call_rounded;
    case 'Mail':
      return Icons.mail_rounded;
    case 'Calendar':
    case 'CalendarDays':
      return Icons.calendar_month_rounded;
    case 'Home':
      return Icons.home_rounded;
    case 'Info':
    case 'HelpCircle':
      return Icons.info_rounded;
    case 'Award':
    case 'BadgeCheck':
      return Icons.workspace_premium_rounded;
    default:
      return Icons.local_activity_rounded;
  }
}

/// Parse the `#RRGGBB` a department carries; falls back to the app primary.
Color departmentColor(String hex, {Color fallback = const Color(0xFF2F5BEA)}) {
  final clean = hex.replaceAll('#', '').trim();
  if (clean.length == 6) {
    final value = int.tryParse(clean, radix: 16);
    if (value != null) return Color(0xFF000000 | value);
  }
  return fallback;
}
