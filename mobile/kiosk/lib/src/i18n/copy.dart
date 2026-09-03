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
    required this.newTokenLabel,
    required this.tapAnywhere,
    required this.trackTurn,
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
  /// Dismisses the confirmation early so the next visitor isn't stuck behind
  /// the previous one's linger/QR window — named for what it does, not for
  /// "closing a dialog".
  final String newTokenLabel;
  final String tapAnywhere;

  /// Uppercase label on the confirmation's QR card, parallel to [yourToken].
  final String trackTurn;

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
    newTokenLabel: 'Next customer',
    tapAnywhere: 'Tap anywhere to continue',
    trackTurn: 'Track your turn',
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
    newTokenLabel: 'العميل التالي',
    tapAnywhere: 'المس أي مكان للمتابعة',
    trackTurn: 'تتبع دورك',
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

  static const mr = KioskCopy(
    prompt: 'कृपया सेवा निवडा',
    promptHint: 'क्रमांक घेण्यासाठी सेवेला स्पर्श करा',
    priority: 'प्राधान्य सहाय्य',
    priorityHint: 'ज्येष्ठ नागरिक आणि सहाय्याची गरज असलेले अभ्यागत',
    priorityArmed: 'पुढील तिकीट प्राधान्याचे असेल',
    yourToken: 'तुमचा टोकन क्रमांक',
    watch: 'तुमच्या क्रमांकासाठी कृपया स्क्रीनकडे लक्ष द्या',
    printing: 'तुमचे तिकीट छापत आहे…',
    printFailed: 'प्रिंटर उपलब्ध नाही. कृपया तुमचा क्रमांक लक्षात ठेवा.',
    printOutOfPaper: 'प्रिंटरमध्ये कागद संपला आहे. कृपया तुमचा क्रमांक लक्षात ठेवा.',
    printCoverOpen: 'प्रिंटरचे झाकण उघडे आहे. कृपया तुमचा क्रमांक लक्षात ठेवा.',
    issuing: 'देत आहे…',
    waitingHere: 'प्रतीक्षेत',
    noneWaiting: 'रांग नाही',
    recent: 'आजची तिकिटे',
    recentEmpty: 'येथे दिलेली तिकिटे या यादीत दिसतील.',
    heroEmpty: 'तुमचे तिकीट येथे दिसेल',
    inQueue: 'रांगेत',
    issuedToday: 'आज दिलेली',
    reprint: 'पुन्हा छापा',
    move: 'हलवा',
    moveTitle: 'दुसऱ्या सेवेकडे हलवा',
    makePriority: 'प्राधान्य द्या',
    clearPriority: 'प्राधान्य काढा',
    priorityTag: 'प्राधान्य',
    cancel: 'रद्द करा',
    newTokenLabel: 'पुढील ग्राहक',
    tapAnywhere: 'सुरू ठेवण्यासाठी कुठेही स्पर्श करा',
    trackTurn: 'तुमची पाळी पाहा',
    takeNumber: 'क्रमांक घ्या',
    offlineBanner: 'रांग सर्व्हरशी कनेक्शन नाही — सध्या तिकिटे देता येणार नाहीत.',
    offlineTitle: 'रांग सर्व्हरशी कनेक्शन नाही',
    offlineBody: 'ही नेटवर्कची समस्या आहे, या कियॉस्कमधील दोष नाही. तुमचा क्रमांक '
        'दिला गेला नाही. कृपया थोडा वेळ थांबा आणि पुन्हा प्रयत्न करा, किंवा '
        'कर्मचाऱ्यांची मदत घ्या.',
    reconnecting: 'पुन्हा कनेक्ट होत आहे…',
    backOnline: 'कनेक्शन पुन्हा सुरू झाले. कृपया तुमच्या सेवेला पुन्हा स्पर्श करा.',
    stillConnecting: 'अजूनही सर्व्हरशी संपर्क साधत आहे…',
    issueFailedTitle: 'तिकीट देता आले नाही',
    tryAgain: 'पुन्हा प्रयत्न करा',
    closeLabel: 'बंद करा',
  );

  static const hi = KioskCopy(
    prompt: 'कृपया सेवा चुनें',
    promptHint: 'नंबर लेने के लिए सेवा को स्पर्श करें',
    priority: 'प्राथमिकता सहायता',
    priorityHint: 'वरिष्ठ नागरिक और सहायता चाहने वाले आगंतुक',
    priorityArmed: 'अगला टिकट प्राथमिकता वाला होगा',
    yourToken: 'आपका टोकन नंबर',
    watch: 'अपने नंबर के लिए कृपया स्क्रीन देखें',
    printing: 'आपका टिकट प्रिंट हो रहा है…',
    printFailed: 'प्रिंटर उपलब्ध नहीं है. कृपया अपना नंबर नोट करें.',
    printOutOfPaper: 'प्रिंटर में कागज़ खत्म हो गया है. कृपया अपना नंबर नोट करें.',
    printCoverOpen: 'प्रिंटर का कवर खुला है. कृपया अपना नंबर नोट करें.',
    issuing: 'जारी हो रहा है…',
    waitingHere: 'प्रतीक्षा में',
    noneWaiting: 'कोई कतार नहीं',
    recent: 'आज के टिकट',
    recentEmpty: 'यहाँ जारी किए गए टिकट इस सूची में दिखाई देंगे.',
    heroEmpty: 'आपका टिकट यहाँ दिखाई देगा',
    inQueue: 'कतार में',
    issuedToday: 'आज जारी',
    reprint: 'पुनः प्रिंट',
    move: 'स्थानांतरित करें',
    moveTitle: 'दूसरी सेवा में स्थानांतरित करें',
    makePriority: 'प्राथमिकता दें',
    clearPriority: 'प्राथमिकता हटाएँ',
    priorityTag: 'प्राथमिकता',
    cancel: 'रद्द करें',
    newTokenLabel: 'अगला ग्राहक',
    tapAnywhere: 'जारी रखने के लिए कहीं भी स्पर्श करें',
    trackTurn: 'अपनी बारी देखें',
    takeNumber: 'नंबर लें',
    offlineBanner: 'कतार सर्वर से कनेक्शन नहीं — अभी टिकट जारी नहीं किए जा सकते.',
    offlineTitle: 'कतार सर्वर से कनेक्शन नहीं',
    offlineBody: 'यह नेटवर्क की समस्या है, इस कियॉस्क में कोई खराबी नहीं. आपका '
        'नंबर जारी नहीं हुआ. कृपया थोड़ी देर प्रतीक्षा करें और फिर से प्रयास '
        'करें, या स्टाफ़ से सहायता लें.',
    reconnecting: 'फिर से कनेक्ट हो रहा है…',
    backOnline: 'कनेक्शन बहाल हो गया. कृपया अपनी सेवा को फिर से स्पर्श करें.',
    stillConnecting: 'अभी भी सर्वर से संपर्क हो रहा है…',
    issueFailedTitle: 'टिकट जारी नहीं किया जा सका',
    tryAgain: 'फिर से प्रयास करें',
    closeLabel: 'बंद करें',
  );

  static KioskCopy of(String lang) {
    switch (lang) {
      case 'ar':
        return ar;
      case 'mr':
        return mr;
      case 'hi':
        return hi;
      default:
        return en;
    }
  }

  static TextDirection directionOf(String lang) =>
      lang == 'ar' ? TextDirection.rtl : TextDirection.ltr;

  // ---------------------------------------------------------------------
  // Header clock. Kiosk-app-only, so not part of the web COPY object. Kept
  // here rather than pulling in `intl`, which would add a package for six
  // strings and two dozen locale bundles the kiosk never uses.
  // ---------------------------------------------------------------------

  static const _weekdays = <String, List<String>>{
    'en': [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday',
      'Friday', 'Saturday', 'Sunday',
    ],
    'ar': [
      'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس',
      'الجمعة', 'السبت', 'الأحد',
    ],
    'mr': [
      'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार',
      'शुक्रवार', 'शनिवार', 'रविवार',
    ],
    'hi': [
      'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार',
      'शुक्रवार', 'शनिवार', 'रविवार',
    ],
  };
  static const _months = <String, List<String>>{
    'en': [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ],
    'ar': [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
    ],
    'mr': [
      'जाने', 'फेब्रु', 'मार्च', 'एप्रिल', 'मे', 'जून',
      'जुलै', 'ऑग', 'सप्टें', 'ऑक्टो', 'नोव्हें', 'डिसें',
    ],
    'hi': [
      'जन', 'फ़र', 'मार्च', 'अप्रैल', 'मई', 'जून',
      'जुल', 'अग', 'सित', 'अक्तू', 'नव', 'दिस',
    ],
  };

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
    final weekday = (_weekdays[lang] ?? _weekdays['en']!)[t.weekday - 1];
    final month = (_months[lang] ?? _months['en']!)[t.month - 1];
    return '$weekday, ${t.day} $month';
  }
}
