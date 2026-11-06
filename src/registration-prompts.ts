import type { AppLanguage } from './i18n';
import type { FarmProfileData } from './farm-profile';
import { registrationFields, type RegistrationStep } from './registration-guide';

const prompts: Record<AppLanguage, Record<RegistrationStep, string>> = {
  English: { name: 'What is your full name?', state: 'Which state is your farm in?', district: 'What is your district?', village: 'What is your village?', crop: 'What is your main crop?', area: 'What is your farm area? Say the number and acres or hectares.', map: 'Please choose your exact farm pin on the map. I will read your details back after you select it.', review: 'Please review your details. Say confirm to save, or change a field, for example, change my village.' },
  Telugu: { name: 'మీ పూర్తి పేరు ఏమిటి?', state: 'మీ పొలం ఏ రాష్ట్రంలో ఉంది?', district: 'మీ జిల్లా పేరు ఏమిటి?', village: 'మీ గ్రామం పేరు ఏమిటి?', crop: 'మీ ప్రధాన పంట ఏమిటి?', area: 'మీ పొలం విస్తీర్ణం ఎంత? సంఖ్యతో పాటు ఎకరాలు లేదా హెక్టార్లు చెప్పండి.', map: 'దయచేసి మ్యాప్‌లో మీ పొలం ఉన్న ఖచ్చితమైన ప్రదేశాన్ని ఎంచుకోండి. తర్వాత మీ వివరాలు చదివి వినిపిస్తాను.', review: 'మీ వివరాలు పరిశీలించండి. సేవ్ చేయడానికి నిర్ధారించు అని చెప్పండి. సరిచేయడానికి గ్రామం మార్చు లాగా చెప్పండి.' },
  Hindi: { name: 'आपका पूरा नाम क्या है?', state: 'आपका खेत किस राज्य में है?', district: 'आपका जिला कौन सा है?', village: 'आपके गांव का नाम क्या है?', crop: 'आपकी मुख्य फसल क्या है?', area: 'आपके खेत का क्षेत्रफल कितना है? संख्या और एकड़ या हेक्टेयर बताएं।', map: 'कृपया नक्शे पर अपने खेत की सही जगह चुनें। उसके बाद मैं आपके विवरण पढ़कर सुनाऊंगा।', review: 'अपने विवरण जांचें। सहेजने के लिए पुष्टि करो कहें। सुधार के लिए गांव बदलो जैसा निर्देश दें।' },
  Tamil: { name: 'உங்கள் முழுப் பெயர் என்ன?', state: 'உங்கள் பண்ணை எந்த மாநிலத்தில் உள்ளது?', district: 'உங்கள் மாவட்டம் என்ன?', village: 'உங்கள் கிராமத்தின் பெயர் என்ன?', crop: 'உங்கள் முக்கியப் பயிர் என்ன?', area: 'உங்கள் பண்ணையின் பரப்பளவு என்ன? எண்ணுடன் ஏக்கர் அல்லது ஹெக்டேர் சொல்லுங்கள்.', map: 'வரைபடத்தில் உங்கள் பண்ணையின் சரியான இடத்தைத் தேர்வு செய்யுங்கள். பிறகு உங்கள் விவரங்களைப் படித்துக் காட்டுகிறேன்.', review: 'உங்கள் விவரங்களைச் சரிபாருங்கள். சேமிக்க உறுதிப்படுத்து என்று சொல்லுங்கள். திருத்த கிராமம் மாற்று என்று சொல்லலாம்.' },
  Kannada: { name: 'ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರು ಏನು?', state: 'ನಿಮ್ಮ ಹೊಲ ಯಾವ ರಾಜ್ಯದಲ್ಲಿದೆ?', district: 'ನಿಮ್ಮ ಜಿಲ್ಲೆ ಯಾವುದು?', village: 'ನಿಮ್ಮ ಗ್ರಾಮದ ಹೆಸರು ಏನು?', crop: 'ನಿಮ್ಮ ಮುಖ್ಯ ಬೆಳೆ ಯಾವುದು?', area: 'ನಿಮ್ಮ ಹೊಲದ ವಿಸ್ತೀರ್ಣ ಎಷ್ಟು? ಸಂಖ್ಯೆಯೊಂದಿಗೆ ಎಕರೆ ಅಥವಾ ಹೆಕ್ಟೇರ್ ಹೇಳಿ.', map: 'ನಕ್ಷೆಯಲ್ಲಿ ನಿಮ್ಮ ಹೊಲದ ನಿಖರವಾದ ಸ್ಥಳವನ್ನು ಆಯ್ಕೆಮಾಡಿ. ನಂತರ ನಿಮ್ಮ ವಿವರಗಳನ್ನು ಓದಿ ಹೇಳುತ್ತೇನೆ.', review: 'ನಿಮ್ಮ ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ. ಉಳಿಸಲು ದೃಢೀಕರಿಸಿ ಎಂದು ಹೇಳಿ. ಸರಿಪಡಿಸಲು ಹಳ್ಳಿ ಬದಲಿಸಿ ಎಂದು ಹೇಳಬಹುದು.' },
  Marathi: { name: 'आपले पूर्ण नाव काय आहे?', state: 'आपले शेत कोणत्या राज्यात आहे?', district: 'आपला जिल्हा कोणता आहे?', village: 'आपल्या गावाचे नाव काय आहे?', crop: 'आपले मुख्य पीक कोणते आहे?', area: 'आपल्या शेताचे क्षेत्र किती आहे? संख्येसोबत एकर किंवा हेक्टर सांगा.', map: 'कृपया नकाशावर आपल्या शेताची अचूक जागा निवडा. त्यानंतर मी आपले तपशील वाचून दाखवतो.', review: 'आपले तपशील तपासा. जतन करण्यासाठी पुष्टी म्हणा. दुरुस्तीसाठी गाव बदला असे सांगा.' },
};
export const registrationLabels: Record<AppLanguage, string[]> = {
  English: ['Full name', 'State', 'District', 'Village', 'Main crop', 'Farm area'],
  Telugu: ['పూర్తి పేరు', 'రాష్ట్రం', 'జిల్లా', 'గ్రామం', 'ప్రధాన పంట', 'పొలం విస్తీర్ణం'],
  Hindi: ['पूरा नाम', 'राज्य', 'जिला', 'गांव', 'मुख्य फसल', 'खेत का क्षेत्रफल'],
  Tamil: ['முழுப் பெயர்', 'மாநிலம்', 'மாவட்டம்', 'கிராமம்', 'முக்கியப் பயிர்', 'பண்ணையின் பரப்பளவு'],
  Kannada: ['ಪೂರ್ಣ ಹೆಸರು', 'ರಾಜ್ಯ', 'ಜಿಲ್ಲೆ', 'ಗ್ರಾಮ', 'ಮುಖ್ಯ ಬೆಳೆ', 'ಹೊಲದ ವಿಸ್ತೀರ್ಣ'],
  Marathi: ['पूर्ण नाव', 'राज्य', 'जिल्हा', 'गाव', 'मुख्य पीक', 'शेताचे क्षेत्र'],
};
export function registrationPrompt(step: RegistrationStep, language: AppLanguage, profile: FarmProfileData) {
  const summary = step === 'review' ? registrationFields.map((field, index) => `${registrationLabels[language][index]}: ${profile[field]}.`).join(' ') + ` ${profile.latitude}, ${profile.longitude}. ` : '';
  return summary + prompts[language][step];
}
