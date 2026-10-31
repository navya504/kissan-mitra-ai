import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export type Severity = 'none' | 'mild' | 'moderate' | 'severe';
export type PathogenType = 'fungal' | 'bacterial' | 'viral' | 'pest' | 'nutrient' | 'abiotic' | 'none' | 'unknown';

export type Diagnosis = {
  isPlant: boolean;
  photoQuality: 'good' | 'unclear';
  photoTip: string;
  crop: string;
  healthy: boolean;
  disease: string;
  scientificName: string;
  pathogenType: PathogenType;
  confidence: number;
  severity: Severity;
  summary: string;
  symptoms: string[];
  immediateActions: string[];
  organicTreatment: string[];
  chemicalTreatment: string[];
  prevention: string[];
  otherPossibilities: string[];
  consultExpert: boolean;
  model: string;
};

const MAX_SIDE = 1024;

// Shrink the photo before upload: phone photos are often 3-5 MB, which is slow on rural mobile data.
export async function preparePhoto(photo: { uri: string; width?: number; height?: number }) {
  const context = ImageManipulator.manipulate(photo.uri);
  const { width = 0, height = 0 } = photo;
  if (!width || !height) context.resize({ width: MAX_SIDE, height: null });
  else if (Math.max(width, height) > MAX_SIDE) context.resize(width >= height ? { width: MAX_SIDE, height: null } : { width: null, height: MAX_SIDE });
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!result.base64) throw new Error('Could not read the photo.');
  return { uri: result.uri, base64: result.base64 };
}

export async function diagnoseCrop(base64: string, farm: { location?: string }): Promise<Diagnosis> {
  let response: Response;
  try {
    response = await fetch('/api/diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, ...farm }),
    });
  } catch {
    throw new Error('No internet connection. Check your network and try again.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Something went wrong. Please try again.');
  return data as Diagnosis;
}
