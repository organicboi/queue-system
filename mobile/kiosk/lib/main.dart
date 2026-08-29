import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'src/ui/app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Unattended touch terminal: hide the system bars. Lock-task mode and the
  // boot receiver come in step 6 of the plan (§7).
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  SystemChrome.setPreferredOrientations(const [
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
    DeviceOrientation.portraitUp,
  ]);

  runApp(const ProviderScope(child: KioskApp()));
}
