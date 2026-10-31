// Open-Meteo geocoding result for Anakapalle, Andhra Pradesh.
const latitude = 17.69134;
const longitude = 83.00395;

export type ForecastDay = {
  date: string;
  high: number;
  low: number;
  rainChance: number;
  code: number;
};

export type FarmWeather = {
  temperature: number;
  feelsLike: number;
  humidity: number;
  wind: number;
  code: number;
  days: ForecastDay[];
  updatedAt: string;
};

export async function fetchFarmWeather(): Promise<FarmWeather> {
  const query = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum',
    timezone: 'Asia/Kolkata',
    forecast_days: '7',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`);
  if (!response.ok) throw new Error(`Weather provider returned ${response.status}`);
  const payload = await response.json();
  if (!payload.current || !payload.daily?.time?.length) throw new Error('Weather response was incomplete');

  return {
    temperature: Math.round(payload.current.temperature_2m),
    feelsLike: Math.round(payload.current.apparent_temperature),
    humidity: Math.round(payload.current.relative_humidity_2m),
    wind: Math.round(payload.current.wind_speed_10m),
    code: payload.current.weather_code,
    updatedAt: payload.current.time,
    days: payload.daily.time.map((date: string, index: number) => ({
      date,
      high: Math.round(payload.daily.temperature_2m_max[index]),
      low: Math.round(payload.daily.temperature_2m_min[index]),
      rainChance: Math.round(payload.daily.precipitation_probability_max[index] ?? 0),
      code: payload.daily.weather_code[index],
    })),
  };
}

export function describeWeather(code: number) {
  if (code === 0) return { label: 'Clear sky', icon: '☀️' };
  if ([1, 2].includes(code)) return { label: 'Partly cloudy', icon: '🌤️' };
  if (code === 3) return { label: 'Overcast', icon: '☁️' };
  if ([45, 48].includes(code)) return { label: 'Foggy', icon: '🌫️' };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: 'Drizzle', icon: '🌦️' };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: 'Rain', icon: '🌧️' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Snow', icon: '❄️' };
  if ([95, 96, 99].includes(code)) return { label: 'Thunderstorm', icon: '⛈️' };
  return { label: 'Weather update', icon: '🌤️' };
}
