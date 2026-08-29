import 'package:flutter_test/flutter_test.dart';
import 'package:school_kiosk/src/announce/announcer.dart';
import 'package:school_kiosk/src/models/board_packet.dart';

void main() {
  group('spellToken', () {
    test('short digit runs are read naturally, not spelled out', () {
      expect(spellToken('A5'), 'A, 5');
      expect(spellToken('A12'), 'A, 12');
    });

    test('3+ digit runs are spelled digit by digit — mirrors announce.ts', () {
      expect(spellToken('A104'), 'A, 1, 0, 4');
      expect(spellToken('F201'), 'F, 2, 0, 1');
    });

    test('multi-letter prefixes spell every letter', () {
      expect(spellToken('AB12'), 'A, B, 12');
    });

    test('empty/null input', () {
      expect(spellToken(''), '');
      expect(spellToken(null), '');
    });
  });

  test('fillTemplate substitutes {token} and {counter}', () {
    expect(
      fillTemplate('Token {token}, please proceed to {counter}', 'A, 1, 0, 4', 'Counter 3'),
      'Token A, 1, 0, 4, please proceed to Counter 3',
    );
  });

  group('AnnouncementDedupe', () {
    BoardCounter counter({required String id, String? tokenId, String? tokenCode, int recallCount = 0}) {
      return BoardCounter(
        id: id,
        nameEn: 'Counter $id',
        nameAr: '',
        displayOrder: 0,
        isOpen: true,
        tokenId: tokenId,
        tokenCode: tokenCode,
        calledAt: tokenCode == null ? null : '2026-01-01T00:00:00Z',
        recallCount: recallCount,
        isPriority: false,
        departmentEn: null,
        departmentAr: null,
        departmentColor: null,
      );
    }

    test('does not announce anything on the very first packet — a freshly '
        'opened board must not replay every call already in progress', () {
      final dedupe = AnnouncementDedupe();
      final fresh = dedupe.newCalls([counter(id: 'c1', tokenId: 't1', tokenCode: 'A101')]);
      expect(fresh, isEmpty);
    });

    test('announces a genuinely new call after priming', () {
      final dedupe = AnnouncementDedupe();
      dedupe.newCalls([counter(id: 'c1')]); // prime with nothing called

      final fresh = dedupe.newCalls([counter(id: 'c1', tokenId: 't1', tokenCode: 'A101')]);
      expect(fresh, hasLength(1));
      expect(fresh.single.tokenCode, 'A101');
    });

    test('does not re-announce the same call on a later, unchanged poll', () {
      final dedupe = AnnouncementDedupe();
      final withCall = [counter(id: 'c1', tokenId: 't1', tokenCode: 'A101')];
      dedupe.newCalls([counter(id: 'c1')]);
      dedupe.newCalls(withCall);

      final fresh = dedupe.newCalls(withCall);
      expect(fresh, isEmpty);
    });

    test('a recall (same token, bumped recallCount) announces again — a '
        'recall changes no other visible column', () {
      final dedupe = AnnouncementDedupe();
      dedupe.newCalls([counter(id: 'c1')]);
      dedupe.newCalls([counter(id: 'c1', tokenId: 't1', tokenCode: 'A101', recallCount: 0)]);

      final fresh = dedupe
          .newCalls([counter(id: 'c1', tokenId: 't1', tokenCode: 'A101', recallCount: 1)]);
      expect(fresh, hasLength(1));
    });
  });
}
