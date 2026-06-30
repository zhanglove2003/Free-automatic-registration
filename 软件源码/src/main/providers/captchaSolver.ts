import { ComplianceBoundaryError } from '../domain/errors.js';

export interface CaptchaChallenge {
  kind: 'turnstile' | 'funcaptcha' | 'manual';
  siteKey?: string;
  pageUrl: string;
}

export interface CaptchaSolver {
  solve(challenge: CaptchaChallenge): Promise<string>;
}

export class DisabledCaptchaSolver implements CaptchaSolver {
  async solve(_challenge: CaptchaChallenge): Promise<string> {
    throw new ComplianceBoundaryError('Captcha solving is disabled in this skeleton; enable only after legal authorization and provider review');
  }
}
