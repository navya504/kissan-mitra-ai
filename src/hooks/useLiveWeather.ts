import { useCallback, useEffect, useState } from 'react';
import { fetchFarmWeather, type FarmWeather } from '../services/weather';

export function useLiveWeather() {
  const [data, setData] = useState<FarmWeather | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchFarmWeather());
      setError('');
    } catch {
      setError('Could not reach the live forecast. Showing sample weather.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    fetchFarmWeather().then(value => {
      if (active) { setData(value); setError(''); }
    }).catch(() => {
      if (active) setError('Could not reach the live forecast. Showing sample weather.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);
  return { data, loading, error, refresh };
}
