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
  );

  static KioskCopy of(String lang) => lang == 'ar' ? ar : en;

  static TextDirection directionOf(String lang) =>
      lang == 'ar' ? TextDirection.rtl : TextDirection.ltr;
}
