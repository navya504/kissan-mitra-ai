import type { FarmProfileData } from './farm-profile';
import { numericSpeechText } from './speech-text';

export const registrationFields = ['name', 'state', 'district', 'village', 'crop', 'area'] as const;
export type RegistrationField = typeof registrationFields[number];
export type RegistrationStep = RegistrationField | 'map' | 'review';
export type RegistrationSession = { step: RegistrationStep };
const normalized = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[.,!?।]/g, '').replace(/\s+/g, ' ').trim();
const stateAliases: Record<string, string[]> = {
  'Andhra Pradesh': ['ఆంధ్ర ప్రదేశ్', 'ఆంధ్రప్రదేశ్', 'आंध्र प्रदेश', 'आंध्रप्रदेश', 'ஆந்திரப் பிரதேசம்', 'ಆಂಧ್ರ ಪ್ರದೇಶ'],
  Telangana: ['తెలంగాణ', 'तेलंगाना', 'तेलंगण', 'தெலங்கானா', 'ತೆಲಂಗಾಣ'],
  Karnataka: ['కర్ణాటక', 'कर्नाटक', 'கர்நாடகா', 'ಕರ್ನಾಟಕ'],
  'Tamil Nadu': ['తమిళనాడు', 'तमिलनाडु', 'तमिल नाडु', 'தமிழ்நாடு', 'ತಮಿಳುನಾಡು'],
  Maharashtra: ['మహారాష్ట్ర', 'महाराष्ट्र', 'மகாராஷ்டிரா', 'ಮಹಾರಾಷ್ಟ್ರ'],
  Kerala: ['కేరళ', 'केरल', 'केरळ', 'கேரளா', 'ಕೇರಳ'],
};
const correctionNames: Record<RegistrationField, string[]> = {
  name: ['name', 'full name', 'పేరు', 'नाम', 'பெயர்', 'ಹೆಸರು', 'नाव'],
  state: ['state', 'రాష్ట్రం', 'राज्य', 'மாநிலம்', 'ರಾಜ್ಯ'],
  district: ['district', 'జిల్లా', 'जिला', 'जिल्हा', 'மாவட்டம்', 'ಜಿಲ್ಲೆ'],
  village: ['village', 'గ్రామం', 'गांव', 'गाँव', 'गाव', 'கிராமம்', 'ಹಳ್ಳಿ'],
  crop: ['crop', 'main crop', 'పంట', 'फसल', 'पीक', 'பயிர்', 'ಬೆಳೆ'],
  area: ['area', 'farm area', 'land area', 'విస్తీర్ణం', 'क्षेत्रफल', 'क्षेत्र', 'பரப்பளவு', 'ವಿಸ್ತೀರ್ಣ'],
};

export function registrationPinValid(profile: FarmProfileData) {
  return Boolean(profile.latitude.trim() && profile.longitude.trim()) && Number.isFinite(Number(profile.latitude)) && Math.abs(Number(profile.latitude)) <= 90 && Number.isFinite(Number(profile.longitude)) && Math.abs(Number(profile.longitude)) <= 180;
}

export function registrationValue(field: RegistrationField, transcript: string, states: readonly string[]): { value?: string; error?: string } {
  let value = transcript.trim().replace(/[.!?।]+$/, '').trim();
  if (!value || value.length > 120) return { error: 'Please give one short answer, up to 120 characters.' };
  if (field === 'name') value = value.replace(/^(?:my name is|i am|నా పేరు|मेरा नाम|என் பெயர்|ನನ್ನ ಹೆಸರು|माझे नाव)(?:\s+|$)/i, '').trim();
  if (field === 'state') {
    const match = states.find(state => [state, ...(stateAliases[state] ?? [])].some(alias => normalized(alias) === normalized(value)));
    return match ? { value: match } : { error: 'That state was not recognized. Say its full name or choose it in the State picker below.' };
  }
  if (field === 'area') {
    value = numericSpeechText(value).toLowerCase()
      .replace(/ఎకరాలు|ఎకరం|एकड़|एकर|ஏக்கர்|ಎಕರೆ/g, 'acres')
      .replace(/హెక్టార్లు|హెక్టారు|हेक्टेयर|हेक्टर|ஹெக்டேர்|ಹೆಕ್ಟೇರ್/g, 'hectares');
    const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(acres?|hectares?|ha)?$/);
    if (!match || !Number.isFinite(Number(match[1])) || Number(match[1]) <= 0 || Number(match[1]) > 1_000_000) return { error: 'Enter a positive farm area with units, such as 2 acres or 0.8 hectares.' };
    return { value: `${Number(match[1])} ${match[2] && /^(hectare|ha)/.test(match[2]) ? 'hectares' : 'acres'}` };
  }
  if (!/\p{L}/u.test(value)) return { error: 'Please say a name or place, rather than only numbers.' };
  return { value };
}

export function nextRegistrationStep(profile: FarmProfileData, states: readonly string[]): RegistrationStep {
  return registrationFields.find(field => !registrationValue(field, profile[field], states).value) ?? (registrationPinValid(profile) ? 'review' : 'map');
}

export function effectiveRegistrationStep(session: RegistrationSession, profile: FarmProfileData, states: readonly string[]) {
  return session.step === 'review' || session.step === 'map' ? nextRegistrationStep(profile, states) : session.step;
}

export function registrationTransition(session: RegistrationSession, profile: FarmProfileData, transcript: string, states: readonly string[]): {
  session: RegistrationSession; profile: FarmProfileData; error?: string; command?: 'save' | 'pause' | 'repeat' | 'map';
} {
  const step = effectiveRegistrationStep(session, profile, states);
  const result = { session: { step }, profile };
  const text = normalized(transcript);
  if (['cancel', 'pause', 'stop registration', 'రద్దు', 'ఆపు', 'रद्द', 'रुको', 'रुकें', 'ரத்து', 'ನಿಲ್ಲಿಸಿ', 'थांबा'].includes(text)) return { ...result, command: 'pause' };
  if (['repeat', 'repeat question', 'మళ్ళీ', 'మళ్లీ చెప్పు', 'दोहराओ', 'மீண்டும்', 'ಮತ್ತೊಮ್ಮೆ', 'पुन्हा'].includes(text)) return { ...result, command: 'repeat' };
  const correction = text.replace(/^(?:change my|change|correct|edit)\s+/, '').replace(/\s+(?:మార్చు|बदलो|बदलें|மாற்று|ಬದಲಿಸಿ|बदला)$/, '');
  if (correction !== text) {
    const field = registrationFields.find(key => correctionNames[key].some(alias => normalized(alias) === correction));
    return field ? { ...result, session: { step: field } } : { ...result, error: 'Say change name, state, district, village, crop or area.' };
  }
  if (['go back', 'back', 'వెనక్కి', 'पीछे', 'முந்தைய', 'ಹಿಂದೆ', 'मागे'].includes(text)) {
    const index = registrationFields.indexOf(step as RegistrationField);
    return { ...result, session: { step: registrationFields[Math.max(0, (index < 0 ? registrationFields.length : index) - 1)] } };
  }
  if (['confirm', 'yes confirm', 'నిర్ధారించు', 'पुष्टि', 'पुष्टि करो', 'உறுதிப்படுத்து', 'ದೃಢೀಕರಿಸಿ', 'पुष्टी'].includes(text))
    return step === 'review' ? { ...result, command: 'save' } : { ...result, error: 'Finish the questions and choose the farm pin before confirming.' };
  if (step === 'map') return ['open map', 'choose map', 'choose farm pin', 'మ్యాప్ తెరువు', 'नक्शा खोलो'].includes(text) ? { ...result, command: 'map' } : { ...result, error: 'Choose your exact farm pin on the map. A village name is not an exact field location.' };
  if (step === 'review') return { ...result, error: 'Review your details, then say confirm or change a field, such as change my village.' };
  const answer = registrationValue(step, transcript, states);
  if (!answer.value) return { ...result, error: answer.error };
  let updated = { ...profile, [step]: answer.value };
  if (answer.value !== profile[step]) {
    if (step === 'state') updated = { ...updated, district: '', village: '', location: '', latitude: '', longitude: '' };
    if (step === 'district') updated = { ...updated, village: '', location: '', latitude: '', longitude: '' };
    if (step === 'village') updated = { ...updated, location: '', latitude: '', longitude: '' };
  }
  return { session: { step: nextRegistrationStep(updated, states) }, profile: updated };
}
