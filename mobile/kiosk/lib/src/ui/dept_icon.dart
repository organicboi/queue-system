import 'dart:math' as math;

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

/// A department colour is picked by a school admin in a web colour field, so
/// it can land anywhere on the wheel — including pale yellows and mints that
/// disappear as text or as a hairline on a white card. This keeps the hue the
/// admin chose and only caps how light it is allowed to be, so every card is
/// still recognisably "their" colour while staying legible at arm's length.
Color departmentInk(Color raw) {
  final hsl = HSLColor.fromColor(raw);
  if (hsl.lightness <= 0.46) return raw;
  return hsl.withLightness(0.46).toColor();
}

/// Cache: resolving a block walks the colour one step at a time, and the same
/// handful of department colours are re-resolved on every feed poll.
final _blockCache = <int, DepartmentBlock>{};

/// A department colour, resolved into a card that can actually be read: the
/// fill to paint, and the one ink that goes on top of it.
typedef DepartmentBlock = ({Color fill, Color on, bool light});

/// The colour-block layout puts the department's colour across a whole card
/// and sets everything else on top of it, so the colour an admin picked in a
/// web colour field has to survive being a background. Two outcomes, decided
/// by the colour's own brightness — never by overruling the hue they chose:
///
/// * **Dark block, white ink.** The common case. The colour is walked down
///   until white clears roughly 4.5:1 on it.
/// * **Light block, dark ink.** A pastel or a highlighter yellow can't carry
///   white at any lightness worth keeping — darkening one until it could would
///   hand back a muddy olive, which is not the colour the school chose. So the
///   card keeps its brightness and the type inverts instead.
///
/// Either way the hue is preserved and the card stays legible from across a
/// lobby, which is the entire premise of the design.
DepartmentBlock departmentBlock(Color raw) {
  return _blockCache.putIfAbsent(raw.toARGB32(), () {
    var hsl = HSLColor.fromColor(raw);

    if (raw.computeLuminance() > 0.42) {
      // Give a washed-out pastel enough saturation to read as a colour rather
      // than as dirty paper, and keep it bright.
      if (hsl.saturation < 0.35) hsl = hsl.withSaturation(0.35);
      if (hsl.lightness < 0.62) hsl = hsl.withLightness(0.62);
      final ink = hsl
          .withSaturation(math.max(hsl.saturation, 0.5))
          .withLightness(0.16)
          .toColor();
      return (fill: hsl.toColor(), on: ink, light: true);
    }

    if (hsl.saturation < 0.25) hsl = hsl.withSaturation(0.25);
    var fill = hsl.toColor();
    var guard = 0;
    // 0.18 relative luminance puts white at ~4.6:1 — the AA threshold for the
    // small print on these cards, and far past it for the names.
    while (fill.computeLuminance() > 0.18 &&
        hsl.lightness > 0.16 &&
        guard++ < 24) {
      hsl = hsl.withLightness((hsl.lightness - 0.03).clamp(0.0, 1.0));
      fill = hsl.toColor();
    }
    return (fill: fill, on: const Color(0xFFFFFFFF), light: false);
  });
}

/// The same fill one step deeper, for the moment a finger is on the card.
Color departmentFillPressed(Color fill) {
  final hsl = HSLColor.fromColor(fill);
  return hsl.withLightness((hsl.lightness - 0.06).clamp(0.0, 1.0)).toColor();
}
