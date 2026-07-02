import { describe, expect, it } from 'vitest';
import { defaultSettings, validateSettings } from '../src/main/domain/settings.js';

describe('settings validation', () => {
  it('accepts the documented default skeleton settings', () => {
    const result = validateSettings(defaultSettings());
    expect(result.ok).toBe(true);
  });

  it('rejects more than three HeroSMS candidate countries', () => {
    const settings = defaultSettings();
    settings.sms.candidateCountries = ['us', 'gb', 'ca', 'de'];

    const result = validateSettings(settings);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('sms.candidateCountries supports at most 3 countries');
  });

  it('requires Codex-Manager directory path when directory export is enabled', () => {
    const settings = defaultSettings();
    settings.codexManager.directoryExport.enabled = true;
    settings.codexManager.directoryExport.path = '';

    const result = validateSettings(settings);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('codexManager.directoryExport.path is required when directory export is enabled');
  });

  it('uses the requested SmsHero timeout and delayed-cancel defaults', () => {
    const settings = defaultSettings();

    expect(settings.sms.codeTimeoutMs).toBe(20_000);
    expect(settings.sms.cancelDelayMs).toBe(180_000);
  });

  it('requires SmsHero api key before automatic number purchase is enabled', () => {
    const settings = defaultSettings();
    settings.sms.apiKey = '';

    const result = validateSettings(settings);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('sms.apiKey is required for HeroSMS number purchase');
  });
});
