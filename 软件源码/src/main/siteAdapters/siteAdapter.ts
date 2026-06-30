import type { AccountRecord } from '../../shared/types.js';
import type { BrowserSessionHandle } from '../browser/browserController.js';
import { ComplianceBoundaryError } from '../domain/errors.js';

export interface SiteRegistrationContext {
  taskId: string;
  email: string;
  password: string;
  browser: BrowserSessionHandle;
}

export interface SiteAdapter {
  readonly id: string;
  readonly displayName: string;
  register(context: SiteRegistrationContext): Promise<AccountRecord>;
}

export class OpenAiChatGptAdapter implements SiteAdapter {
  readonly id = 'chatgpt-openai';
  readonly displayName = 'ChatGPT / OpenAI';

  async register(_context: SiteRegistrationContext): Promise<AccountRecord> {
    throw new ComplianceBoundaryError('OpenAI/ChatGPT registration automation is intentionally not implemented in the skeleton; require explicit lawful authorization and reviewed site contract before adding any adapter logic');
  }
}
