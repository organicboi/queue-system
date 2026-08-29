import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'src/ui/app.dart';
import 'src/ui/theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Unattended touch terminal: hide the system bars. Lock-task mode and the
  // boot receiver come in step 6 of the plan (§7).
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);

  // If a swipe does pull the bars in, they match the light chrome instead of
  // flashing the OS default (which follows the device's dark mode).
  SystemChrome.setSystemUIOverlayStyle(KioskPalette.systemOverlay);

  // The kiosk hardware is a fixed 1366×768 landscape tablet — lock to it so a
  // wall mount that reports portrait can't rotate the UI.
  SystemChrome.setPreferredOrientations(const [
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);

  runApp(const ProviderScope(child: KioskApp()));
}
