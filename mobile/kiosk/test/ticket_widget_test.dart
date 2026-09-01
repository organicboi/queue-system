import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_kiosk/src/printing/ticket_widget.dart';

TicketData ticket({int? waitingAhead}) => TicketData(
      schoolNameEn: 'Vibe School',
      schoolNameAr: 'مدرسة فايب',
      tokenCode: 'A-012',
      departmentNameEn: 'Admissions',
      departmentNameAr: 'القبول',
      isPriority: false,
      footerEn: 'Please keep this ticket',
      footerAr: '',
      issuedAt: DateTime(2026, 9, 1, 9, 41),
      waitingAhead: waitingAhead,
    );

Future<void> pumpTicket(WidgetTester tester, TicketData data,
    {int widthDots = 576}) async {
  await tester.pumpWidget(MaterialApp(
    home: SingleChildScrollView(
      child: SizedBox(
        width: widthDots.toDouble(),
        child: buildTicketWidget(data: data, widthDots: widthDots),
      ),
    ),
  ));
}

void main() {
  test('waitingAheadLine counts, and says "next" at zero', () {
    expect(waitingAheadLine(0).en, 'You are next in line');
    expect(waitingAheadLine(1).en, '1 person waiting before you');
    expect(waitingAheadLine(7).en, '7 people waiting before you');
    // Arabic is a count, not a plural — one phrasing for every number.
    expect(waitingAheadLine(7).ar, contains('7'));
  });

  testWidgets('the ticket prints the queue ahead of the visitor', (tester) async {
    await pumpTicket(tester, ticket(waitingAhead: 3));
    expect(find.text('3 people waiting before you'), findsOneWidget);
    expect(find.text(waitingAheadLine(3).ar), findsOneWidget);
  });

  // The 384-dot roll is the tighter of the two widths and the one actually
  // fitted on site, so the layout gets exercised there too — every earlier
  // test pumps the 576-dot baseline only.
  //
  // Deliberately no assertion on line counts or text width: widget tests
  // render with a placeholder font whose glyphs are square em boxes, far
  // wider than the real face, so any such assertion would measure the test
  // font rather than the ticket. Wrapping is checked on paper, not here.
  testWidgets('every line survives the 58mm layout', (tester) async {
    await pumpTicket(
      tester,
      TicketData(
        schoolNameEn: 'ALJAZEERA ACADEMY',
        schoolNameAr: 'أكاديمية الجزيرة',
        tokenCode: 'AC51',
        departmentNameEn: 'ACCOUNTS',
        departmentNameAr: 'الحسابات',
        isPriority: false,
        footerEn: 'Please keep this ticket',
        footerAr: '',
        issuedAt: DateTime(2026, 9, 1, 16, 34),
        waitingAhead: 2,
      ),
      widthDots: 384,
    );

    expect(find.text('ALJAZEERA ACADEMY'), findsOneWidget);
    expect(find.text('AC51'), findsOneWidget);
    expect(find.text('ACCOUNTS'), findsOneWidget);
    expect(find.text('2 people waiting before you'), findsOneWidget);
    expect(find.text('01/09/2026 04:34 PM'), findsOneWidget);
    expect(find.text('Please keep this ticket'), findsOneWidget);
  });

  testWidgets('an unknown count leaves the line off entirely', (tester) async {
    // Null is what a reprint with no network hands us: better a ticket without
    // the line than one claiming the visitor is next.
    await pumpTicket(tester, ticket());
    expect(find.textContaining('waiting before you'), findsNothing);
    expect(find.text('You are next in line'), findsNothing);
    expect(find.text('A-012'), findsOneWidget);
  });
}
