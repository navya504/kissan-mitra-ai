import { useCallback, useEffect, useState } from 'react';
import { fetchMandiPrices, type MarketResponse } from '../services/market';

export function useLiveMarketPrices(state?: string) {
  const [data, setData] = useState<MarketResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchMandiPrices(state));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Market data is not available right now.');
    } finally {
      setLoading(false);
    }
  }, [state]);
  useEffect(() => {
    let active = true;
    fetchMandiPrices(state).then(value => {
      if (active) { setData(value); setError(''); }
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'Market data is not available right now.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [state]);
  return { data, loading, error, refresh };
}
