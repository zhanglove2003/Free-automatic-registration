export type TaskStatus = 'queued' | 'running' | 'waiting' | 'ready' | 'failed' | 'cancelled';
export type AccountStatus = 'created' | 'verified' | 'login_ok' | 'unusable';

export type NumberSelectionStrategy = 'country_first' | 'price_first';

export interface SmsSettings {
  provider: 'hero-sms';
  apiKey?: string;
  baseUrl: string;
  serviceCode: string;
  candidateCountries: string[];
  selectionStrategy: NumberSelectionStrategy;
  operator?: string;
  minPrice?: number;
  maxPrice?: number;
  pollingIntervalMs: number;
  codeTimeoutMs: number;
  cancelDelayMs: number;
  timeoutMs: number;
  maxPollAttempts: number;
}

export interface CaptchaSettings {
  provider?: 'capsolver' | 'yescaptcha' | '2captcha' | 'manual' | 'disabled';
  apiKey?: string;
  timeoutMs: number;
  maxAttempts: number;
}

export interface EmailSettings {
  domain?: string;
  workerApiUrl?: string;
  workerApiToken?: string;
  storage: 'kv' | 'd1';
  pollingIntervalMs: number;
  timeoutMs: number;
}

export interface CodexManagerSettings {
  directoryExport: {
    enabled: boolean;
    path?: string;
  };
  rpcImport: {
    enabled: boolean;
    url?: string;
    authToken?: string;
  };
}

export interface RuntimeSettings {
  maxConcurrency: number;
  taskTimeoutMs: number;
  maxTaskRetries: number;
}

export interface AppSettings {
  sms: SmsSettings;
  captcha: CaptchaSettings;
  email: EmailSettings;
  codexManager: CodexManagerSettings;
  runtime: RuntimeSettings;
}

export interface OAuthTokens {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  chatgptAccountId?: string;
}

export interface AccountMeta {
  label?: string;
  issuer?: string;
  groupName?: string;
  note?: string;
  tags?: string[];
  workspaceId?: string;
}

export interface AccountRecord {
  id: string;
  email: string;
  password?: string;
  phone?: string;
  createdAt: string;
  status: AccountStatus;
  tokens?: OAuthTokens;
  meta?: AccountMeta;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}
