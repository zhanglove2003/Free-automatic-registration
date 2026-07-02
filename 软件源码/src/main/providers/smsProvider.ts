import type { SmsSettings } from '../../shared/types.js';
import { fetchHeroSmsCountries, resolveSmsCountryId, type SmsCountry } from '../../shared/smsCountries.js';
import { parseHeroSmsPrices } from '../../shared/smsHeroApi.js';
import { formatSmsPriceParam } from '../../shared/smsPrice.js';
import { ConfigurationError } from '../domain/errors.js';

export interface SmsActivation {
  orderId: string;
  phone: string;
  country: string;
}

export type AcquireNumberOptions = SmsSettings;

export interface SmsProvider {
  acquireNumber(opts: AcquireNumberOptions): Promise<SmsActivation>;
  pollCode(orderId: string, timeoutMs: number): Promise<string>;
  release(orderId: string): Promise<void>;
  markInvalid(orderId: string): Promise<void>;
}

type SmsFetch = (url: string | URL) => Promise<Response>;

export class HeroSmsProvider implements SmsProvider {
  private apiKey = '';
  private baseUrl = 'https://hero-sms.com/stubs/handler_api.php';
  private pollingIntervalMs = 5_000;

  constructor(private readonly fetcher: SmsFetch = fetch) {}

  async acquireNumber(opts: AcquireNumberOptions): Promise<SmsActivation> {
    this.rememberSettings(opts);
    if (!opts.apiKey?.trim()) {
      throw new ConfigurationError('sms.apiKey is required for HeroSMS number purchase');
    }

    const countries = await this.chooseCountriesForPurchase(await chooseCountries(opts, this.fetcher), opts);
    const noNumberCountries: string[] = [];
    for (const country of countries) {
      const body = await this.requestText({
        action: 'getNumber',
        api_key: opts.apiKey,
        service: opts.serviceCode,
        country,
        operator: opts.operator,
        maxPrice: formatSmsPriceParam(opts.maxPrice),
      });
      const match = /^ACCESS_NUMBER:([^:]+):(.+)$/.exec(body);
      if (match) {
        return {
          orderId: match[1],
          phone: match[2],
          country,
        };
      }
      if (body === 'NO_NUMBERS') {
        noNumberCountries.push(country);
        continue;
      }
      throw new Error(`HeroSMS getNumber failed: ${body}`);
    }

    throw new Error(`HeroSMS getNumber failed: NO_NUMBERS for countries ${noNumberCountries.join(', ')}`);
  }

  async pollCode(orderId: string, timeoutMs: number): Promise<string> {
    const startedAt = Date.now();
    while (Date.now() - startedAt <= timeoutMs) {
      const body = await this.requestText({
        action: 'getStatus',
        api_key: this.apiKey,
        id: orderId,
      });
      const match = /^STATUS_OK:(.+)$/.exec(body);
      if (match) {
        return match[1];
      }
      if (body !== 'STATUS_WAIT_CODE') {
        throw new Error(`HeroSMS getStatus failed: ${body}`);
      }
      const remainingMs = timeoutMs - (Date.now() - startedAt);
      if (remainingMs <= 0) {
        break;
      }
      await delay(Math.min(this.pollingIntervalMs, remainingMs));
    }

    throw new Error(`SMS code timeout after ${timeoutMs}ms`);
  }

  async release(orderId: string): Promise<void> {
    await this.requestText({
      action: 'setStatus',
      api_key: this.apiKey,
      id: orderId,
      status: '8',
    });
  }

  async markInvalid(_orderId: string): Promise<void> {
    return;
  }

  private rememberSettings(opts: SmsSettings): void {
    this.apiKey = opts.apiKey ?? '';
    this.baseUrl = opts.baseUrl;
    this.pollingIntervalMs = opts.pollingIntervalMs;
  }

  private async requestText(params: Record<string, string | undefined>): Promise<string> {
    const url = new URL(this.baseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value.length > 0) {
        url.searchParams.set(key, value);
      }
    }
    const response = await this.fetcher(url);
    if (!response.ok) {
      throw new Error(`HeroSMS request failed with HTTP ${response.status}`);
    }
    return (await response.text()).trim();
  }

  private async chooseCountriesForPurchase(countries: string[], opts: SmsSettings): Promise<string[]> {
    if (opts.minPrice === undefined && opts.selectionStrategy !== 'price_first') {
      return countries;
    }

    const prices = await this.getPrices(opts);
    const filtered = countries.filter((country) => {
      const price = prices[country];
      if (opts.minPrice === undefined) return true;
      return price === undefined || price >= opts.minPrice!;
    });

    if (opts.selectionStrategy !== 'price_first') {
      return filtered;
    }

    return filtered
      .map((country, index) => ({ country, index, price: prices[country] ?? Number.POSITIVE_INFINITY }))
      .sort((left, right) => left.price - right.price || left.index - right.index)
      .map((item) => item.country);
  }

  private async getPrices(opts: SmsSettings): Promise<Record<string, number>> {
    const body = await this.requestText({
      action: 'getPrices',
      api_key: opts.apiKey,
      service: opts.serviceCode,
    });
    try {
      const parsed = parseHeroSmsPrices(body);
      const prices: Record<string, number> = {};
      for (const [country, services] of Object.entries(parsed)) {
        if (!services || typeof services !== 'object') continue;
        const service = services[opts.serviceCode];
        if (!service || typeof service !== 'object') continue;
        const cost = Number(service.cost);
        if (Number.isFinite(cost)) {
          prices[country] = cost;
        }
      }
      return prices;
    } catch {
      return {};
    }
  }
}

export interface SmsTimeoutPolicy {
  codeTimeoutMs: number;
  cancelDelayMs: number;
}

export async function waitForSmsCodeOrCancelNumber(
  provider: SmsProvider,
  activation: SmsActivation,
  policy: SmsTimeoutPolicy,
): Promise<string> {
  try {
    return await provider.pollCode(activation.orderId, policy.codeTimeoutMs);
  } catch (error) {
    if (error instanceof Error && error.message === `SMS code timeout after ${policy.codeTimeoutMs}ms`) {
      await provider.markInvalid(activation.orderId);
      setTimeout(() => {
        void provider.release(activation.orderId);
      }, policy.cancelDelayMs);
    }
    throw error;
  }
}

async function chooseCountries(opts: SmsSettings, fetcher: SmsFetch): Promise<string[]> {
  if (opts.candidateCountries.length === 0) {
    throw new ConfigurationError('sms.candidateCountries requires at least 1 country');
  }
  const direct = opts.candidateCountries.map(toKnownSmsActivateCountryId);
  if (direct.every(Boolean)) {
    return direct as string[];
  }

  let countries: SmsCountry[] = [];
  try {
    countries = await fetchHeroSmsCountries(fetcher);
  } catch {
    countries = [];
  }

  return opts.candidateCountries.map((country, index) => {
    const known = direct[index];
    if (known) return known;
    const resolved = resolveSmsCountryId(countries, country);
    if (!resolved) {
      throw new ConfigurationError(`Unsupported HeroSMS country code: ${country}. Use a numeric SMS-Activate country id.`);
    }
    return resolved;
  });
}

function toKnownSmsActivateCountryId(country: string): string | undefined {
  const normalized = country.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (/^\d+$/.test(normalized)) {
    return normalized;
  }
  const mapped = SMS_ACTIVATE_COUNTRY_IDS[normalized];
  return mapped;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SMS_ACTIVATE_COUNTRY_IDS: Record<string, string> = {
  us: '12',
  usa: '12',
  unitedstates: '12',
  unitedstatesofamerica: '12',
  america: '12',
  美国: '12',
  美利坚: '12',
  gb: '16',
  uk: '16',
  unitedkingdom: '16',
  greatbritain: '16',
  britain: '16',
  england: '16',
  英国: '16',
  ca: '36',
  canada: '36',
  加拿大: '36',
  br: '73',
  brazil: '73',
  brasil: '73',
  巴西: '73',
  cl: '151',
  chile: '151',
  智利: '151',
};
