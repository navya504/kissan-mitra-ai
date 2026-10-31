// Live weather from Open-Meteo (free, no key). Fetched on the server; the app reads it through /api/weather.
const CACHE_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; forecast: Forecast }>();

export type ForecastDay = { date: string; code: number; min: number; max: number; rain: number; rainChance: number; wind: number };
export type Forecast = {
  current: { time: string; temperature: number; humidity: number; code: number; wind: number };
  days: ForecastDay[];
};

// WMO weather codes: https://open-meteo.com/en/docs
const conditions: [number, string, string][] = [
  [0, 'Clear sky', '☀️'], [1, 'Mainly clear', '🌤️'], [2, 'Partly cloudy', '⛅'], [3, 'Overcast', '☁️'], [48, 'Fog', '🌫️'],
  [57, 'Drizzle', '🌦️'], [67, 'Rain', '🌧️'], [77, 'Snow', '🌨️'], [82, 'Rain showers', '🌦️'], [86, 'Snow showers', '🌨️'], [99, 'Thunderstorm', '⛈️'],
];
export const condition = (code: number) => conditions.find(([max]) => code <= max)?.[1] ?? 'Unknown';
export const conditionIcon = (code: number) => conditions.find(([max]) => code <= max)?.[2] ?? '🌡️';
export const isStorm = (code: number) => code >= 95;

export const dayLabel = (date: string, index: number) => index === 0 ? 'Today'
  : new Date(`${date}T12:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

export async function getForecast(latitude: number, longitude: number): Promise<Forecast | null> {
  const key = `${latitude},${longitude}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.forecast;

  const url = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude), timezone: 'Asia/Kolkata', forecast_days: '7',
    current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
  });
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { current: c, daily: d } = await response.json();
    const forecast: Forecast = {
      current: { time: c.time, temperature: c.temperature_2m, humidity: c.relative_humidity_2m, code: c.weather_code, wind: c.wind_speed_10m },
      days: d.time.map((date: string, i: number) => ({
        date, code: d.weather_code[i], min: d.temperature_2m_min[i], max: d.temperature_2m_max[i],
        rain: d.precipitation_sum[i], rainChance: d.precipitation_probability_max[i], wind: d.wind_speed_10m_max[i],
      })),
    };
    cache.set(key, { at: Date.now(), forecast });
    return forecast;
  } catch (e) {
    console.error('[forecast] Open-Meteo request failed', e);
    return cached?.forecast ?? null; // a stale forecast is better than none
  }
}

// Plain-text version for the assistant's prompt.
export function forecastText({ current: c, days }: Forecast) {
  return [
    `Now (${c.time.slice(11)}): ${c.temperature}°C, humidity ${c.humidity}%, ${condition(c.code).toLowerCase()}, wind ${c.wind} km/h`,
    ...days.map((d, i) => `${dayLabel(d.date, i)}: ${condition(d.code).toLowerCase()}, ${d.min}–${d.max}°C, rain ${d.rain} mm (${d.rainChance}% chance), wind up to ${d.wind} km/h`),
  ].join('\n');
}
