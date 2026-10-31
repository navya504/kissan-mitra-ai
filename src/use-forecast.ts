import { useEffect, useState } from 'react';
import { dayLabel, Forecast, isStorm } from './forecast';

type ForecastState = { forecast: Forecast | null; error: string | null };

// Loads the live forecast from /api/weather (the server caches it for 30 minutes).
export function useForecast(): ForecastState & { loading: boolean } {
  const [state, setState] = useState<ForecastState | null>(null);
  useEffect(() => {
    let active = true;
    fetch('/api/weather')
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data?.error); return data as Forecast; })
      .then(forecast => active && setState({ forecast, error: null }))
      .catch(e => active && setState({ forecast: null, error: e instanceof Error && e.message ? e.message : 'Live weather is unavailable right now.' }));
    return () => { active = false; };
  }, []);
  return { forecast: state?.forecast ?? null, error: state?.error ?? null, loading: state === null };
}

export type WeatherAlert = { tone: 'red' | 'gold' | 'green'; icon: string; title: string; body: string };

const HEAVY_RAIN_MM = 20;
const LIKELY_RAIN_CHANCE = 60;
const HEAT_C = 35;

// Farming alerts worked out from the forecast, so the advice changes with the weather.
export function weatherAlerts({ days }: Forecast): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];
  const when = (i: number) => (i === 0 ? 'today' : `on ${dayLabel(days[i].date, i)}`);
  const next5 = days.slice(0, 5);
  const wettest = next5.reduce((best, d, i) => (d.rain > next5[best].rain ? i : best), 0);
  const storm = days.slice(0, 3).findIndex(d => isStorm(d.code));
  const tomorrow = days[1];

  if (next5[wettest]?.rain >= HEAVY_RAIN_MM) {
    alerts.push({ tone: 'red', icon: 'weather-pouring', title: `Heavy rain ${when(wettest)} · ${Math.round(next5[wettest].rain)} mm`, body: 'Do not spray or apply urea before it; it will wash off. Clear field drains and keep harvested grain covered.' });
  }
  if (storm !== -1) {
    alerts.push({ tone: 'red', icon: 'weather-lightning-rainy', title: `Thunderstorm ${when(storm)}`, body: 'Stay out of open fields and away from tall trees during lightning. Secure loose sheets and stored produce.' });
  } else if (!alerts.length && tomorrow && tomorrow.rainChance >= LIKELY_RAIN_CHANCE) {
    alerts.push({ tone: 'gold', icon: 'weather-rainy', title: `Rain likely tomorrow · ${tomorrow.rainChance}% chance`, body: 'Avoid pesticide spraying today and tomorrow. Spray after the rain, once leaves are dry.' });
  }

  const hottest = days.reduce((a, b) => (b.max > a.max ? b : a), days[0]);
  if (hottest && hottest.max >= HEAT_C) {
    alerts.push({ tone: 'gold', icon: 'weather-sunny-alert', title: `High temperature · up to ${Math.round(hottest.max)}°C`, body: 'Irrigate early in the morning or in the evening to reduce water loss.' });
  }

  const dryDays = days.findIndex(d => d.rainChance >= LIKELY_RAIN_CHANCE || d.rain >= 2);
  if (dryDays === -1 || dryDays >= 2) {
    alerts.push({ tone: 'green', icon: 'lightbulb-on-outline', title: `Dry for the next ${dryDays === -1 ? days.length : dryDays} days`, body: 'A good window for spraying or applying fertilizer. Spray in the morning or evening when wind is low.' });
  }

  if (!alerts.length) alerts.push({ tone: 'green', icon: 'check-circle-outline', title: 'No weather warnings', body: 'Normal field work can continue. Check again before spraying.' });
  return alerts;
}
