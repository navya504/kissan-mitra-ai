import { farmer } from '../../data';
import { forecastText, getForecast } from '../../forecast';
import { isLanguageCode, languages } from '../../languages';

// Farming assistant replies from a Nebius text model. Runs on the server so the key stays private.
const BASE_URL = process.env.NEBIUS_BASE_URL || 'https://api.tokenfactory.nebius.com/v1';
const MODEL = process.env.NEBIUS_CHAT_MODEL || 'moonshotai/Kimi-K3';
const MAX_HISTORY = 10;

const SYSTEM_PROMPT = `You are Kisaan Mitra, a friendly and practical farming assistant for smallholder farmers in India.

Farmer profile: ${farmer.name}, ${farmer.area} of ${farmer.crop} in ${farmer.village}, ${farmer.district}, ${farmer.state}. Use it only when relevant.

How to answer:
- Reply in the language named in the instruction at the end of the farmer's message, written in that language's own script. Never switch to English unless asked.
- Your reply will be read aloud, so write plain spoken sentences only: no markdown, bullet symbols, tables, emojis or headings.
- Keep it short, because the farmer listens to it: at most 4 short sentences, about 60 words, with the most useful, concrete step first. Leave out anything that is not needed right now.
- Speak respectfully, as to an elder: use the polite form of "you" (for example आप in Hindi, మీరు in Telugu, நீங்கள் in Tamil).
- Use simple everyday words a farmer uses. Write numbers and units the way people say them.
- Prefer low-cost, local, cultural and organic options first.
- If a pesticide or fungicide is needed, name only the active ingredient and tell them to use the dose printed on the label. Never state a pesticide dose from memory. Remind them to wear gloves and a mask.
- If you are not sure, or it needs a field visit, say so and suggest the local Krishi Vigyan Kendra or agriculture officer.
- Use the live weather forecast below to answer weather questions and to time your advice: for example, do not suggest spraying or applying urea just before heavy rain. Say the rain chance and amount in simple words.
- You do not have live market prices. If asked, give general guidance and suggest checking the Market screen in the app.`;

type Message = { from: 'farmer' | 'ai'; text: string };

export async function POST(request: Request) {
  const apiKey = process.env.NEBIUS_API_KEY;
  if (!apiKey) return error(500, 'The assistant is not configured yet.');

  const body = await request.json().catch(() => null);
  const history: Message[] = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m: any) => (m?.from === 'farmer' || m?.from === 'ai') && typeof m.text === 'string' && m.text.trim())
    .slice(-MAX_HISTORY);
  const last = history.at(-1);
  if (!last || last.from !== 'farmer') return error(400, 'Ask a question first.');
  const code: unknown = body.language;
  const language = isLanguageCode(code) ? languages[code].name : 'English';

  const forecast = await getForecast(Number(farmer.latitude), Number(farmer.longitude));
  const weather = forecast
    ? `Live weather forecast for ${farmer.village} (Open-Meteo):\n${forecastText(forecast)}`
    : 'Live weather is unavailable right now. If asked about weather, say so and suggest checking the Weather screen.';

  const messages = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n${weather}` },
    ...history.map((m, i) => ({
      role: m.from === 'farmer' ? 'user' : 'assistant',
      content: i === history.length - 1 ? `${m.text}\n\n(Reply in ${language}.)` : m.text,
    })),
  ];

  let upstream: Response;
  try {
    upstream = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.4, max_tokens: 4000 }), // Kimi thinks before answering
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    console.error('[chat] request to Nebius failed', e);
    return error(504, 'The assistant did not respond. Please try again.');
  }

  if (!upstream.ok) {
    console.error('[chat] Nebius returned', upstream.status, await upstream.text().catch(() => ''));
    return error(502, 'The assistant had a problem. Please try again.');
  }

  const data = await upstream.json().catch(() => null);
  const reply = cleanForSpeech(data?.choices?.[0]?.message?.content);
  if (!reply) return error(502, 'The assistant had a problem. Please try again.');
  return Response.json({ reply });
}

// Belt and braces: strip markdown the model may still add, since replies are read aloud.
function cleanForSpeech(text: unknown) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/[*_#`>]+/g, '')
    .replace(/[Ѐ-ӿ]/g, '') // the model occasionally slips a Cyrillic letter into Indic words
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function error(status: number, message: string) {
  return Response.json({ error: message }, { status });
}
