import { isLanguageCode } from '../../languages';

// Speech-to-text with Sarvam. Runs on the server so the key never reaches the app bundle.
const MAX_AUDIO_BYTES = 5_000_000;

export async function POST(request: Request) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) return error(500, 'Voice input is not configured yet.');

  let audio: File | null = null;
  try {
    // React Native's global FormData type has no get(); the server runtime's does.
    const form = (await request.formData()) as unknown as { get(name: string): unknown };
    const value = form.get('audio');
    audio = value instanceof File ? value : null;
  } catch {}
  if (!audio || audio.size === 0) return error(400, 'No recording was sent.');
  if (audio.size > MAX_AUDIO_BYTES) return error(413, 'The recording is too long. Please keep it under 30 seconds.');

  // Browsers label recordings like "audio/webm;codecs=opus"; Sarvam only accepts the bare "audio/webm".
  const type = audio.type.split(';')[0].trim() || 'application/octet-stream';
  const form = new FormData();
  form.append('file', new File([audio], audio.name || 'question.m4a', { type }));
  // saaras:v3 in transcribe mode keeps the speaker's own script. saaras:v4 sometimes returned
  // Hindi as romanised text labelled English, which made the assistant reply in English.
  form.append('model', 'saaras:v3');
  form.append('mode', 'transcribe');
  form.append('language_code', 'unknown'); // let Sarvam detect the language

  let upstream: Response;
  try {
    upstream = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: { 'api-subscription-key': apiKey },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    console.error('[transcribe] request to Sarvam failed', e);
    return error(504, 'The voice service did not respond. Please try again.');
  }

  if (!upstream.ok) {
    console.error('[transcribe] Sarvam returned', upstream.status, await upstream.text().catch(() => ''));
    return error(502, 'Could not understand the recording. Please try again.');
  }

  const data = await upstream.json().catch(() => null);
  const transcript = typeof data?.transcript === 'string' ? data.transcript.trim() : '';
  if (!transcript) return error(422, 'We could not hear any words. Please speak closer to the phone and try again.');

  return Response.json({ transcript, language: isLanguageCode(data.language_code) ? data.language_code : null });
}

function error(status: number, message: string) {
  return Response.json({ error: message }, { status });
}
