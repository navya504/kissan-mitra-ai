import { isLanguageCode } from '../../languages';

// Text-to-speech with Sarvam. Returns base64 WAV the app can play directly.
const MAX_CHARS = 2500; // bulbul:v3 limit per request

export async function POST(request: Request) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) return error(500, 'Voice replies are not configured yet.');

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, MAX_CHARS) : '';
  if (!text) return error(400, 'Nothing to read out.');
  const language = isLanguageCode(body.language) ? body.language : 'en-IN';

  let upstream: Response;
  try {
    upstream = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-subscription-key': apiKey },
      body: JSON.stringify({
        text,
        language_code: language,
        model: 'bulbul:v3',
        speaker: process.env.SARVAM_SPEAKER || 'shubh',
        pace: 0.95, // slightly slower is easier to follow
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    console.error('[speak] request to Sarvam failed', e);
    return error(504, 'The voice service did not respond. Please try again.');
  }

  if (!upstream.ok) {
    console.error('[speak] Sarvam returned', upstream.status, await upstream.text().catch(() => ''));
    return error(502, 'Could not read the answer aloud. Please try again.');
  }

  const data = await upstream.json().catch(() => null);
  const audio = typeof data?.audios?.[0] === 'string' ? data.audios[0] : '';
  if (!audio) return error(502, 'Could not read the answer aloud. Please try again.');

  return Response.json({ audio });
}

function error(status: number, message: string) {
  return Response.json({ error: message }, { status });
}
