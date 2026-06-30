import type { SmsSettings } from '../../shared/types.js';
import { ComplianceBoundaryError } from '../domain/errors.js';

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

export class HeroSmsProvider implements SmsProvider {
  async acquireNumber(_opts: AcquireNumberOptions): Promise<SmsActivation> {
    throw new ComplianceBoundaryError('HeroSMS number acquisition is not implemented in the skeleton; configure and verify official API before enabling network calls');
  }

  async pollCode(_orderId: string, _timeoutMs: number): Promise<string> {
    throw new ComplianceBoundaryError('HeroSMS polling is not implemented in the skeleton');
  }

  async release(_orderId: string): Promise<void> {
    return;
  }

  async markInvalid(_orderId: string): Promise<void> {
    return;
  }
}
