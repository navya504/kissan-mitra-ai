import { farmer } from '../data';
import { apiBaseUrl } from './api';

export type GovernmentScheme = {
  id: string;
  name: string;
  category: string;
  summary: string;
  benefit: string;
  eligibility: string;
  documents: string[];
  applicationUrl: string;
  sourceUrl: string;
  reviewedAt: string;
  relevant: boolean;
};

export type SchemeCatalogue = {
  source: 'reviewed_official_sources';
  updatedAt: string;
  schemes: GovernmentScheme[];
};

export async function fetchGovernmentSchemes(): Promise<SchemeCatalogue> {
  const query = new URLSearchParams({ state: farmer.state, crop: 'paddy' });
  const response = await fetch(`${apiBaseUrl}/api/schemes?${query}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Scheme service returned ${response.status}`);
  return payload as SchemeCatalogue;
}
