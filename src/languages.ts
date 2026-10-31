// Languages Sarvam supports for both speech-to-text and text-to-speech.
export const languages = {
  'hi-IN': { name: 'Hindi', native: 'हिन्दी' },
  'te-IN': { name: 'Telugu', native: 'తెలుగు' },
  'ta-IN': { name: 'Tamil', native: 'தமிழ்' },
  'kn-IN': { name: 'Kannada', native: 'ಕನ್ನಡ' },
  'ml-IN': { name: 'Malayalam', native: 'മലയാളം' },
  'mr-IN': { name: 'Marathi', native: 'मराठी' },
  'bn-IN': { name: 'Bengali', native: 'বাংলা' },
  'gu-IN': { name: 'Gujarati', native: 'ગુજરાતી' },
  'pa-IN': { name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  'od-IN': { name: 'Odia', native: 'ଓଡ଼ିଆ' },
  'en-IN': { name: 'English', native: 'English' },
} as const;

export type LanguageCode = keyof typeof languages;

export function isLanguageCode(code: unknown): code is LanguageCode {
  return typeof code === 'string' && code in languages;
}

// For typed messages there is no speech detection, so guess from the script.
// Devanagari is shared by Hindi and Marathi; Hindi is the safer default.
const scripts: [RegExp, LanguageCode][] = [
  [/[ऀ-ॿ]/, 'hi-IN'], [/[ఀ-౿]/, 'te-IN'], [/[஀-௿]/, 'ta-IN'],
  [/[ಀ-೿]/, 'kn-IN'], [/[ഀ-ൿ]/, 'ml-IN'], [/[ঀ-৿]/, 'bn-IN'],
  [/[઀-૿]/, 'gu-IN'], [/[਀-੿]/, 'pa-IN'], [/[଀-୿]/, 'od-IN'],
];

export function detectLanguage(text: string): LanguageCode {
  return scripts.find(([pattern]) => pattern.test(text))?.[1] ?? 'en-IN';
}
