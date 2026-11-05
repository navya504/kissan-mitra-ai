import { Platform } from 'react-native';
import { LanguageCode } from './languages';
import type { FarmProfileData } from './farm-profile';
import type { ProfitInputs, ProfitPlan } from './profit';

export type ChatMessage = { from: 'farmer' | 'ai'; text: string; language: LanguageCode; spoken?: boolean; profitPlan?: ProfitPlan };
export type AssistantReply = { reply: string; profitRequested?: boolean; profitPlan?: ProfitPlan };

async function post<T>(path: string, body: BodyInit, json = true): Promise<T> {
  // Router API routes run on the Expo server, separately from the Node data API.
  const origin = process.env.EXPO_PUBLIC_APP_API_BASE_URL?.trim().replace(/\/+$/, '');
  let response: Response;
  try {
    // Expo resolves relative requests to the dev server, or Router's configured production origin.
    response = await fetch(Platform.OS !== 'web' && origin ? `${origin}${path}` : path, { method: 'POST', body, headers: json ? { 'Content-Type': 'application/json' } : undefined });
  } catch {
    throw new Error('No internet connection. Check your network and try again.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Something went wrong. Please try again.');
  return data as T;
}

// Speech to text; the server detects the language.
export async function transcribe(uri: string, language?: LanguageCode) {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const audio = await (await fetch(uri)).blob();
    const type = audio.type.split(';')[0];
    const extension = type === 'audio/mp4' ? 'm4a' : type === 'audio/ogg' ? 'ogg' : 'webm';
    form.append('audio', audio, `question.${extension}`);
  } else {
    // React Native uploads a local file from its uri.
    form.append('audio', { uri, name: 'question.m4a', type: 'audio/m4a' } as unknown as Blob);
  }
  if (language) form.append('language', language);
  return post<{ transcript: string; language: LanguageCode | null }>('/api/transcribe', form, false);
}

export async function askAssistant(messages: ChatMessage[], language: LanguageCode, farmerName: string, context?: { profile: FarmProfileData; profitInputs: ProfitInputs; requestProfit?: boolean }) {
  return post<AssistantReply>('/api/chat', JSON.stringify({ messages: messages.map(({ from, text }) => ({ from, text })), language, farmerName, ...context }));
}

// Returns a playable data URI of the spoken text.
export async function speak(text: string, language: LanguageCode) {
  const { audio } = await post<{ audio: string }>('/api/speak', JSON.stringify({ text, language }));
  return `data:audio/wav;base64,${audio}`;
}
