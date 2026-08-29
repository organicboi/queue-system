import 'package:shared_preferences/shared_preferences.dart';

import 'app_config.dart';

/// Per-device provisioning: the branch token and the server base URL, set once
/// during kiosk setup and persisted so they survive restarts.
///
/// Open question for the product owner (§9 of the plan): how a new tablet gets
/// its branch token — manual entry, QR scan, or a pre-baked build. This stores
/// whatever the setup screen collects; a QR path can be added later without
/// changing this.
class KioskConfig {
  const KioskConfig({required this.baseUrl, required this.branchToken});

  final String baseUrl;
  final String branchToken;

  bool get isComplete => branchToken.trim().isNotEmpty && baseUrl.trim().isNotEmpty;

  static const _kBaseUrl = 'kiosk.baseUrl';
  static const _kBranchToken = 'kiosk.branchToken';

  static Future<KioskConfig> load() async {
    final prefs = await SharedPreferences.getInstance();
    return KioskConfig(
      baseUrl: prefs.getString(_kBaseUrl) ?? AppConfig.defaultBaseUrl,
      branchToken: prefs.getString(_kBranchToken) ?? '',
    );
  }

  Future<void> save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kBaseUrl, baseUrl.trim());
    await prefs.setString(_kBranchToken, branchToken.trim());
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kBranchToken);
    // Base URL is kept — it rarely changes and re-typing it is friction.
  }

  KioskConfig copyWith({String? baseUrl, String? branchToken}) => KioskConfig(
        baseUrl: baseUrl ?? this.baseUrl,
        branchToken: branchToken ?? this.branchToken,
      );
}
