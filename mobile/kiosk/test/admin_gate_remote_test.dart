import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_kiosk/src/config/admin_pin.dart';
import 'package:school_kiosk/src/config/device_config.dart';
import 'package:school_kiosk/src/config/device_role.dart';
import 'package:school_kiosk/src/printing/printer_settings.dart';
import 'package:school_kiosk/src/state/providers.dart';
import 'package:school_kiosk/src/ui/admin/admin_gate.dart';

/// Stands in for the real controller so the widget tree has a config without
/// touching SharedPreferences.
class _FakeConfigController extends DeviceConfigController {
  _FakeConfigController(this._config);
  final DeviceConfig _config;

  @override
  Future<DeviceConfig> build() async => _config;
}

DeviceConfig _config({String? pinHash, String? pinSalt}) => DeviceConfig(
      baseUrl: 'https://example.test',
      role: DeviceRole.display,
      setupComplete: true,
      branchToken: '',
      screenToken: 'screen-tok',
      webUrl: '',
      adminPinHash: pinHash,
      adminPinSalt: pinSalt,
      adminPinLength: 4,
      printer: const PrinterSettings(),
    );

Future<void> _pump(WidgetTester tester, DeviceConfig config) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        deviceConfigProvider.overrideWith(() => _FakeConfigController(config)),
      ],
      child: MaterialApp(
        // Mirrors _Root in app.dart: something must watch the config provider
        // for it to initialise before AdminGate reads it.
        home: Consumer(
          builder: (context, ref, _) {
            ref.watch(deviceConfigProvider);
            return AdminGate(
              settingsBuilder: (_) =>
                  const Scaffold(body: Text('SETTINGS', key: Key('settings'))),
              child: const Scaffold(body: Text('BOARD')),
            );
          },
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _sendSequence(
  WidgetTester tester, {
  required List<LogicalKeyboardKey> keys,
}) async {
  for (final k in keys) {
    await tester.sendKeyEvent(k);
    await tester.pump();
  }
}

const _unlock = [
  LogicalKeyboardKey.arrowUp,
  LogicalKeyboardKey.arrowUp,
  LogicalKeyboardKey.arrowDown,
  LogicalKeyboardKey.arrowDown,
  LogicalKeyboardKey.select,
];

void main() {
  testWidgets('remote D-pad sequence opens settings when no PIN is set',
      (tester) async {
    await _pump(tester, _config());

    await _sendSequence(tester, keys: _unlock);
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('settings')), findsOneWidget);
  });

  testWidgets('remote D-pad sequence shows the PIN prompt when a PIN is set',
      (tester) async {
    final (hash, salt) = AdminPin.create('1234');
    await _pump(tester, _config(pinHash: hash, pinSalt: salt));

    await _sendSequence(tester, keys: _unlock);
    await tester.pumpAndSettle();

    expect(find.text('Enter the admin PIN'), findsOneWidget);
    expect(find.byKey(const Key('settings')), findsNothing);

    // Enter the PIN on the on-screen pad — a remote has no number keys, so the
    // keypad buttons must be reachable/tappable.
    for (final d in ['1', '2', '3', '4']) {
      await tester.tap(find.text(d));
      await tester.pump();
    }
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('settings')), findsOneWidget);
  });

  testWidgets('a wrong key mid-sequence does not unlock', (tester) async {
    await _pump(tester, _config());

    await _sendSequence(tester, keys: const [
      LogicalKeyboardKey.arrowUp,
      LogicalKeyboardKey.arrowUp,
      LogicalKeyboardKey.arrowLeft, // breaks it
      LogicalKeyboardKey.arrowDown,
      LogicalKeyboardKey.arrowDown,
      LogicalKeyboardKey.select,
    ]);
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('settings')), findsNothing);
  });
}
