/**
 * The consent forms a hospital sends or prints, in the three languages patients are given them in, and the words on
 * the page a patient opens to sign. Pure data: the server builds the forms from it, and the browser renders the sign
 * page, the printable form and the signed copy from it.
 *
 * The wording is a plain-language starting text. Have your doctors / legal adviser review it before relying on it.
 */

export const CONSENT_LANGUAGES = ["English", "Hindi", "Gujarati"] as const;
export type ConsentLanguage = (typeof CONSENT_LANGUAGES)[number];

/** Each language written in itself, as a patient would look for it. */
export const LANGUAGE_NAME: Record<ConsentLanguage, string> = { English: "English", Hindi: "हिन्दी", Gujarati: "ગુજરાતી" };
/** The HTML `lang` for text in each language, so the browser picks the right font and hyphenation. */
export const LANGUAGE_TAG: Record<ConsentLanguage, string> = { English: "en", Hindi: "hi", Gujarati: "gu" };

type L = Record<ConsentLanguage, string>;

export interface ConsentFormDef {
  key: string;
  title: L;
  body: L;
}

export const CONSENT_FORMS: ConsentFormDef[] = [
  {
    key: "general-consent",
    title: { English: "General consent", Hindi: "सामान्य सहमति", Gujarati: "સામાન્ય સંમતિ" },
    body: {
      English: "I give my consent for examination, investigations and treatment by the doctors and staff of this hospital. I have been told about my condition and the care planned, and I have had the chance to ask questions. I understand that I may withdraw this consent at any time by telling the treating team.",
      Hindi: "मैं इस अस्पताल के डॉक्टरों और कर्मचारियों द्वारा जाँच, परीक्षण और उपचार के लिए अपनी सहमति देता/देती हूँ। मुझे मेरी स्थिति और प्रस्तावित उपचार के बारे में बताया गया है और मुझे प्रश्न पूछने का अवसर मिला है। मैं समझता/समझती हूँ कि मैं उपचार टीम को बताकर कभी भी यह सहमति वापस ले सकता/सकती हूँ।",
      Gujarati: "હું આ હોસ્પિટલના ડોક્ટરો અને સ્ટાફ દ્વારા તપાસ, પરીક્ષણો અને સારવાર માટે મારી સંમતિ આપું છું. મને મારી સ્થિતિ અને આયોજિત સારવાર વિશે જણાવવામાં આવ્યું છે અને મને પ્રશ્નો પૂછવાની તક મળી છે. હું સમજું છું કે સારવાર ટીમને જણાવીને હું કોઈપણ સમયે આ સંમતિ પાછી ખેંચી શકું છું.",
    },
  },
  {
    key: "admission-consent",
    title: { English: "Admission and treatment consent", Hindi: "भर्ती और उपचार सहमति", Gujarati: "દાખલ થવા અને સારવાર માટે સંમતિ" },
    body: {
      English: "I agree to be admitted to this hospital and to the hospital's rules, tariff and discharge process. I authorise the treating team to give the care they judge necessary, and to share my records with my insurer or TPA where I have asked for a cashless claim.",
      Hindi: "मैं इस अस्पताल में भर्ती होने तथा अस्पताल के नियमों, शुल्क और डिस्चार्ज प्रक्रिया से सहमत हूँ। मैं उपचार टीम को आवश्यक देखभाल देने के लिए अधिकृत करता/करती हूँ, और कैशलेस क्लेम की स्थिति में अपने रिकॉर्ड बीमा कंपनी या टीपीए के साथ साझा करने की अनुमति देता/देती हूँ।",
      Gujarati: "હું આ હોસ્પિટલમાં દાખલ થવા અને હોસ્પિટલના નિયમો, ફી અને ડિસ્ચાર્જ પ્રક્રિયા સાથે સહમત છું. હું સારવાર ટીમને જરૂરી સંભાળ આપવા માટે અધિકૃત કરું છું, અને કેશલેસ ક્લેમ માટે વિનંતી કરી હોય ત્યારે મારા રેકોર્ડ મારી વીમા કંપની કે ટીપીએ સાથે શેર કરવાની પરવાનગી આપું છું.",
    },
  },
  {
    key: "surgery-consent",
    title: { English: "Surgery and anaesthesia consent", Hindi: "शल्य चिकित्सा और एनेस्थीसिया सहमति", Gujarati: "શસ્ત્રક્રિયા અને એનેસ્થેસિયા માટે સંમતિ" },
    body: {
      English: "The planned procedure, its benefits, the usual risks and the alternatives have been explained to me. I consent to the procedure and to the anaesthesia the anaesthetist considers suitable, and to any additional step that becomes necessary to protect my life during it.",
      Hindi: "मुझे प्रस्तावित प्रक्रिया, उसके लाभ, सामान्य जोखिम और विकल्प समझाए गए हैं। मैं इस प्रक्रिया तथा एनेस्थेटिस्ट द्वारा उपयुक्त समझे गए एनेस्थीसिया के लिए, और प्रक्रिया के दौरान जीवन की रक्षा हेतु आवश्यक किसी भी अतिरिक्त कदम के लिए अपनी सहमति देता/देती हूँ।",
      Gujarati: "મને આયોજિત પ્રક્રિયા, તેના લાભો, સામાન્ય જોખમો અને વિકલ્પો સમજાવવામાં આવ્યા છે. હું આ પ્રક્રિયા માટે, એનેસ્થેટિસ્ટ યોગ્ય ગણે તેવા એનેસ્થેસિયા માટે, અને પ્રક્રિયા દરમિયાન મારા જીવનની સુરક્ષા માટે જરૂરી કોઈપણ વધારાના પગલા માટે મારી સંમતિ આપું છું.",
    },
  },
  {
    key: "transfusion-consent",
    title: { English: "Blood transfusion consent", Hindi: "रक्त आधान सहमति", Gujarati: "રક્ત ચડાવવા માટે સંમતિ" },
    body: {
      English: "The need for a blood transfusion and its risks, including reactions and, rarely, infection despite screening, have been explained to me. I consent to receive blood or blood components as advised by my doctor.",
      Hindi: "मुझे रक्त आधान की आवश्यकता और उसके जोखिम, जिनमें प्रतिक्रिया तथा जाँच के बावजूद कभी-कभी संक्रमण शामिल हैं, समझाए गए हैं। मैं अपने डॉक्टर की सलाह के अनुसार रक्त या रक्त घटक लेने के लिए सहमति देता/देती हूँ।",
      Gujarati: "મને રક્ત ચડાવવાની જરૂરિયાત અને તેના જોખમો, જેમાં પ્રતિક્રિયા અને તપાસ છતાં ક્યારેક ચેપનો સમાવેશ થાય છે, સમજાવવામાં આવ્યા છે. મારા ડોક્ટરની સલાહ મુજબ રક્ત અથવા રક્તના ઘટકો લેવા માટે હું સંમતિ આપું છું.",
    },
  },
  {
    key: "photography-consent",
    title: { English: "Consent for Clinical Photography", Hindi: "क्लिनिकल फ़ोटोग्राफ़ी हेतु सहमति", Gujarati: "ક્લિનિકલ ફોટોગ્રાફી માટે સંમતિ" },
    body: {
      English: "I consent to clinical photography/recording for the purposes of medical records, treatment, and education, with identity protected where possible.",
      Hindi: "मैं चिकित्सा रिकॉर्ड, उपचार और शिक्षा के उद्देश्य से क्लिनिकल फ़ोटो/रिकॉर्डिंग के लिए सहमति देता/देती हूँ; जहाँ तक संभव हो, पहचान गोपनीय रखी जाएगी।",
      Gujarati: "હું તબીબી રેકોર્ડ, સારવાર અને શિક્ષણના હેતુ માટે ક્લિનિકલ ફોટો/રેકોર્ડિંગ માટે સંમતિ આપું છું; શક્ય હોય ત્યાં સુધી ઓળખ ગુપ્ત રાખવામાં આવશે.",
    },
  },
  {
    key: "lama-consent",
    title: { English: "Discharge against medical advice", Hindi: "चिकित्सकीय सलाह के विरुद्ध डिस्चार्ज", Gujarati: "તબીબી સલાહ વિરુદ્ધ ડિસ્ચાર્જ" },
    body: {
      English: "I am asking to be discharged against the advice of my doctors. The risks of leaving the hospital before treatment is complete, including worsening of illness and death, have been explained to me. I take responsibility for this decision, and the hospital and its doctors are not responsible for the consequences.",
      Hindi: "मैं अपने डॉक्टरों की सलाह के विरुद्ध डिस्चार्ज माँग रहा/रही हूँ। उपचार पूरा होने से पहले अस्पताल छोड़ने के जोखिम, जिनमें बीमारी का बढ़ना और मृत्यु भी शामिल है, मुझे समझाए गए हैं। इस निर्णय की ज़िम्मेदारी मेरी है, और इसके परिणामों के लिए अस्पताल और उसके डॉक्टर उत्तरदायी नहीं हैं।",
      Gujarati: "હું મારા ડોક્ટરોની સલાહ વિરુદ્ધ ડિસ્ચાર્જ માંગું છું. સારવાર પૂરી થતાં પહેલાં હોસ્પિટલ છોડવાના જોખમો, જેમાં બીમારી વધવી અને મૃત્યુનો પણ સમાવેશ થાય છે, મને સમજાવવામાં આવ્યા છે. આ નિર્ણયની જવાબદારી મારી છે, અને તેના પરિણામો માટે હોસ્પિટલ અને તેના ડોક્ટરો જવાબદાર નથી.",
    },
  },
  {
    key: "refusal-consent",
    title: { English: "Refusal of treatment or procedure", Hindi: "उपचार या प्रक्रिया से इनकार", Gujarati: "સારવાર કે પ્રક્રિયાનો ઇનકાર" },
    body: {
      English: "I have been advised the treatment or procedure named by my doctor, and I have been told why it is advised and what may happen if it is not done. I choose to refuse it. I understand that I can change my mind and ask for it at any time.",
      Hindi: "मुझे मेरे डॉक्टर द्वारा बताए गए उपचार या प्रक्रिया की सलाह दी गई है, और मुझे बताया गया है कि यह क्यों ज़रूरी है और न कराने पर क्या हो सकता है। मैं इसे न कराने का निर्णय लेता/लेती हूँ। मैं समझता/समझती हूँ कि मैं कभी भी अपना निर्णय बदलकर इसे माँग सकता/सकती हूँ।",
      Gujarati: "મને મારા ડોક્ટરે જણાવેલી સારવાર કે પ્રક્રિયાની સલાહ આપવામાં આવી છે, અને તે શા માટે જરૂરી છે અને ન કરાવવાથી શું થઈ શકે તે મને જણાવવામાં આવ્યું છે. હું તે ન કરાવવાનો નિર્ણય લઉં છું. હું સમજું છું કે હું કોઈપણ સમયે મારો નિર્ણય બદલીને તે માંગી શકું છું.",
    },
  },
  {
    key: "records-sharing-consent",
    title: { English: "Consent to share my records", Hindi: "मेरे रिकॉर्ड साझा करने की सहमति", Gujarati: "મારા રેકોર્ડ શેર કરવાની સંમતિ" },
    body: {
      English: "I allow this hospital to share my medical records with the doctor, insurer, TPA or authority I have named to the hospital, only for my treatment, my claim or as the law requires. I can withdraw this permission in writing.",
      Hindi: "मैं इस अस्पताल को अनुमति देता/देती हूँ कि वह मेरे चिकित्सा रिकॉर्ड उस डॉक्टर, बीमा कंपनी, टीपीए या प्राधिकरण के साथ साझा करे जिसका नाम मैंने अस्पताल को बताया है, केवल मेरे उपचार, क्लेम या कानून की आवश्यकता के लिए। मैं यह अनुमति लिखित रूप में वापस ले सकता/सकती हूँ।",
      Gujarati: "હું આ હોસ્પિટલને મારા તબીબી રેકોર્ડ તે ડોક્ટર, વીમા કંપની, ટીપીએ કે સત્તામંડળ સાથે શેર કરવાની મંજૂરી આપું છું જેનું નામ મેં હોસ્પિટલને જણાવ્યું છે, ફક્ત મારી સારવાર, ક્લેમ અથવા કાયદાની જરૂરિયાત માટે. હું આ મંજૂરી લેખિતમાં પાછી ખેંચી શકું છું.",
    },
  },
];

export const consentForm = (key: string): ConsentFormDef | undefined => CONSENT_FORMS.find((f) => f.key === key);

// ── Who is signing ───────────────────────────────────────────────────────────

export const RELATIONS = ["Self", "Spouse", "Parent", "Child", "Sibling", "Guardian", "Other relative"] as const;
export type Relation = (typeof RELATIONS)[number];

// ── The sign page and the printed form, in each language ─────────────────────

export interface SignStrings {
  pleaseRead: string;
  forName: (name: string) => string;
  step1: string;
  openFull: string;
  closeFull: string;
  step2: string;
  yourName: string;
  yourRelation: string;
  relation: Record<Relation, string>;
  step3: string;
  signHere: string;
  clearSign: string;
  agree: string;
  submit: string;
  submitting: string;
  decline: string;
  declineWhy: string;
  declineBack: string;
  declineConfirm: string;
  validUntil: (when: string) => string;
  needSignature: string;
  signedTitle: string;
  signedLine: (name: string, when: string) => string;
  download: string;
  declinedTitle: string;
  declinedLine: string;
  expired: string;
  cancelled: string;
  alreadyDeclined: string;
  cantOpen: string;
  askNew: string;
  loading: string;
  /** Print / signed copy labels. */
  patient: string;
  ageSex: string;
  date: string;
  witness: string;
  relationLabel: string;
  signedOn: (when: string) => string;
  male: string;
  female: string;
  other: string;
}

export const SIGN_STRINGS: Record<ConsentLanguage, SignStrings> = {
  English: {
    pleaseRead: "Please read and sign",
    forName: (n) => `For ${n}`,
    step1: "1. Read the document",
    openFull: "Open the full document",
    closeFull: "Close",
    step2: "2. Who is signing?",
    yourName: "Your full name",
    yourRelation: "Your relation to the patient",
    relation: { Self: "I am the patient", Spouse: "Spouse", Parent: "Parent", Child: "Son / daughter", Sibling: "Brother / sister", Guardian: "Legal guardian", "Other relative": "Other relative" },
    step3: "3. Sign",
    signHere: "Sign here with your finger",
    clearSign: "Clear and sign again",
    agree: "I have read this document, my questions have been answered, and I agree to it.",
    submit: "Sign and send to the hospital",
    submitting: "Signing…",
    decline: "I do not want to sign",
    declineWhy: "Reason (optional)",
    declineBack: "Back",
    declineConfirm: "Decline to sign",
    validUntil: (w) => `This link is only for you and works until ${w}.`,
    needSignature: "Please sign in the box above.",
    signedTitle: "Signed — thank you",
    signedLine: (n, w) => `Signed by ${n} on ${w}. The hospital has your signed copy.`,
    download: "Download your signed copy",
    declinedTitle: "Your response is recorded",
    declinedLine: "You chose not to sign. The hospital will get in touch with you.",
    expired: "This link has expired. Please ask the hospital to send you a new one.",
    cancelled: "The hospital cancelled this link. Please ask them if you still need to sign.",
    alreadyDeclined: "A response declining this form has already been recorded.",
    cantOpen: "This link can't be opened",
    askNew: "Please ask the hospital to send you a new link.",
    loading: "Loading…",
    patient: "Patient", ageSex: "Age / Sex", date: "Date", witness: "Witness", relationLabel: "Relation:", signedOn: (w) => `Signed on ${w}`,
    male: "Male", female: "Female", other: "Other",
  },
  Hindi: {
    pleaseRead: "कृपया पढ़ें और हस्ताक्षर करें",
    forName: (n) => `${n} के लिए`,
    step1: "1. दस्तावेज़ पढ़ें",
    openFull: "पूरा दस्तावेज़ खोलें",
    closeFull: "बंद करें",
    step2: "2. कौन हस्ताक्षर कर रहा है?",
    yourName: "आपका पूरा नाम",
    yourRelation: "मरीज़ से आपका संबंध",
    relation: { Self: "मैं ही मरीज़ हूँ", Spouse: "पति/पत्नी", Parent: "माता/पिता", Child: "बेटा/बेटी", Sibling: "भाई/बहन", Guardian: "कानूनी अभिभावक", "Other relative": "अन्य रिश्तेदार" },
    step3: "3. हस्ताक्षर करें",
    signHere: "यहाँ उंगली से हस्ताक्षर करें",
    clearSign: "मिटाकर फिर से हस्ताक्षर करें",
    agree: "मैंने यह दस्तावेज़ पढ़ लिया है, मेरे प्रश्नों के उत्तर दिए गए हैं, और मैं इससे सहमत हूँ।",
    submit: "हस्ताक्षर करें और अस्पताल को भेजें",
    submitting: "हस्ताक्षर हो रहे हैं…",
    decline: "मैं इस पर हस्ताक्षर नहीं करना चाहता/चाहती",
    declineWhy: "कारण (वैकल्पिक)",
    declineBack: "वापस",
    declineConfirm: "हस्ताक्षर करने से मना करें",
    validUntil: (w) => `यह लिंक केवल आपके लिए है और ${w} तक काम करेगा।`,
    needSignature: "कृपया ऊपर के बॉक्स में हस्ताक्षर करें।",
    signedTitle: "हस्ताक्षर हो गए - धन्यवाद",
    signedLine: (n, w) => `${n} द्वारा ${w} को हस्ताक्षरित। अस्पताल के पास आपकी हस्ताक्षरित प्रति है।`,
    download: "अपनी हस्ताक्षरित प्रति डाउनलोड करें",
    declinedTitle: "आपका उत्तर दर्ज हो गया",
    declinedLine: "आपने हस्ताक्षर न करने का निर्णय लिया है। अस्पताल आपसे संपर्क करेगा।",
    expired: "यह लिंक समाप्त हो गया है। कृपया अस्पताल से नया लिंक माँगें।",
    cancelled: "अस्पताल ने यह लिंक रद्द कर दिया है। यदि आपको अभी भी हस्ताक्षर करने हैं तो उनसे पूछें।",
    alreadyDeclined: "इस फ़ॉर्म पर हस्ताक्षर न करने का उत्तर पहले ही दर्ज हो चुका है।",
    cantOpen: "यह लिंक नहीं खुल सकता",
    askNew: "कृपया अस्पताल से नया लिंक भेजने को कहें।",
    loading: "लोड हो रहा है…",
    patient: "मरीज़", ageSex: "आयु / लिंग", date: "दिनांक", witness: "गवाह", relationLabel: "संबंध:", signedOn: (w) => `${w} को हस्ताक्षरित`,
    male: "पुरुष", female: "महिला", other: "अन्य",
  },
  Gujarati: {
    pleaseRead: "કૃપા કરીને વાંચો અને સહી કરો",
    forName: (n) => `${n} માટે`,
    step1: "1. દસ્તાવેજ વાંચો",
    openFull: "સંપૂર્ણ દસ્તાવેજ ખોલો",
    closeFull: "બંધ કરો",
    step2: "2. કોણ સહી કરી રહ્યું છે?",
    yourName: "તમારું પૂરું નામ",
    yourRelation: "દર્દી સાથે તમારો સંબંધ",
    relation: { Self: "હું પોતે દર્દી છું", Spouse: "પતિ/પત્ની", Parent: "માતા/પિતા", Child: "દીકરો/દીકરી", Sibling: "ભાઈ/બહેન", Guardian: "કાનૂની વાલી", "Other relative": "અન્ય સગા" },
    step3: "3. સહી કરો",
    signHere: "અહીં આંગળીથી સહી કરો",
    clearSign: "ભૂંસીને ફરીથી સહી કરો",
    agree: "મેં આ દસ્તાવેજ વાંચ્યો છે, મારા પ્રશ્નોના જવાબ આપવામાં આવ્યા છે, અને હું તેની સાથે સહમત છું.",
    submit: "સહી કરો અને હોસ્પિટલને મોકલો",
    submitting: "સહી થઈ રહી છે…",
    decline: "હું આના પર સહી કરવા માંગતો/માંગતી નથી",
    declineWhy: "કારણ (વૈકલ્પિક)",
    declineBack: "પાછા",
    declineConfirm: "સહી કરવાની ના પાડો",
    validUntil: (w) => `આ લિંક ફક્ત તમારા માટે છે અને ${w} સુધી કામ કરશે.`,
    needSignature: "કૃપા કરીને ઉપરના બોક્સમાં સહી કરો.",
    signedTitle: "સહી થઈ ગઈ - આભાર",
    signedLine: (n, w) => `${n} દ્વારા ${w} ના રોજ સહી કરેલ. હોસ્પિટલ પાસે તમારી સહી કરેલી નકલ છે.`,
    download: "તમારી સહી કરેલી નકલ ડાઉનલોડ કરો",
    declinedTitle: "તમારો જવાબ નોંધાઈ ગયો",
    declinedLine: "તમે સહી ન કરવાનું પસંદ કર્યું છે. હોસ્પિટલ તમારો સંપર્ક કરશે.",
    expired: "આ લિંકની મુદત પૂરી થઈ ગઈ છે. કૃપા કરીને હોસ્પિટલ પાસે નવી લિંક માંગો.",
    cancelled: "હોસ્પિટલે આ લિંક રદ કરી છે. જો તમારે હજુ સહી કરવાની હોય તો તેમને પૂછો.",
    alreadyDeclined: "આ ફોર્મ પર સહી ન કરવાનો જવાબ અગાઉ જ નોંધાઈ ગયો છે.",
    cantOpen: "આ લિંક ખૂલી શકતી નથી",
    askNew: "કૃપા કરીને હોસ્પિટલને નવી લિંક મોકલવા કહો.",
    loading: "લોડ થઈ રહ્યું છે…",
    patient: "દર્દી", ageSex: "ઉંમર / જાતિ", date: "તારીખ", witness: "સાક્ષી", relationLabel: "સંબંધ:", signedOn: (w) => `${w} ના રોજ સહી કરેલ`,
    male: "પુરુષ", female: "સ્ત્રી", other: "અન્ય",
  },
};
