import 'package:flutter_test/flutter_test.dart';
import 'package:school_kiosk/src/models/kiosk_bootstrap.dart';
import 'package:school_kiosk/src/models/kiosk_feed.dart';
import 'package:school_kiosk/src/models/school_token.dart';

void main() {
  test('KioskBootstrap parses the packet shape', () {
    final b = KioskBootstrap.fromJson({
      'status': 'ok',
      'branchId': 'br-1',
      'branchName': 'Main Campus',
      'customerId': 'cu-1',
      'departments': [
        {
          'id': 'd1',
          'nameEn': 'Reception',
          'nameAr': 'الاستقبال',
          'prefix': 'R',
          'color': '#2563EB',
          'displayOrder': 1,
          'isActive': true,
        }
      ],
      'settings': {
        'schoolNameEn': 'Vibe School',
        'languages': ['en', 'ar'],
        'priorityEnabled': true,
        'printEnabled': true,
      },
      'silentPrint': false,
      'printerName': '',
    });

    expect(b.branchName, 'Main Campus');
    expect(b.departments.single.name('ar'), 'الاستقبال');
    expect(b.languages, ['en', 'ar']);
    expect(b.settings?.priorityEnabled, true);
  });

  test('KioskFeed.withNewToken prepends and caps', () {
    var feed = KioskFeed.empty;
    for (var i = 0; i < 35; i++) {
      feed = feed.withNewToken(
        SchoolToken.fromJson({
          'id': 't$i',
          'departmentId': 'd1',
          'number': i,
          'tokenCode': 'R$i',
          'status': 'waiting',
        }),
      );
    }
    expect(feed.recent.length, 30);
    expect(feed.recent.first.tokenCode, 'R34');
  });

  test('SchoolToken.isAmendable only for waiting/held', () {
    SchoolToken t(String status) =>
        SchoolToken.fromJson({'id': 'x', 'status': status});
    expect(t('waiting').isAmendable, true);
    expect(t('held').isAmendable, true);
    expect(t('called').isAmendable, false);
    expect(t('served').isAmendable, false);
  });
}
