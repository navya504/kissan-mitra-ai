import { apiBaseUrl } from './api';

export type SatelliteObservation = { date: string; ndvi: number; validPixels: number };
export type SatelliteAnalysis = {
  source: 'Sentinel-2 L2A via Earth Search';
  analyzedAt: string;
  fieldAreaAcres: number;
  boundaryMethod: 'estimated_square_from_pin_and_area';
  latest: null | { date: string; ndvi: number; vigorScore: number; validPixels: number; changeFromPrevious: number | null };
  observations: SatelliteObservation[];
};

export async function fetchSatelliteAnalysis(input: { latitude: string; longitude: string; area: string }): Promise<SatelliteAnalysis> {
  const response = await fetch(`${apiBaseUrl}/api/satellite/analysis`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ latitude: Number(input.latitude), longitude: Number(input.longitude), area: input.area }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Satellite analysis returned ${response.status}`);
  return payload as SatelliteAnalysis;
}
