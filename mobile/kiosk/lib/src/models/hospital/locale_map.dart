/// A translatable string as it arrives on the wire from the hospital API — a
/// JSON object keyed by locale (`{"en": "...", "hi": "...", "mr": "..."}`).
/// Mirrors `LocaleMap` on the server (lib/region.ts). `en` is every surface's
/// fallback.
typedef LocaleMap = Map<String, String>;

LocaleMap parseLocaleMap(Object? raw) {
  if (raw is Map) {
    final out = <String, String>{};
    raw.forEach((k, v) {
      if (v is String && v.trim().isNotEmpty) out['$k'] = v;
    });
    return out;
  }
  // A plain string (or nothing) — treat it as the English value.
  if (raw is String && raw.trim().isNotEmpty) return {'en': raw};
  return const {};
}

/// The value for [lang], falling back to `en`, then to any present value, then ''.
String pickLocale(LocaleMap map, String lang) {
  final direct = map[lang];
  if (direct != null && direct.trim().isNotEmpty) return direct;
  final en = map['en'];
  if (en != null && en.trim().isNotEmpty) return en;
  for (final v in map.values) {
    if (v.trim().isNotEmpty) return v;
  }
  return '';
}
