import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/providers.dart';
import 'kiosk_screen.dart';
import 'setup_screen.dart';

class KioskApp extends StatelessWidget {
  const KioskApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VibeQueue Kiosk',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF2563EB),
        scaffoldBackgroundColor: const Color(0xFFF1F5F9),
        fontFamily: 'Roboto',
      ),
      home: const _Root(),
    );
  }
}

/// Shows the setup screen until the device has a branch token, then the kiosk.
class _Root extends ConsumerWidget {
  const _Root();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = ref.watch(kioskConfigProvider);

    return config.when(
      loading: () => const _Splash(),
      error: (e, _) => _Splash(message: '$e'),
      data: (cfg) => cfg.isComplete ? const KioskScreen() : const SetupScreen(),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash({this.message});
  final String? message;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: message == null
            ? const CircularProgressIndicator()
            : Padding(
                padding: const EdgeInsets.all(32),
                child: Text(message!, textAlign: TextAlign.center),
              ),
      ),
    );
  }
}
