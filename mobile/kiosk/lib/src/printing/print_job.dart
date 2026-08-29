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
