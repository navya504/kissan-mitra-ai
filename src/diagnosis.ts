import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

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
  if (Platform.OS === 'web') return preparePhotoOnWeb(photo.uri);

  const width = Number(photo.width);
  const height = Number(photo.height);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error('Could not read this photo’s dimensions. Please choose another image.');
  }
  const context = ImageManipulator.manipulate(photo.uri);
  if (Math.max(width, height) > MAX_SIDE) {
    const scale = MAX_SIDE / Math.max(width, height);
    context.resize({ width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!result.base64) throw new Error('Could not read the photo.');
  return { uri: result.uri, base64: result.base64 };
}

async function preparePhotoOnWeb(uri: string) {
  const source = new window.Image();
  await new Promise<void>((resolve, reject) => {
    source.onload = () => resolve();
    source.onerror = () => reject(new Error('Could not open this image. Please try another photo.'));
    source.src = uri;
    if (source.complete && source.naturalWidth > 0 && source.naturalHeight > 0) resolve();
  });

  const width = source.naturalWidth;
  const height = source.naturalHeight;
  if (!width || !height) throw new Error('Could not read this photo’s dimensions. Please choose another image.');
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare this image. Try another browser or photo.');
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error('Could not prepare this image. Please try another photo.')), 'image/jpeg', 0.7);
  });
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read the prepared image.'));
    reader.onerror = () => reject(new Error('Could not read the prepared image.'));
    reader.readAsDataURL(blob);
  });
  const base64 = dataUrl.split(',')[1];
  if (!base64) throw new Error('Could not read the prepared image.');
  canvas.width = 0;
  canvas.height = 0;
  return { uri: dataUrl, base64 };
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
