import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../src/main/domain/settings.js';
import { Orchestrator, type SettingsStore, type SmsCancellationScheduler } from '../src/main/orchestrator/orchestrator.js';
import type { AppSettings } from '../src/shared/types.js';

class MemorySettingsStore implements SettingsStore {
  saved: AppSettings | undefined;

  constructor(initial?: AppSettings) {
    this.saved = initial;
  }

  load(): AppSettings | undefined {
    return this.saved ? structuredClone(this.saved) : undefined;
  }

  save(settings: AppSettings): void {
    this.saved = structuredClone(settings);
  }
}

describe('settings persistence', () => {
  it('loads previously saved SmsHero settings when the orchestrator starts', () => {
    const saved = defaultSettings();
    saved.sms.apiKey = 'persisted-key';
    saved.sms.candidateCountries = ['美国', 'United Kingdom', '36'];
    saved.sms.minPrice = 0.2;
    saved.sms.maxPrice = 0.5;

    const orchestrator = new Orchestrator(undefined, undefined, undefined, new MemorySettingsStore(saved));

    expect(orchestrator.getSettings().sms).toMatchObject({
      apiKey: 'persisted-key',
      candidateCountries: ['美国', 'United Kingdom', '36'],
      minPrice: 0.2,
      maxPrice: 0.5,
    });
  });

  it('saves updated SmsHero settings to the settings store', () => {
    const store = new MemorySettingsStore();
    const orchestrator = new Orchestrator(undefined, undefined, undefined, store);
    const settings = orchestrator.getSettings();
    settings.sms.apiKey = 'savedkey123456789';
    settings.sms.maxPrice = 0.6;

    orchestrator.updateSettings(settings);

    expect(store.saved?.sms.apiKey).toBe('savedkey123456789');
    expect(store.saved?.sms.maxPrice).toBe(0.6);
  });

  it('schedules SmsHero cancellation when a test purchase starts', async () => {
    const settings = defaultSettings();
    settings.sms.apiKey = 'smskey1234567890';
    settings.sms.codeTimeoutMs = 20_000;
    settings.sms.cancelDelayMs = 180_000;
    const store = new MemorySettingsStore(settings);
    const smsProvider = {
      acquireNumber: async () => ({ orderId: 'order-1', phone: '15551234567', country: '12' }),
      pollCode: async () => {
        throw new Error('not used by injected scheduler');
      },
      release: async () => undefined,
      markInvalid: async () => undefined,
    };
    const scheduled: Array<{ orderId: string; codeTimeoutMs: number; cancelDelayMs: number }> = [];
    const scheduler: SmsCancellationScheduler = {
      schedule(provider, activation, policy) {
        expect(provider).toBe(smsProvider);
        scheduled.push({
          orderId: activation.orderId,
          codeTimeoutMs: policy.codeTimeoutMs,
          cancelDelayMs: policy.cancelDelayMs,
        });
      },
    };
    const orchestrator = new Orchestrator(undefined, undefined, smsProvider, store, scheduler);

    await orchestrator.testSmsPurchase();

    expect(scheduled).toEqual([{ orderId: 'order-1', codeTimeoutMs: 20_000, cancelDelayMs: 180_000 }]);
  });
});
