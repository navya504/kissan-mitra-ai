import { farmer } from '../../data';
import { getForecast } from '../../forecast';

// Live forecast for the farmer's location, shared by the Weather screen, the dashboard and the assistant.
export async function GET() {
  const forecast = await getForecast(Number(farmer.latitude), Number(farmer.longitude));
  if (!forecast) return Response.json({ error: 'Live weather is unavailable right now. Please try again later.' }, { status: 503 });
  return Response.json(forecast);
}
