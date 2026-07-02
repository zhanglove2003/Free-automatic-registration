import type { SmsSettings } from './types.js';
import type { SmsCountry, SmsCountryFetch } from './smsCountries.js';
import { fetchHeroSmsCountries } from './smsCountries.js';

export interface SmsCountryPrice extends SmsCountry {
  price: number;
  available: number;
}

interface SmsServicePrice {
  cost?: number | string;
  count?: number | string;
}

export type HeroSmsPrices = Record<string, Record<string, SmsServicePrice>>;

export async function fetchHeroSmsPrices(settings: SmsSettings, fetcher: SmsCountryFetch = fetch): Promise<HeroSmsPrices> {
  const body = await requestHeroSmsText(settings, {
    action: 'getPrices',
    api_key: settings.apiKey,
    service: settings.serviceCode,
  }, fetcher);
  return parseHeroSmsPrices(body);
}

export async function fetchCheapestHeroSmsCountries(
  settings: SmsSettings,
  fetcher: SmsCountryFetch = fetch,
): Promise<SmsCountryPrice[]> {
  const [countries, prices] = await Promise.all([
    fetchHeroSmsCountries(fetcher),
    fetchHeroSmsPrices(settings, fetcher),
  ]);
  return selectCheapestSmsCountries(countries, prices, settings.serviceCode, 3);
}

export async function fetchHeroSmsBalance(settings: SmsSettings, fetcher: SmsCountryFetch = fetch): Promise<number> {
  const body = await requestHeroSmsText(settings, {
    action: 'getBalance',
    api_key: settings.apiKey,
  }, fetcher);
  return parseHeroSmsBalance(body);
}

export function parseHeroSmsPrices(body: string): HeroSmsPrices {
  const parsed = JSON.parse(body) as unknown;
  return parsed && typeof parsed === 'object' ? parsed as HeroSmsPrices : {};
}

export function selectCheapestSmsCountries(
  countries: SmsCountry[],
  prices: HeroSmsPrices,
  serviceCode: string,
  limit = 3,
): SmsCountryPrice[] {
  return countries
    .map((country) => {
      const service = prices[country.id]?.[serviceCode];
      const price = Number(service?.cost);
      const available = Number(service?.count);
      if (!Number.isFinite(price) || !Number.isFinite(available) || available <= 0) return undefined;
      return { ...country, price, available } satisfies SmsCountryPrice;
    })
    .filter((country): country is SmsCountryPrice => Boolean(country))
    .sort((left, right) => left.price - right.price || left.id.localeCompare(right.id, undefined, { numeric: true }))
    .slice(0, limit);
}

export function parseHeroSmsBalance(body: string): number {
  const match = /^ACCESS_BALANCE:?\s*([0-9]+(?:\.[0-9]+)?)$/i.exec(body.trim());
  if (!match) {
    throw new Error(`HeroSMS getBalance failed: ${body}`);
  }
  return Number(match[1]);
}

async function requestHeroSmsText(
  settings: SmsSettings,
  params: Record<string, string | undefined>,
  fetcher: SmsCountryFetch,
): Promise<string> {
  const url = new URL(settings.baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value.length > 0) {
      url.searchParams.set(key, value);
    }
  }
  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`HeroSMS request failed with HTTP ${response.status}`);
  }
  return (await response.text()).trim();
}
