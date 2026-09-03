import 'package:flutter/widgets.dart';

/// Verbatim port of the `COPY` and `PRIORITY_CATEGORIES` objects at the top of
/// components/hospital/HospitalKiosk.tsx. Do not re-translate — if the web copy
/// changes, copy it across again. Kept separate from [KioskCopy] so the school
/// copy is untouched.
class HospitalCopy {
  const HospitalCopy({
    required this.pick,
    required this.pickDoctor,
    required this.anyDoctor,
    required this.priority,
    required this.none,
    required this.confirm,
    required this.yourToken,
    required this.waiting,
    required this.proceed,
    required this.back,
    required this.fee,
    required this.notSetUp,
    required this.issuing,
    required this.tryReception,
    required this.noServices,
    required this.offline,
  });

  final String pick;
  final String pickDoctor;
  final String anyDoctor;
  final String priority;
  final String none;
  final String confirm;
  final String yourToken;
  final String waiting;
  final String proceed;
  final String back;
  final String fee;
  final String notSetUp;
  final String issuing;
  final String tryReception;
  final String noServices;
  final String offline;

  static const en = HospitalCopy(
    pick: 'Choose a department',
    pickDoctor: 'Choose a doctor',
    anyDoctor: 'No preference',
    priority: 'Do any of these apply?',
    none: 'None — continue',
    confirm: 'Get token',
    yourToken: 'Your token',
    waiting: 'people ahead of you',
    proceed: 'Please watch the board',
    back: 'Back',
    fee: 'Fee',
    notSetUp: 'No doctors on duty for this department today',
    issuing: 'Issuing…',
    tryReception: 'Please ask at reception',
    noServices: 'No services are set up for this kiosk yet. Please ask staff for help.',
    offline: 'No connection to the queue server — tokens cannot be issued right now.',
  );

  static const hi = HospitalCopy(
    pick: 'विभाग चुनें',
    pickDoctor: 'डॉक्टर चुनें',
    anyDoctor: 'कोई भी',
    priority: 'क्या इनमें से कोई लागू है?',
    none: 'कोई नहीं — आगे बढ़ें',
    confirm: 'टोकन लें',
    yourToken: 'आपका टोकन',
    waiting: 'लोग आपसे पहले',
    proceed: 'कृपया बोर्ड देखें',
    back: 'वापस',
    fee: 'शुल्क',
    notSetUp: 'आज इस विभाग में कोई डॉक्टर नहीं',
    issuing: 'जारी हो रहा है…',
    tryReception: 'कृपया रिसेप्शन पर पूछें',
    noServices: 'इस कियॉस्क के लिए अभी तक कोई सेवा सेट नहीं की गई है. कृपया स्टाफ़ से सहायता लें.',
    offline: 'कतार सर्वर से कनेक्शन नहीं — अभी टोकन जारी नहीं हो सकते.',
  );

  static const mr = HospitalCopy(
    pick: 'विभाग निवडा',
    pickDoctor: 'डॉक्टर निवडा',
    anyDoctor: 'कोणीही',
    priority: 'यापैकी काही लागू आहे का?',
    none: 'काहीही नाही — पुढे चला',
    confirm: 'टोकन घ्या',
    yourToken: 'तुमचे टोकन',
    waiting: 'लोक तुमच्या आधी',
    proceed: 'कृपया बोर्ड पहा',
    back: 'मागे',
    fee: 'शुल्क',
    notSetUp: 'आज या विभागात डॉक्टर नाहीत',
    issuing: 'जारी होत आहे…',
    tryReception: 'कृपया रिसेप्शनला विचारा',
    noServices: 'या कियॉस्कसाठी अद्याप कोणतीही सेवा सेट केलेली नाही. कृपया कर्मचाऱ्यांची मदत घ्या.',
    offline: 'रांग सर्व्हरशी कनेक्शन नाही — सध्या टोकन देता येणार नाहीत.',
  );

  static const ar = HospitalCopy(
    pick: 'اختر القسم',
    pickDoctor: 'اختر الطبيب',
    anyDoctor: 'لا تفضيل',
    priority: 'هل ينطبق أي مما يلي؟',
    none: 'لا شيء — متابعة',
    confirm: 'احصل على تذكرة',
    yourToken: 'تذكرتك',
    waiting: 'أشخاص قبلك',
    proceed: 'يرجى متابعة الشاشة',
    back: 'رجوع',
    fee: 'الرسوم',
    notSetUp: 'لا يوجد أطباء في هذا القسم اليوم',
    issuing: 'جارٍ الإصدار…',
    tryReception: 'يرجى السؤال في الاستقبال',
    noServices: 'لم يتم إعداد أي خدمات لهذا الجهاز بعد. يرجى طلب المساعدة من الموظفين.',
    offline: 'لا يوجد اتصال بخادم الطابور — لا يمكن إصدار التذاكر الآن.',
  );

  static HospitalCopy of(String lang) => switch (lang) {
        'hi' => hi,
        'mr' => mr,
        'ar' => ar,
        _ => en,
      };

  static TextDirection directionOf(String lang) =>
      lang == 'ar' ? TextDirection.rtl : TextDirection.ltr;
}

/// The self-declared priority categories shown on the confirm step — key
/// matches `hospital_tokens.priority_category` and the server allow-list in
/// `hospitalIssueTokenAction`.
class HospitalPriorityCategory {
  const HospitalPriorityCategory(this.key, this._labels);
  final String key;
  final Map<String, String> _labels;

  String label(String lang) => _labels[lang] ?? _labels['en'] ?? key;

  static const all = <HospitalPriorityCategory>[
    HospitalPriorityCategory('senior', {
      'en': 'Senior citizen (60+)',
      'hi': 'वरिष्ठ नागरिक (60+)',
      'mr': 'ज्येष्ठ नागरिक (60+)',
      'ar': 'كبار السن (60+)',
    }),
    HospitalPriorityCategory('pregnant', {
      'en': 'Pregnant',
      'hi': 'गर्भवती',
      'mr': 'गर्भवती',
      'ar': 'حامل',
    }),
    HospitalPriorityCategory('differently-abled', {
      'en': 'Differently-abled',
      'hi': 'दिव्यांग',
      'mr': 'दिव्यांग',
      'ar': 'من ذوي الهمم',
    }),
    HospitalPriorityCategory('emergency', {
      'en': 'Emergency',
      'hi': 'आपातकाल',
      'mr': 'आणीबाणी',
      'ar': 'طارئ',
    }),
  ];
}
