import { describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../src/main/domain/settings.js';
import { HeroSmsProvider, waitForSmsCodeOrCancelNumber } from '../src/main/providers/smsProvider.js';

function makeTextResponse(body: string): Response {
  return new Response(body, { status: 200 });
}

describe('HeroSmsProvider', () => {
  it('buys a number through the SMS-Activate compatible getNumber API with numeric country id', async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string | URL) => {
      calls.push(String(url));
      return makeTextResponse('ACCESS_NUMBER:12345:15551234567');
    });
    const settings = defaultSettings();
    settings.sms.apiKey = 'sms-key';
    settings.sms.serviceCode = 'dr';
    settings.sms.candidateCountries = ['us'];

    const provider = new HeroSmsProvider(fetcher);
    const activation = await provider.acquireNumber(settings.sms);

    expect(activation).toEqual({ orderId: '12345', phone: '15551234567', country: '12' });
    expect(calls[0]).toContain('action=getNumber');
    expect(calls[0]).toContain('api_key=sms-key');
    expect(calls[0]).toContain('service=dr');
    expect(calls[0]).toContain('country=12');
  });

  it('allows an explicit numeric SMS-Activate country id', async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string | URL) => {
      calls.push(String(url));
      return makeTextResponse('ACCESS_NUMBER:12345:15551234567');
    });
    const settings = defaultSettings();
    settings.sms.apiKey = 'sms-key';
    settings.sms.candidateCountries = ['36'];

    const provider = new HeroSmsProvider(fetcher);
    const activation = await provider.acquireNumber(settings.sms);

    expect(activation.country).toBe('36');
    expect(calls[0]).toContain('country=36');
  });

  it('tries the next candidate country when HeroSMS has no numbers', async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string | URL) => {
      calls.push(String(url));
      if (String(url).includes('country=12')) {
        return makeTextResponse('NO_NUMBERS');
      }
      return makeTextResponse('ACCESS_NUMBER:67890:447700900123');
    });
    const settings = defaultSettings();
    settings.sms.apiKey = 'sms-key';
    settings.sms.candidateCountries = ['us', 'gb'];

    const provider = new HeroSmsProvider(fetcher);
    const activation = await provider.acquireNumber(settings.sms);

    expect(activation).toEqual({ orderId: '67890', phone: '447700900123', country: '16' });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('country=12');
    expect(calls[1]).toContain('country=16');
  });

  it('tries the next candidate country when a transient network error happens', async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string | URL) => {
      calls.push(String(url));
      if (String(url).includes('country=12')) {
        throw new TypeError('fetch failed');
      }
      return makeTextResponse('ACCESS_NUMBER:67890:447700900123');
    });
    const settings = defaultSettings();
    settings.sms.apiKey = 'sms-key';
    settings.sms.candidateCountries = ['us', 'gb'];

    const provider = new HeroSmsProvider(fetcher);
    const activation = await provider.acquireNumber(settings.sms);

    expect(activation).toEqual({ orderId: '67890', phone: '447700900123', country: '16' });
    expect(calls).toHaveLength(2);
  });

  it('adds an abort signal to HeroSMS network requests', async () => {
    let signal: AbortSignal | undefined;
    const fetcher = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return makeTextResponse('ACCESS_NUMBER:12345:15551234567');
    });
    const settings = defaultSettings();
    settings.sms.apiKey = 'sms-key';
    settings.sms.candidateCountries = ['us'];

    const provider = new HeroSmsProvider(fetcher);
    await provider.acquireNumber(settings.sms);

    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it('normalizes Chinese and English country names to SMS-Activate ids', async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string | URL) => {
      calls.push(String(url));
      if (String(url).includes('country=12')) return makeTextResponse('NO_NUMBERS');
      if (String(url).includes('country=16')) return makeTextResponse('NO_NUMBERS');
      return makeTextResponse('ACCESS_NUMBER:24680:14375551234');
    });
    const settings = defaultSettings();
    settings.sms.apiKey = 'sms-key';
    settings.sms.candidateCountries = ['美国', 'United Kingdom', '加拿大'];

    const provider = new HeroSmsProvider(fetcher);
    const activation = await provider.acquireNumber(settings.sms);

    expect(activation.country).toBe('36');
    expect(calls[0]).toContain('country=12');
    expect(calls[1]).toContain('country=16');
    expect(calls[2]).toContain('country=36');
  });

  it('normalizes Brazil and Chile search labels to SMS-Activate ids', async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string | URL) => {
      calls.push(String(url));
      if (String(url).includes('country=73')) return makeTextResponse('NO_NUMBERS');
      return makeTextResponse('ACCESS_NUMBER:13579:56912345678');
    });
    const settings = defaultSettings();
    settings.sms.apiKey = 'sms-key';
    settings.sms.candidateCountries = ['巴西', 'Chile'];

    const provider = new HeroSmsProvider(fetcher);
    const activation = await provider.acquireNumber(settings.sms);

    expect(activation.country).toBe('151');
    expect(calls[0]).toContain('country=73');
    expect(calls[1]).toContain('country=151');
  });

  it('passes maximum purchase price to getNumber with four-decimal precision', async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string | URL) => {
      calls.push(String(url));
      return makeTextResponse('ACCESS_NUMBER:12345:15551234567');
    });
    const settings = defaultSettings();
    settings.sms.apiKey = 'sms-key';
    settings.sms.maxPrice = 0.05;

    const provider = new HeroSmsProvider(fetcher);
    await provider.acquireNumber(settings.sms);

    expect(calls[0]).toContain('maxPrice=0.0500');
  });

  it('skips countries below the configured minimum price when price data is available', async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string | URL) => {
      calls.push(String(url));
      const value = String(url);
      if (value.includes('action=getPrices')) {
        return makeTextResponse(JSON.stringify({
          12: { dr: { cost: 0.1, count: 2 } },
          16: { dr: { cost: 0.45, count: 1 } },
        }));
      }
      return makeTextResponse('ACCESS_NUMBER:67890:447700900123');
    });
    const settings = defaultSettings();
    settings.sms.apiKey = 'sms-key';
    settings.sms.candidateCountries = ['us', 'gb'];
    settings.sms.minPrice = 0.2;

    const provider = new HeroSmsProvider(fetcher);
    const activation = await provider.acquireNumber(settings.sms);

    expect(activation.country).toBe('16');
    expect(calls.some((url) => url.includes('action=getNumber') && url.includes('country=12'))).toBe(false);
    expect(calls.some((url) => url.includes('action=getNumber') && url.includes('country=16'))).toBe(true);
  });

  it('sorts candidate countries by current price when lowest-price strategy is selected', async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string | URL) => {
      calls.push(String(url));
      const value = String(url);
      if (value.includes('action=getPrices')) {
        return makeTextResponse(JSON.stringify({
          16: { dr: { cost: 0.45, count: 1 } },
          12: { dr: { cost: 0.12, count: 4 } },
          36: { dr: { cost: 0.33, count: 2 } },
        }));
      }
      return makeTextResponse('ACCESS_NUMBER:12345:15551234567');
    });
    const settings = defaultSettings();
    settings.sms.apiKey = 'sms-key';
    settings.sms.candidateCountries = ['gb', 'us', 'ca'];
    settings.sms.selectionStrategy = 'price_first';

    const provider = new HeroSmsProvider(fetcher);
    const activation = await provider.acquireNumber(settings.sms);

    expect(activation.country).toBe('12');
    const getNumberCalls = calls.filter((url) => url.includes('action=getNumber'));
    expect(getNumberCalls[0]).toContain('country=12');
  });

  it('falls back to country order when price lookup fails', async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string | URL) => {
      calls.push(String(url));
      const value = String(url);
      if (value.includes('action=getPrices')) {
        throw new TypeError('fetch failed');
      }
      return makeTextResponse('ACCESS_NUMBER:12345:15551234567');
    });
    const settings = defaultSettings();
    settings.sms.apiKey = 'sms-key';
    settings.sms.candidateCountries = ['gb', 'us'];
    settings.sms.selectionStrategy = 'price_first';

    const provider = new HeroSmsProvider(fetcher);
    const activation = await provider.acquireNumber(settings.sms);

    expect(activation.country).toBe('16');
    expect(calls.some((url) => url.includes('action=getPrices'))).toBe(true);
    const getNumberCalls = calls.filter((url) => url.includes('action=getNumber'));
    expect(getNumberCalls[0]).toContain('country=16');
  });

  it('does not reject release when HeroSMS cancellation fails', async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const provider = new HeroSmsProvider(fetcher);

    await expect(provider.release('12345')).resolves.toBeUndefined();
  });

  it('marks a number invalid after a 20s code timeout and cancels it 3 minutes later', async () => {
    vi.useFakeTimers();
    try {
      const calls: string[] = [];
      const fetcher = vi.fn(async (url: string | URL) => {
        calls.push(String(url));
        return makeTextResponse('STATUS_WAIT_CODE');
      });
      const provider = new HeroSmsProvider(fetcher);

      const result = waitForSmsCodeOrCancelNumber(provider, { orderId: '12345', phone: '15551234567', country: 'us' }, {
        codeTimeoutMs: 20_000,
        cancelDelayMs: 180_000,
      });
      const expectation = expect(result).rejects.toThrow('SMS code timeout after 20000ms');

      await vi.advanceTimersByTimeAsync(20_000);
      await expectation;

      expect(calls.some((url) => url.includes('action=setStatus') && url.includes('status=8'))).toBe(false);

      await vi.advanceTimersByTimeAsync(179_999);
      expect(calls.some((url) => url.includes('action=setStatus') && url.includes('status=8'))).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      expect(calls.some((url) => url.includes('action=setStatus') && url.includes('status=8') && url.includes('id=12345'))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
