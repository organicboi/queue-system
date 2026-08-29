import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:school_kiosk/src/config/device_config.dart';
import 'package:school_kiosk/src/config/device_role.dart';
import 'package:school_kiosk/src/printing/printer_settings.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('a fresh device with no saved keys has no role and is not complete', () async {
    final cfg = await DeviceConfig.load();
    expect(cfg.role, isNull);
    expect(cfg.setupComplete, isFalse);
    expect(cfg.isComplete, isFalse);
  });

  test('migration: legacy kiosk.branchToken with no device.role becomes a '
      'completed kiosk — an already-deployed tablet must not be sent back '
      'to setup after an update', () async {
    SharedPreferences.setMockInitialValues({
      'kiosk.baseUrl': 'https://queue-system-urzl.vercel.app',
      'kiosk.branchToken': 'abc123',
    });

    final cfg = await DeviceConfig.load();
    expect(cfg.role, DeviceRole.kiosk);
    expect(cfg.setupComplete, isTrue);
    expect(cfg.isComplete, isTrue);
    expect(cfg.branchToken, 'abc123');
  });

  test('a device with an explicit role is never migrated', () async {
    SharedPreferences.setMockInitialValues({
      'kiosk.baseUrl': 'https://example.com',
      'device.role': 'display',
      'device.screenToken': 'scr-1',
      'device.setupComplete': true,
    });

    final cfg = await DeviceConfig.load();
    expect(cfg.role, DeviceRole.display);
    expect(cfg.isComplete, isTrue);
  });

  test('clearProvisioning keeps baseUrl and the admin PIN', () async {
    SharedPreferences.setMockInitialValues({
      'kiosk.baseUrl': 'https://example.com',
      'kiosk.branchToken': 'abc123',
      'device.pinHash': 'somehash',
      'device.pinSalt': 'somesalt',
    });

    await DeviceConfig.clearProvisioning();
    final cfg = await DeviceConfig.load();

    expect(cfg.baseUrl, 'https://example.com');
    expect(cfg.branchToken, isEmpty);
    expect(cfg.role, isNull);
    expect(cfg.adminPinHash, 'somehash');
  });

  test('save/load round-trips every field including printer settings', () async {
    const config = DeviceConfig(
      baseUrl: 'https://example.com',
      role: DeviceRole.kiosk,
      setupComplete: true,
      branchToken: 'tok-1',
      screenToken: '',
      webUrl: '',
      adminPinHash: 'hash',
      adminPinSalt: 'salt',
      adminPinLength: 6,
      printer: PrinterSettings(
        transport: PrinterTransportKind.network,
        networkHost: '192.168.1.50',
      ),
    );
    await config.save();

    final loaded = await DeviceConfig.load();
    expect(loaded.branchToken, 'tok-1');
    expect(loaded.adminPinLength, 6);
    expect(loaded.printer.transport.storageValue, 'network');
    expect(loaded.printer.networkHost, '192.168.1.50');
  });
}
