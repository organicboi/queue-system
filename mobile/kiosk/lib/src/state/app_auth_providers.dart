import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/app_api.dart';
import '../config/auth_session.dart';
import 'providers.dart';

/// Secure storage for the operator session. Overridden with an in-memory fake
/// in tests.
final secureStoreProvider = Provider<SecureStore>((_) => FlutterSecureStorageStore());

/// The operator's Supabase session, loaded from secure storage on boot. `null`
/// means "not signed in" — a normal, non-error state: a provisioned kiosk/board
/// keeps running on its long token, and only the Settings screen's re-provision
/// and tenant-settings sections need a live session.
final authSessionProvider =
    AsyncNotifierProvider<AuthSessionController, AuthSession?>(AuthSessionController.new);

class AuthSessionController extends AsyncNotifier<AuthSession?> {
  SecureStore get _store => ref.read(secureStoreProvider);

  @override
  Future<AuthSession?> build() => AuthSession.load(_store);

  Future<void> signIn(AppLoginResult result) async {
    await result.session.save(_store);
    state = AsyncData(result.session);
  }

  /// Persist a session produced by a silent token refresh.
  Future<void> applyRefreshed(AuthSession session) async {
    await session.save(_store);
    state = AsyncData(session);
  }

  Future<void> signOut() async {
    await AuthSession.clear(_store);
    state = const AsyncData(null);
  }
}

/// Builds an [AppApi] for an arbitrary base URL with no session — used by setup
/// and the inline re-login dialog, where the URL is being typed and no session
/// exists yet. A provider (not a bare constructor) so tests can inject a fake.
final appApiFactoryProvider = Provider<AppApi Function(String baseUrl)>((ref) {
  return (baseUrl) => AppApi(
        baseUrl: baseUrl,
        currentSession: () => null,
        onSessionRefreshed: (_) async {},
      );
});

/// Client for `app/api/app/*`, rebuilt when the server URL changes.
final appApiProvider = Provider<AppApi>((ref) {
  final cfg = ref.watch(deviceConfigProvider).requireValue;
  return AppApi(
    baseUrl: cfg.baseUrl,
    currentSession: () => ref.read(authSessionProvider).value,
    onSessionRefreshed: (s) =>
        ref.read(authSessionProvider.notifier).applyRefreshed(s),
    onAuthExpired: () {
      // The session lapsed; drop it but leave the device provisioned so the
      // kiosk/board keeps operating on its branch/screen token.
      final notifier = ref.read(authSessionProvider.notifier);
      Future.microtask(notifier.signOut);
    },
  );
});

/// The tenant's server-side settings for a branch (Settings screen).
final tenantSettingsProvider =
    FutureProvider.autoDispose.family<TenantSettings, String>((ref, branchId) {
  return ref.watch(appApiProvider).getSettings(branchId: branchId);
});

/// Fully unprovision the device: clear the operator session AND the role/token
/// config, dropping back to the setup wizard. Used on "Sign out", on a
/// server-reported unregistered token, and after the server URL changes.
Future<void> deprovision(WidgetRef ref) async {
  await ref.read(authSessionProvider.notifier).signOut();
  await ref.read(deviceConfigProvider.notifier).reset();
}
