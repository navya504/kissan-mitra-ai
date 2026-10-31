import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { farmer } from './data';

export type FarmProfileData = typeof farmer;

type FarmProfileContextValue = {
  profile: FarmProfileData;
  setProfile: (profile: FarmProfileData) => void;
};

const FarmProfileContext = createContext<FarmProfileContextValue | null>(null);
const storageKey = 'kisaan-mitra-farm-profile';

export function FarmProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<FarmProfileData>(farmer);
  const [storageReady, setStorageReady] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (isFarmProfile(parsed) && !cancelled) setProfile({
            ...parsed,
            location: typeof parsed.location === 'string' ? parsed.location : '',
            latitude: typeof parsed.latitude === 'string' ? parsed.latitude : '',
            longitude: typeof parsed.longitude === 'string' ? parsed.longitude : '',
          });
        }
      } catch {
        // Continue with the in-app profile if browser storage is unavailable.
      } finally {
        if (!cancelled) setStorageReady(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || !storageReady) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(profile));
    } catch {
      // The profile remains available for this app session if storage is unavailable.
    }
  }, [profile, storageReady]);

  return <FarmProfileContext.Provider value={{ profile, setProfile }}>{children}</FarmProfileContext.Provider>;
}

export function useFarmProfile() {
  const value = useContext(FarmProfileContext);
  if (!value) throw new Error('useFarmProfile must be used inside FarmProfileProvider');
  return value;
}

function isFarmProfile(value: unknown): value is FarmProfileData {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Record<string, unknown>;
  return ['name', 'village', 'district', 'state', 'crop', 'area'].every(key => typeof profile[key] === 'string')
    && (profile.location === undefined || typeof profile.location === 'string')
    && (profile.latitude === undefined || typeof profile.latitude === 'string')
    && (profile.longitude === undefined || typeof profile.longitude === 'string');
}
