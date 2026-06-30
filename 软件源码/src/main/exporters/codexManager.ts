import type { AccountRecord } from '../../shared/types.js';

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

function emptyToUndefined(value: string | undefined): string | undefined {
  return value?.trim() ? value : undefined;
}
