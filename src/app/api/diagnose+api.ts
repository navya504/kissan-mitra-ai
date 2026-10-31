import type { Diagnosis, PathogenType, Severity } from '../../diagnosis';

// Runs on the server only: the Nebius key never reaches the app bundle.
const BASE_URL = process.env.NEBIUS_BASE_URL || 'https://api.tokenfactory.nebius.com/v1';
const MODEL = process.env.NEBIUS_VISION_MODEL || 'moonshotai/Kimi-K3';
const MAX_IMAGE_CHARS = 8_000_000; // ~6 MB of JPEG once base64-encoded

const SYSTEM_PROMPT = `You are an experienced plant pathologist and agronomist advising smallholder farmers in India.
You will receive one photo of a crop plant (leaf, stem, fruit, panicle, root or whole plant) and optionally the farmer's location.
Identify the crop from the photo itself.

Diagnose what you see and reply with ONLY a JSON object, no markdown, using exactly these keys:
{
  "isPlant": boolean,              // false if the photo does not show a plant
  "photoQuality": "good" | "unclear", // "unclear" if blurry, too dark, too far, or the affected part is not visible
  "photoTip": string,              // if unclear: one short tip for retaking the photo, else ""
  "crop": string,                  // crop you see, e.g. "Paddy (Rice)"; "Unknown" if unsure
  "healthy": boolean,
  "disease": string,               // common name, e.g. "Bacterial Leaf Blight"; "Healthy" if healthy
  "scientificName": string,        // causal organism or "" if not applicable
  "pathogenType": "fungal" | "bacterial" | "viral" | "pest" | "nutrient" | "abiotic" | "none" | "unknown",
  "confidence": number,            // 0-100, your honest confidence in this diagnosis
  "severity": "none" | "mild" | "moderate" | "severe",
  "summary": string,               // 1-2 plain sentences a farmer can understand
  "symptoms": string[],            // visible signs in THIS photo that support the diagnosis
  "immediateActions": string[],    // what to do in the field in the next 1-3 days
  "organicTreatment": string[],    // low-cost, cultural or biological options
  "chemicalTreatment": string[],   // active ingredient + typical dose per litre of water as on the label; only products registered for this crop in India
  "prevention": string[],          // for the rest of this season and the next one
  "otherPossibilities": string[],  // other conditions that look similar, if any
  "consultExpert": boolean         // true if confidence is below 70, severity is severe, or lab confirmation is needed
}

Rules:
- Be honest about uncertainty. Never invent symptoms that are not visible.
- If the photo is not a plant or is too unclear to judge, set confidence low, leave treatment lists empty and explain in "summary".
- If the plant looks healthy, say so and give only prevention tips.
- Keep each list item to one short, practical sentence. At most 5 items per list.
- Chemical options are a last resort: prefer organic and cultural steps first, and remind the farmer to follow label dose, wear protective gear and respect the pre-harvest interval.`;

export async function POST(request: Request) {
  const apiKey = process.env.NEBIUS_API_KEY;
  if (!apiKey) return error(500, 'The diagnosis service is not configured yet.');

  let body: { image?: unknown; location?: unknown };
  try { body = await request.json(); } catch { return error(400, 'Send the photo as JSON.'); }

  const image = typeof body.image === 'string' ? body.image : '';
  if (!image) return error(400, 'No photo was sent.');
  if (image.length > MAX_IMAGE_CHARS) return error(413, 'The photo is too large. Please try a smaller one.');

  // No crop hint on purpose: naming the profile crop made the model compare every photo against it ("this is not paddy").
  const context = typeof body.location === 'string' && body.location ? `Location: ${body.location}.` : '';

  let upstream: Response;
  try {
    upstream = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 4000, // reasoning models spend part of this before answering
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Diagnose this crop photo. ${context}`.trim() },
              { type: 'image_url', image_url: { url: `data:${mimeType(image)};base64,${image}` } },
            ],
          },
        ],
      }),
    });
  } catch (e) {
    console.error('[diagnose] request to Nebius failed', e);
    return error(504, 'The diagnosis service did not respond. Please try again.');
  }

  if (!upstream.ok) {
    console.error('[diagnose] Nebius returned', upstream.status, await upstream.text().catch(() => ''));
    return error(502, 'The diagnosis service had a problem. Please try again.');
  }

  const data = await upstream.json().catch(() => null);
  const parsed = parseJson(data?.choices?.[0]?.message?.content);
  if (!parsed) {
    console.error('[diagnose] could not parse model output', data?.choices?.[0]?.finish_reason, data?.choices?.[0]?.message?.content);
    return error(502, 'Could not read the diagnosis. Please try again.');
  }

  return Response.json({ ...normalize(parsed), model: MODEL } satisfies Diagnosis);
}

function error(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

// Nebius rejects images whose bytes don't match the declared type, so read it from the file signature.
function mimeType(base64: string) {
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

// Models sometimes wrap JSON in ``` fences or add a sentence around it.
function parseJson(text: unknown): Record<string, unknown> | null {
  if (typeof text !== 'string') return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

const SEVERITIES: Severity[] = ['none', 'mild', 'moderate', 'severe'];
const PATHOGENS: PathogenType[] = ['fungal', 'bacterial', 'viral', 'pest', 'nutrient', 'abiotic', 'none', 'unknown'];

function normalize(raw: Record<string, unknown>): Omit<Diagnosis, 'model'> {
  const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v.trim() : fallback);
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map(x => x.trim()).slice(0, 5) : []);
  const oneOf = <T extends string>(v: unknown, options: T[], fallback: T) => (options.includes(v as T) ? (v as T) : fallback);
  const confidence = Math.round(Math.min(100, Math.max(0, Number(raw.confidence) || 0)));

  return {
    isPlant: raw.isPlant !== false,
    photoQuality: raw.photoQuality === 'unclear' ? 'unclear' : 'good',
    photoTip: str(raw.photoTip),
    crop: str(raw.crop, 'Unknown') || 'Unknown',
    healthy: raw.healthy === true,
    disease: str(raw.disease, 'Unknown') || 'Unknown',
    scientificName: str(raw.scientificName),
    pathogenType: oneOf(raw.pathogenType, PATHOGENS, 'unknown'),
    confidence,
    severity: oneOf(raw.severity, SEVERITIES, 'moderate'),
    summary: str(raw.summary),
    symptoms: list(raw.symptoms),
    immediateActions: list(raw.immediateActions),
    organicTreatment: list(raw.organicTreatment),
    chemicalTreatment: list(raw.chemicalTreatment),
    prevention: list(raw.prevention),
    otherPossibilities: list(raw.otherPossibilities),
    consultExpert: raw.consultExpert === true || confidence < 70 || raw.severity === 'severe',
  };
}
