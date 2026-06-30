import type { AccountRecord } from '../../shared/types.js';

export interface CallbackResult {
  ok: boolean;
  detail?: string;
}

export interface CallbackAdapter {
  readonly name: string;
  send(record: AccountRecord): Promise<CallbackResult>;
}

export interface CodexManagerPayload {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  chatgpt_account_id?: string;
  email: string;
  meta: {
    label: string;
    issuer: string;
    group_name?: string;
    note?: string;
    tags?: string[];
    workspace_id?: string;
    chatgpt_account_id?: string;
  };
}

export function toCodexManagerPayload(account: AccountRecord): CodexManagerPayload {
  if (!account.tokens?.accessToken?.trim()) {
    throw new Error('accessToken is required for Codex-Manager export');
  }

  return {
    access_token: account.tokens.accessToken,
    id_token: emptyToUndefined(account.tokens.idToken),
    refresh_token: emptyToUndefined(account.tokens.refreshToken),
    chatgpt_account_id: emptyToUndefined(account.tokens.chatgptAccountId),
    email: account.email,
    meta: {
      label: account.meta?.label ?? account.email,
      issuer: account.meta?.issuer ?? 'https://auth.openai.com',
      group_name: emptyToUndefined(account.meta?.groupName),
      note: emptyToUndefined(account.meta?.note),
      tags: account.meta?.tags,
      workspace_id: emptyToUndefined(account.meta?.workspaceId),
      chatgpt_account_id: emptyToUndefined(account.tokens.chatgptAccountId),
    },
  };
}

export function toCodexManagerJson(account: AccountRecord): string {
  return `${JSON.stringify(toCodexManagerPayload(account), null, 2)}\n`;
}

export class CodexManagerAdapter implements CallbackAdapter {
  readonly name = 'codex-manager';

  async send(record: AccountRecord): Promise<CallbackResult> {
    return {
      ok: true,
      detail: toCodexManagerJson(record),
    };
  }
}

const callbackAdapters = new Map<string, CallbackAdapter>();

export function registerCallbackAdapter(adapter: CallbackAdapter): void {
  callbackAdapters.set(adapter.name, adapter);
}

export function getCallbackAdapter(name: string): CallbackAdapter {
  const adapter = callbackAdapters.get(name);
  if (!adapter) {
    throw new Error(`Unknown callback adapter: ${name}`);
  }
  return adapter;
}

export function listCallbackAdapters(): string[] {
  return [...callbackAdapters.keys()];
}

function emptyToUndefined(value: string | undefined): string | undefined {
  return value?.trim() ? value : undefined;
}

registerCallbackAdapter(new CodexManagerAdapter());
