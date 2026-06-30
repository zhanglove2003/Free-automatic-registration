import type { SmsSettings } from '../../shared/types.js';

export interface SmsActivation {
  id: string;
  phone: string;
  country: string;
}

export interface SmsProvider {
  checkBalance(): Promise<number>;
  requestNumber(settings: SmsSettings): Promise<SmsActivation>;
  pollCode(activationId: string): Promise<string | undefined>;
  complete(activationId: string): Promise<void>;
  cancel(activationId: string): Promise<void>;
}

export class HeroSmsProvider implements SmsProvider {
  async checkBalance(): Promise<number> {
    throw new Error('HeroSMS provider is a skeleton; configure and verify official API before enabling network calls');
  }

  async requestNumber(_settings: SmsSettings): Promise<SmsActivation> {
    throw new Error('HeroSMS number request is not implemented in the skeleton');
  }

  async pollCode(_activationId: string): Promise<string | undefined> {
    throw new Error('HeroSMS polling is not implemented in the skeleton');
  }

  async complete(_activationId: string): Promise<void> {
    return;
  }

  async cancel(_activationId: string): Promise<void> {
    return;
  }
}
