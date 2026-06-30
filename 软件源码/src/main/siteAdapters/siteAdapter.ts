import type { OAuthTokens } from '../../shared/types.js';
import type { BrowserSessionHandle } from '../browser/browserController.js';
import type { CaptchaSolveRequest } from '../providers/captchaSolver.js';
import { ComplianceBoundaryError } from '../domain/errors.js';

export type CaptchaType = CaptchaSolveRequest['type'];

export interface PageCtx {
  taskId: string;
  browser: BrowserSessionHandle;
}

export interface Profile {
  email: string;
  password: string;
  username?: string;
  phone?: string;
}

export interface HarvestResult {
  cookies: object;
  token?: string;
  oauth?: OAuthTokens & { workspaceId?: string };
  extra?: object;
}

export interface SiteAdapter {
  readonly site: string;
  readonly displayName: string;
  fillForm(ctx: PageCtx, profile: Profile): Promise<void>;
  submit(ctx: PageCtx): Promise<void>;
  needsCaptcha(ctx: PageCtx): Promise<CaptchaType | null>;
  needsSms(ctx: PageCtx): Promise<boolean>;
  fillSms(ctx: PageCtx, code: string): Promise<void>;
  needsEmail(ctx: PageCtx): Promise<boolean>;
  applyEmail(ctx: PageCtx, codeOrLink: string): Promise<void>;
  verifySuccess(ctx: PageCtx): Promise<boolean>;
  harvest(ctx: PageCtx): Promise<HarvestResult>;
}

export class OpenAiChatGptAdapter implements SiteAdapter {
  readonly site = 'chatgpt-openai';
  readonly displayName = 'ChatGPT / OpenAI';

  async fillForm(_ctx: PageCtx, _profile: Profile): Promise<void> {
    throw siteSkeletonBoundary();
  }

  async submit(_ctx: PageCtx): Promise<void> {
    throw siteSkeletonBoundary();
  }

  async needsCaptcha(_ctx: PageCtx): Promise<CaptchaType | null> {
    throw siteSkeletonBoundary();
  }

  async needsSms(_ctx: PageCtx): Promise<boolean> {
    throw siteSkeletonBoundary();
  }

  async fillSms(_ctx: PageCtx, _code: string): Promise<void> {
    throw siteSkeletonBoundary();
  }

  async needsEmail(_ctx: PageCtx): Promise<boolean> {
    throw siteSkeletonBoundary();
  }

  async applyEmail(_ctx: PageCtx, _codeOrLink: string): Promise<void> {
    throw siteSkeletonBoundary();
  }

  async verifySuccess(_ctx: PageCtx): Promise<boolean> {
    throw siteSkeletonBoundary();
  }

  async harvest(_ctx: PageCtx): Promise<HarvestResult> {
    throw siteSkeletonBoundary();
  }
}

function siteSkeletonBoundary(): ComplianceBoundaryError {
  return new ComplianceBoundaryError('OpenAI/ChatGPT registration automation is intentionally not implemented in the skeleton; require explicit lawful authorization and reviewed site contract before adding adapter logic');
}
