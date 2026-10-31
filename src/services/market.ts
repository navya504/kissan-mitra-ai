import { farmer } from '../data';
import { apiBaseUrl } from './api';

export type MandiPrice = {
  market: string;
  district: string;
  commodity: string;
  variety: string;
  arrivalDate: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
};

export type MarketResponse = { source: 'data.gov.in'; updatedAt: string; prices: MandiPrice[] };

export async function fetchMandiPrices(state = farmer.state): Promise<MarketResponse> {
  const response = await fetch(`${apiBaseUrl}/api/market/prices?state=${encodeURIComponent(state)}&commodity=paddy`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Market service returned ${response.status}`);
  return payload as MarketResponse;
}
