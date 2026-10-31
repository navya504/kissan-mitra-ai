import { useCallback, useEffect, useState } from 'react';
import { fetchGovernmentSchemes, type SchemeCatalogue } from '../services/schemes';

export function useGovernmentSchemes() {
  const [data, setData] = useState<SchemeCatalogue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchGovernmentSchemes());
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Scheme information is not available right now.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    fetchGovernmentSchemes().then(value => {
      if (active) { setData(value); setError(''); }
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'Scheme information is not available right now.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);
  return { data, loading, error, refresh };
}
