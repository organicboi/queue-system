import '../models/school_department.dart';
import '../models/school_token.dart';

/// One ticket to print. Carries its own department because a reprint from the
/// recent-tickets rail can be for a service other than the one last tapped
/// (see the `PrintJob` interface in components/school/SchoolKiosk.tsx).
class PrintJob {
  PrintJob({required this.token, required this.department})
      : key = DateTime.now().microsecondsSinceEpoch;

  final int key;
  final SchoolToken token;
  final SchoolDepartment department;
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
