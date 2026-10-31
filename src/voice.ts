import { Platform } from 'react-native';
import { LanguageCode } from './languages';

export type ChatMessage = { from: 'farmer' | 'ai'; text: string; language: LanguageCode; spoken?: boolean };

async function post<T>(path: string, body: BodyInit, json = true): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method: 'POST', body, headers: json ? { 'Content-Type': 'application/json' } : undefined });
  } catch {
    throw new Error('No internet connection. Check your network and try again.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Something went wrong. Please try again.');
  return data as T;
}

// Speech to text; the server detects the language.
export async function transcribe(uri: string) {
  const form = new FormData();
  if (Platform.OS === 'web') {
    form.append('audio', await (await fetch(uri)).blob(), 'question.webm');
  } else {
    // React Native uploads a local file from its uri.
    form.append('audio', { uri, name: 'question.m4a', type: 'audio/m4a' } as unknown as Blob);
  }
  return post<{ transcript: string; language: LanguageCode | null }>('/api/transcribe', form, false);
}

export async function askAssistant(messages: ChatMessage[], language: LanguageCode) {
  const { reply } = await post<{ reply: string }>('/api/chat', JSON.stringify({ messages: messages.map(({ from, text }) => ({ from, text })), language }));
  return reply;
}

// Returns a playable data URI of the spoken text.
export async function speak(text: string, language: LanguageCode) {
  const { audio } = await post<{ audio: string }>('/api/speak', JSON.stringify({ text, language }));
  return `data:audio/wav;base64,${audio}`;
}
