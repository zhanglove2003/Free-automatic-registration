export interface SmsCountry {
  id: string;
  en: string;
  zh: string;
  aliases: string[];
}

export type SmsCountryFetch = (input: string | URL) => Promise<Response>;

interface HeroSmsCountry {
  id?: number | string;
  eng?: string;
  chn?: string;
  rus?: string;
  visible?: number;
}

export const HERO_SMS_COUNTRIES_URL = 'https://hero-sms.com/stubs/handler_api.php?action=getCountries';

export function parseHeroSmsCountries(body: string): SmsCountry[] {
  const parsed = JSON.parse(body) as Record<string, HeroSmsCountry>;
  return Object.entries(parsed)
    .map(([key, value]) => {
      const id = String(value.id ?? key).trim();
      const en = String(value.eng ?? '').trim();
      const zh = String(value.chn ?? '').trim();
      const rus = String(value.rus ?? '').trim();
      if (!id || (!en && !zh)) return undefined;
      return {
        id,
        en,
        zh,
        aliases: rus ? [rus] : [],
      } satisfies SmsCountry;
    })
    .filter((country): country is SmsCountry => Boolean(country))
    .sort((left, right) => Number(left.id) - Number(right.id));
}

export async function fetchHeroSmsCountries(fetcher: SmsCountryFetch = fetch): Promise<SmsCountry[]> {
  const response = await fetcher(HERO_SMS_COUNTRIES_URL);
  if (!response.ok) {
    throw new Error(`HeroSMS getCountries failed with HTTP ${response.status}`);
  }
  return parseHeroSmsCountries(await response.text());
}

export function filterSmsCountries(countries: SmsCountry[], query: string, limit = 30): SmsCountry[] {
  const normalizedQuery = normalizeCountrySearch(query);
  if (!normalizedQuery) return countries.slice(0, limit);

  const exact: SmsCountry[] = [];
  const prefix: SmsCountry[] = [];
  const partial: SmsCountry[] = [];

  for (const country of countries) {
    const tokens = searchableCountryTokens(country);
    if (tokens.some((token) => token === normalizedQuery)) {
      exact.push(country);
    } else if (tokens.some((token) => token.startsWith(normalizedQuery))) {
      prefix.push(country);
    } else if (tokens.some((token) => token.includes(normalizedQuery))) {
      partial.push(country);
    }
  }

  return [...exact, ...prefix, ...partial].slice(0, limit);
}

export function resolveSmsCountryId(countries: SmsCountry[], input: string): string | undefined {
  const normalizedInput = normalizeCountrySearch(input);
  if (!normalizedInput) return undefined;
  if (/^\d+$/.test(normalizedInput)) return normalizedInput;
  return countries.find((country) => searchableCountryTokens(country).some((token) => token === normalizedInput))?.id;
}

export function normalizeCountrySearch(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_#()/-]+/g, '');
}

function searchableCountryTokens(country: SmsCountry): string[] {
  return [country.id, country.en, country.zh, ...country.aliases].map(normalizeCountrySearch).filter(Boolean);
}
