import { describe, expect, it } from 'vitest';
import { toCodexManagerPayload } from '../src/main/exporters/codexManager.js';
import type { AccountRecord } from '../src/shared/types.js';

const account: AccountRecord = {
  id: 'acct_1',
  email: 'user@example.com',
  password: 'local-only-secret',
  createdAt: '2026-06-30T10:00:00.000Z',
  status: 'login_ok',
  tokens: {
    accessToken: 'access-token',
    idToken: 'id-token',
    refreshToken: 'refresh-token',
    chatgptAccountId: 'chatgpt-account-id',
  },
  meta: {
    label: 'user@example.com',
    issuer: 'https://auth.openai.com',
    groupName: 'default',
    tags: ['generated', 'codex-manager'],
  },
};

describe('Codex-Manager exporter', () => {
  it('serializes the documented OAuth JSON fields', () => {
    const payload = toCodexManagerPayload(account);

    expect(payload).toEqual({
      access_token: 'access-token',
      id_token: 'id-token',
      refresh_token: 'refresh-token',
      chatgpt_account_id: 'chatgpt-account-id',
      email: 'user@example.com',
      meta: {
        label: 'user@example.com',
        issuer: 'https://auth.openai.com',
        group_name: 'default',
        tags: ['generated', 'codex-manager'],
        chatgpt_account_id: 'chatgpt-account-id',
      },
    });
  });

  it('refuses to export accounts without access_token', () => {
    const invalidAccount: AccountRecord = {
      ...account,
      tokens: { ...account.tokens, accessToken: '' },
    };

    expect(() => toCodexManagerPayload(invalidAccount)).toThrow('accessToken is required for Codex-Manager export');
  });
});
