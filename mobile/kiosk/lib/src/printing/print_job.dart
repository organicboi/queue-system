import 'ticket_widget.dart';

/// One ticket to print. Carries the fully-resolved [TicketData] — the caller
/// (a vertical's kiosk controller) has already merged the token, the
/// department/doctor, the branch branding and the public-tracking gate into it,
/// so the printer itself is vertical-neutral: it rasters [data] and sends it.
class PrintJob {
  PrintJob({required this.data}) : key = DateTime.now().microsecondsSinceEpoch;

  final int key;
  final TicketData data;
}

enum PrintResult { printed, failed }

/// Why a print failed, distinct enough to show a different message — there is
/// nobody standing at an unattended kiosk to notice a silent failure, so the
/// reason matters as much as the fact of it.
enum PrintFailureReason { outOfPaper, coverOpen, unreachable, unknown }

/// What a [Printer] actually returns for one job — the bare success/failure
/// plus, on failure, why.
class PrintAttempt {
  const PrintAttempt(this.result, {this.reason});

  final PrintResult result;
  final PrintFailureReason? reason;

  bool get isFailure => result == PrintResult.failed;

  static const ok = PrintAttempt(PrintResult.printed);

  factory PrintAttempt.failure([PrintFailureReason reason = PrintFailureReason.unknown]) =>
      PrintAttempt(PrintResult.failed, reason: reason);
}
