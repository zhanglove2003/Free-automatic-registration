import type { AppSettings, ValidationResult } from '../../shared/types.js';

export function defaultSettings(): AppSettings {
  return {
    sms: {
      provider: 'hero-sms',
      baseUrl: 'https://hero-sms.com/stubs/handler_api.php',
      serviceCode: 'dr',
      candidateCountries: ['us', 'gb', 'ca'],
      selectionStrategy: 'country_first',
      pollingIntervalMs: 5_000,
      timeoutMs: 180_000,
      maxPollAttempts: 36,
    },
    captcha: {
      provider: 'disabled',
      timeoutMs: 180_000,
      maxAttempts: 2,
    },
    email: {
      storage: 'kv',
      pollingIntervalMs: 5_000,
      timeoutMs: 180_000,
    },
    codexManager: {
      directoryExport: {
        enabled: false,
      },
      rpcImport: {
        enabled: false,
      },
    },
    runtime: {
      maxConcurrency: 1,
      taskTimeoutMs: 600_000,
      maxTaskRetries: 1,
    },
  };
}

export function validateSettings(settings: AppSettings): ValidationResult {
  const errors: string[] = [];

  if (settings.sms.candidateCountries.length > 3) {
    errors.push('sms.candidateCountries supports at most 3 countries');
  }

  if (settings.sms.candidateCountries.length === 0) {
    errors.push('sms.candidateCountries requires at least 1 country');
  }

  if (!['country_first', 'price_first'].includes(settings.sms.selectionStrategy)) {
    errors.push('sms.selectionStrategy must be country_first or price_first');
  }

  if (settings.runtime.maxConcurrency < 1) {
    errors.push('runtime.maxConcurrency must be at least 1');
  }

  if (settings.codexManager.directoryExport.enabled && !settings.codexManager.directoryExport.path?.trim()) {
    errors.push('codexManager.directoryExport.path is required when directory export is enabled');
  }

  if (settings.codexManager.rpcImport.enabled && !settings.codexManager.rpcImport.url?.trim()) {
    errors.push('codexManager.rpcImport.url is required when RPC import is enabled');
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
