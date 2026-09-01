import 'package:flutter/widgets.dart';

/// Verbatim copy of the `COPY` object at the top of
/// components/school/SchoolKiosk.tsx. Do not re-translate or paraphrase — if
/// the web copy changes, copy it across again.
class KioskCopy {
  const KioskCopy({
    required this.prompt,
    required this.promptHint,
    required this.priority,
    required this.priorityHint,
    required this.priorityArmed,
    required this.yourToken,
    required this.watch,
    required this.printing,
    required this.printFailed,
    required this.printOutOfPaper,
    required this.printCoverOpen,
    required this.issuing,
    required this.waitingHere,
    required this.noneWaiting,
    required this.recent,
    required this.recentEmpty,
    required this.heroEmpty,
    required this.inQueue,
    required this.issuedToday,
    required this.reprint,
    required this.move,
    required this.moveTitle,
    required this.makePriority,
    required this.clearPriority,
    required this.priorityTag,
    required this.cancel,
    required this.doneLabel,
    required this.tapAnywhere,
    required this.takeNumber,
    required this.offlineBanner,
    required this.offlineTitle,
    required this.offlineBody,
    required this.reconnecting,
    required this.backOnline,
    required this.stillConnecting,
    required this.issueFailedTitle,
    required this.tryAgain,
    required this.closeLabel,
  });

  final String prompt;
  final String promptHint;
  final String priority;
  final String priorityHint;
  final String priorityArmed;
  final String yourToken;
  final String watch;
  final String printing;
  final String printFailed;
  final String printOutOfPaper;
  final String printCoverOpen;
  final String issuing;
  final String waitingHere;
  final String noneWaiting;
  final String recent;
  final String recentEmpty;
  final String heroEmpty;
  final String inQueue;
  final String issuedToday;
  final String reprint;
  final String move;
  final String moveTitle;
  final String makePriority;
  final String clearPriority;
  final String priorityTag;
  final String cancel;

  // Not in the web COPY — kiosk-app-only affordances.
  final String doneLabel;
  final String tapAnywhere;

  /// The call to action on a single-service branch's hero card. The heading
  /// above the grid ("touch a service…") assumes a choice; when there is only
  /// one service there is nothing to choose, so the card says what pressing it
  /// will actually do.
  final String takeNumber;

  // Connection copy. The web kiosk has no equivalent: a browser tab shows its
  // own network errors, an unattended terminal in a lobby shows nothing unless
  // we say it. Every string here is written for a visitor, not an operator —
  // it must be obvious that the building's network is at fault and that
  // waiting a moment is the fix, so nobody walks away thinking the kiosk is
  // broken.
  final String offlineBanner;
  final String offlineTitle;
  final String offlineBody;
  final String reconnecting;
  final String backOnline;
  final String stillConnecting;
  final String issueFailedTitle;
  final String tryAgain;
  final String closeLabel;

  static const en = KioskCopy(
    prompt: 'Please select a service',
    promptHint: 'Touch a service to take a number',
    priority: 'Priority assistance',
    priorityHint: 'Senior citizens and visitors needing assistance',
    priorityArmed: 'Next ticket will be priority',
    yourToken: 'Your token number',
    watch: 'Please watch the screen for your number',
    printing: 'Printing your ticket…',
    printFailed: 'The printer is unavailable. Please note your number.',
    printOutOfPaper: 'The printer is out of paper. Please note your number.',
    printCoverOpen: 'The printer cover is open. Please note your number.',
    issuing: 'Issuing…',
    waitingHere: 'waiting',
    noneWaiting: 'no queue',
    recent: 'Today’s tickets',
    recentEmpty: 'Tickets issued here will appear in this list.',
    heroEmpty: 'Your ticket will appear here',
    inQueue: 'in queue',
    issuedToday: 'issued today',
    reprint: 'Reprint',
    move: 'Move',
    moveTitle: 'Move to another service',
    makePriority: 'Mark priority',
    clearPriority: 'Clear priority',
    priorityTag: 'Priority',
    cancel: 'Cancel',
    doneLabel: 'Done',
    tapAnywhere: 'Tap anywhere to continue',
    takeNumber: 'Take a number',
    offlineBanner: 'No connection to the queue server — tickets cannot be issued right now.',
    offlineTitle: 'No connection to the queue server',
    offlineBody: 'This is a network problem, not a fault in this kiosk. Your number '
        'was not issued. Please wait a moment and try again, or ask staff for help.',
    reconnecting: 'Reconnecting…',
    backOnline: 'Connection restored. Please touch your service again.',
    stillConnecting: 'Still contacting the server…',
    issueFailedTitle: 'Could not issue a ticket',
    tryAgain: 'Try again',
    closeLabel: 'Close',
  );

  static const ar = KioskCopy(
    prompt: 'يرجى اختيار الخدمة',
    promptHint: 'المس الخدمة للحصول على رقم',
    priority: 'مساعدة ذوي الأولوية',
    priorityHint: 'كبار السن والزوار الذين يحتاجون إلى مساعدة',
    priorityArmed: 'التذكرة التالية ذات أولوية',
    yourToken: 'رقم تذكرتك',
    watch: 'يرجى متابعة الشاشة لظهور رقمك',
    printing: 'جارٍ طباعة التذكرة…',
    printFailed: 'الطابعة غير متاحة. يرجى تدوين رقمك.',
    printOutOfPaper: 'نفد الورق من الطابعة. يرجى تدوين رقمك.',
    printCoverOpen: 'غطاء الطابعة مفتوح. يرجى تدوين رقمك.',
    issuing: 'جارٍ الإصدار…',
    waitingHere: 'في الانتظار',
    noneWaiting: 'لا يوجد انتظار',
    recent: 'تذاكر اليوم',
    recentEmpty: 'ستظهر التذاكر الصادرة هنا في هذه القائمة.',
    heroEmpty: 'ستظهر تذكرتك هنا',
    inQueue: 'في الطابور',
    issuedToday: 'صدرت اليوم',
    reprint: 'إعادة طباعة',
    move: 'نقل',
    moveTitle: 'النقل إلى خدمة أخرى',
    makePriority: 'تعيين كأولوية',
    clearPriority: 'إلغاء الأولوية',
    priorityTag: 'أولوية',
    cancel: 'إلغاء التذكرة',
    doneLabel: 'تم',
    tapAnywhere: 'المس أي مكان للمتابعة',
    takeNumber: 'احصل على رقم',
    offlineBanner: 'لا يوجد اتصال بخادم الطابور — لا يمكن إصدار التذاكر حالياً.',
    offlineTitle: 'لا يوجد اتصال بخادم الطابور',
    offlineBody: 'هذه مشكلة في الشبكة وليست عطلاً في الجهاز. لم يتم إصدار رقمك. '
        'يرجى الانتظار قليلاً والمحاولة مرة أخرى، أو طلب المساعدة من الموظفين.',
    reconnecting: 'جارٍ إعادة الاتصال…',
    backOnline: 'تمت استعادة الاتصال. يرجى لمس الخدمة مرة أخرى.',
    stillConnecting: 'ما زال الاتصال بالخادم جارياً…',
    issueFailedTitle: 'تعذّر إصدار التذكرة',
    tryAgain: 'إعادة المحاولة',
    closeLabel: 'إغلاق',
  );

  static KioskCopy of(String lang) => lang == 'ar' ? ar : en;

  static TextDirection directionOf(String lang) =>
      lang == 'ar' ? TextDirection.rtl : TextDirection.ltr;

  // ---------------------------------------------------------------------
  // Header clock. Kiosk-app-only, so not part of the web COPY object. Kept
  // here rather than pulling in `intl`, which would add a package for six
  // strings and two dozen locale bundles the kiosk never uses.
  // ---------------------------------------------------------------------

  static const _weekdaysEn = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday',
    'Friday', 'Saturday', 'Sunday',
  ];
  static const _weekdaysAr = [
    'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس',
    'الجمعة', 'السبت', 'الأحد',
  ];
  static const _monthsEn = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  static const _monthsAr = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ];

  /// `9:41 AM` / `٩:٤١ ص`-style 12-hour clock (Latin digits in both locales —
  /// the token codes on screen are Latin too, so mixing numeral systems would
  /// read as two different numbers).
  static String clockOf(String lang, DateTime t) {
    final hour = t.hour % 12 == 0 ? 12 : t.hour % 12;
    final minute = t.minute.toString().padLeft(2, '0');
    final suffix = lang == 'ar'
        ? (t.hour < 12 ? 'ص' : 'م')
        : (t.hour < 12 ? 'AM' : 'PM');
    return '$hour:$minute $suffix';
  }

  /// `Saturday, 29 Aug`.
  static String dateOf(String lang, DateTime t) {
    final ar = lang == 'ar';
    final weekday = (ar ? _weekdaysAr : _weekdaysEn)[t.weekday - 1];
    final month = (ar ? _monthsAr : _monthsEn)[t.month - 1];
    return '$weekday, ${t.day} $month';
  }
}
