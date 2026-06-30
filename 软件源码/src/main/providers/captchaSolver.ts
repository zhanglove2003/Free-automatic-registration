import { ComplianceBoundaryError } from '../domain/errors.js';

export interface CaptchaChallenge {
  type: 'funcaptcha' | 'turnstile';
  siteKey: string;
  pageUrl: string;
  extra?: object;
}

export type CaptchaSolveRequest = CaptchaChallenge;

export interface CaptchaSolveResult {
  token: string;
}

export interface CaptchaSolver {
  readonly name: string;
  solve(req: CaptchaSolveRequest, timeoutMs: number): Promise<CaptchaSolveResult>;
}

export class DisabledCaptchaSolver implements CaptchaSolver {
  readonly name = 'disabled';

  async solve(_req: CaptchaSolveRequest, _timeoutMs: number): Promise<CaptchaSolveResult> {
    throw new ComplianceBoundaryError('Captcha solving is disabled in this skeleton; enable only after legal authorization and provider review');
  }
}
