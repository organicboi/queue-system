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

Future<void> pumpTicket(WidgetTester tester, TicketData data) async {
  await tester.pumpWidget(MaterialApp(
    home: SingleChildScrollView(
      child: SizedBox(
        width: 576,
        child: buildTicketWidget(data: data, widthDots: 576),
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

  testWidgets('an unknown count leaves the line off entirely', (tester) async {
    // Null is what a reprint with no network hands us: better a ticket without
    // the line than one claiming the visitor is next.
    await pumpTicket(tester, ticket());
    expect(find.textContaining('waiting before you'), findsNothing);
    expect(find.text('You are next in line'), findsNothing);
    expect(find.text('A-012'), findsOneWidget);
  });
}
