import { useCallback, useEffect, useState } from 'react';
import { fetchSatelliteAnalysis, type SatelliteAnalysis } from '../services/satellite';

export function useSatelliteAnalysis(input: { latitude: string; longitude: string; area: string }) {
  const [data, setData] = useState<SatelliteAnalysis | null>(null);
  const [loading, setLoading] = useState(Boolean(input.latitude && input.longitude));
  const [error, setError] = useState('');
  const { latitude, longitude, area } = input;
  const refresh = useCallback(async () => {
    if (!latitude || !longitude) {
      setError('Choose a precise farm pin in your profile before analyzing satellite data.');
      return;
    }
    setLoading(true);
    setError('');
    try { setData(await fetchSatelliteAnalysis({ latitude, longitude, area })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not analyze this field right now.'); }
    finally { setLoading(false); }
  }, [area, latitude, longitude]);

  useEffect(() => {
    if (!latitude || !longitude) return;
    let active = true;
    fetchSatelliteAnalysis({ latitude, longitude, area }).then(result => {
      if (active) { setData(result); setError(''); }
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not analyze this field right now.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [area, latitude, longitude]);

  return { data, loading, error, refresh };
}
