import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Visual language for the parent-facing kiosk. Tuned for a fixed 1366×768
/// landscape terminal on a low-power RK3566 chip: flat surfaces, hairline
/// borders, one soft shadow, no blur — heavy compositing drops frames on this
/// GPU.
///
/// The kiosk is **light-mode only**. There is no dark palette anywhere in the
/// app: a lobby terminal is bright-room hardware, and a system dark mode
/// flipping the screen at dusk would leave a half-inverted, unreadable UI.
/// `buildKioskTheme()` is wired into every ThemeData slot in app.dart.
class KioskPalette {
  KioskPalette._();

  static const bg = Color(0xFFF7F8FC);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceMuted = Color(0xFFF1F3F9);
  static const border = Color(0xFFE7EBF2);
  static const borderStrong = Color(0xFFD6DCE7);

  static const ink = Color(0xFF101828);
  static const inkSoft = Color(0xFF5B6577);
  static const inkFaint = Color(0xFF98A1B0);

  static const primary = Color(0xFF2F5BEA);
  static const primaryInk = Color(0xFFFFFFFF);
  static const primarySoft = Color(0xFFE9EEFE);

  static const priority = Color(0xFFB4530A);
  static const prioritySoft = Color(0xFFFDF0E3);

  static const success = Color(0xFF15803D);
  static const successSoft = Color(0xFFE6F5EC);
  static const danger = Color(0xFFB91C1C);
  static const dangerSoft = Color(0xFFFCE8E8);

  /// One reusable shadow. Cheap: single layer, low blur.
  static const cardShadow = [
    BoxShadow(color: Color(0x0F1E293B), blurRadius: 14, offset: Offset(0, 6)),
  ];

  /// Barely-there lift for the header and floating pills.
  static const hairShadow = [
    BoxShadow(color: Color(0x08101828), blurRadius: 6, offset: Offset(0, 2)),
  ];

  static const radius = 22.0;
  static const radiusSm = 14.0;
  static const radiusPill = 999.0;

  /// Header bar height. Fixed so the service area below it is predictable.
  static const headerHeight = 78.0;

  /// Status/nav bar styling for the rare moment the system bars are swiped in
  /// over the immersive kiosk — dark glyphs on our light chrome.
  static const systemOverlay = SystemUiOverlayStyle(
    statusBarColor: Color(0x00000000),
    statusBarBrightness: Brightness.light,
    statusBarIconBrightness: Brightness.dark,
    systemNavigationBarColor: surface,
    systemNavigationBarIconBrightness: Brightness.dark,
    systemNavigationBarDividerColor: border,
  );
}

/// One number that expresses "how much bigger/smaller is this screen than the
/// 1366×768 reference". Everything that must scale with the device — text (via
/// the MediaQuery override in app.dart) and the few genuinely fixed boxes (the
/// header bar, the grid's row-height clamps) — multiplies by this.
///
/// It's the *smaller* of the width and height ratios, so scaling up never
/// pushes content off the short axis, and it's clamped hard so a phone or an
/// oversized panel still lands in a sane range. Deliberately independent of the
/// OS font-size setting — that stays pinned off (see app.dart).
double kioskScale(BuildContext context) =>
    kioskScaleForSize(MediaQuery.sizeOf(context));

double kioskScaleForSize(Size size) {
  if (size.isEmpty) return 1;
  final r = math.min(size.width / 1366.0, size.height / 768.0);
  if (!r.isFinite || r <= 0) return 1;
  return r.clamp(0.82, 1.7);
}

/// Tighter band for text: the layout tolerates boxes growing 70%, but letting
/// every string grow that much turns a calm screen shouty and risks a label
/// outrunning a box that isn't itself scaled.
double kioskTextScaleForSize(Size size) =>
    kioskScaleForSize(size).clamp(0.9, 1.28);

/// Same idea as [kioskScaleForSize] but for the announcement board: a TV is
/// read from across a room rather than touched from arm's length, so it's
/// scaled off a 1920×1080 baseline instead of the kiosk's 1366×768, and the
/// text band is wider — a wall-mounted screen has no touch targets to keep
/// text from overflowing, only readability to protect.
double boardScaleForSize(Size size) {
  if (size.isEmpty) return 1;
  final r = math.min(size.width / 1920.0, size.height / 1080.0);
  if (!r.isFinite || r <= 0) return 1;
  return r.clamp(0.6, 2.2);
}

double boardTextScaleForSize(Size size) => boardScaleForSize(size).clamp(0.75, 1.6);

ThemeData buildKioskTheme() {
  const scheme = ColorScheme.light(
    primary: KioskPalette.primary,
    onPrimary: KioskPalette.primaryInk,
    primaryContainer: KioskPalette.primarySoft,
    onPrimaryContainer: KioskPalette.primary,
    surface: KioskPalette.surface,
    onSurface: KioskPalette.ink,
    surfaceContainerHighest: KioskPalette.surfaceMuted,
    error: KioskPalette.danger,
    errorContainer: KioskPalette.dangerSoft,
    onErrorContainer: KioskPalette.danger,
    outline: KioskPalette.border,
    outlineVariant: KioskPalette.border,
  );

  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: scheme,
    scaffoldBackgroundColor: KioskPalette.bg,
    canvasColor: KioskPalette.bg,
    fontFamilyFallback: const [
      'Noto Sans Arabic',
      'Noto Naskh Arabic',
      'Geeza Pro',
      'Arial',
    ],
    splashFactory: InkSparkle.splashFactory,
  );

  return base.copyWith(
    textTheme: base.textTheme.apply(
      bodyColor: KioskPalette.ink,
      displayColor: KioskPalette.ink,
    ).copyWith(
      displayLarge: const TextStyle(
        fontSize: 132,
        height: 1.0,
        fontWeight: FontWeight.w800,
        letterSpacing: -2,
      ),
      headlineMedium: const TextStyle(fontSize: 32, fontWeight: FontWeight.w700),
      headlineSmall: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700),
      titleLarge: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
      titleMedium: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
      bodyLarge: const TextStyle(fontSize: 17, color: KioskPalette.inkSoft),
      bodyMedium: const TextStyle(fontSize: 15, color: KioskPalette.inkSoft),
      labelLarge: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
    ),
    dividerTheme: const DividerThemeData(
      color: KioskPalette.border,
      thickness: 1,
      space: 1,
    ),
    // Every tap target on a kiosk is finger-sized; the Material defaults are
    // mouse-sized.
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 56),
        padding: const EdgeInsets.symmetric(horizontal: 28),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(KioskPalette.radiusSm),
        ),
        textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 56),
        padding: const EdgeInsets.symmetric(horizontal: 28),
        side: const BorderSide(color: KioskPalette.borderStrong),
        foregroundColor: KioskPalette.ink,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(KioskPalette.radiusSm),
        ),
        textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: KioskPalette.surfaceMuted,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(KioskPalette.radiusSm),
        borderSide: const BorderSide(color: KioskPalette.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(KioskPalette.radiusSm),
        borderSide: const BorderSide(color: KioskPalette.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(KioskPalette.radiusSm),
        borderSide: const BorderSide(color: KioskPalette.primary, width: 1.6),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: KioskPalette.ink,
      contentTextStyle: const TextStyle(
        color: Colors.white,
        fontSize: 16,
        fontWeight: FontWeight.w600,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(KioskPalette.radiusSm),
      ),
      behavior: SnackBarBehavior.floating,
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: KioskPalette.primary,
    ),
  );
}
