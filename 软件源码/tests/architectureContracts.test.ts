import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CodexManagerAdapter, getCallbackAdapter, listCallbackAdapters } from '../src/main/exporters/codexManager.js';
import type { AccountRecord } from '../src/shared/types.js';

const root = process.cwd();

function readProjectFile(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('documented architecture contracts', () => {
  it('keeps EmailReceiver aligned with design spec section 5.1', () => {
    const source = readProjectFile('src/main/providers/emailReceiver.ts');

    expect(source).toContain('interface EmailReceiver');
    expect(source).toContain('allocAddress(): Promise<string>');
    expect(source).toContain('waitMail(to: string, matcher: MailMatcher, timeoutMs: number): Promise<MailMessage>');
    expect(source).toContain('extractCode(mail: MailMessage, rule: ExtractRule): string | null');
    expect(source).toContain('extractLink(mail: MailMessage, rule: ExtractRule): string | null');
    expect(source).not.toContain('pollLatest');
  });

  it('keeps SmsProvider timeout-aware and aligned with design spec section 5.1', () => {
    const source = readProjectFile('src/main/providers/smsProvider.ts');

    expect(source).toContain('acquireNumber(opts: AcquireNumberOptions): Promise<SmsActivation>');
    expect(source).toContain('pollCode(orderId: string, timeoutMs: number): Promise<string>');
    expect(source).toContain('release(orderId: string): Promise<void>');
    expect(source).toContain('markInvalid(orderId: string): Promise<void>');
    expect(source).not.toContain('pollCode(activationId: string): Promise<string | undefined>');
  });

  it('keeps CaptchaSolver aligned with timeout and token result contract', () => {
    const source = readProjectFile('src/main/providers/captchaSolver.ts');

    expect(source).toContain('readonly name: string');
    expect(source).toContain("type: 'funcaptcha' | 'turnstile'");
    expect(source).toContain('siteKey: string');
    expect(source).toContain('solve(req: CaptchaSolveRequest, timeoutMs: number): Promise<CaptchaSolveResult>');
    expect(source).toContain('token: string');
  });

  it('keeps SiteAdapter step boundaries observable instead of a single register method', () => {
    const source = readProjectFile('src/main/siteAdapters/siteAdapter.ts');

    expect(source).toContain('readonly site: string');
    expect(source).toContain('fillForm(ctx: PageCtx, profile: Profile): Promise<void>');
    expect(source).toContain('submit(ctx: PageCtx): Promise<void>');
    expect(source).toContain('needsCaptcha(ctx: PageCtx): Promise<CaptchaType | null>');
    expect(source).toContain('needsSms(ctx: PageCtx): Promise<boolean>');
    expect(source).toContain('fillSms(ctx: PageCtx, code: string): Promise<void>');
    expect(source).toContain('needsEmail(ctx: PageCtx): Promise<boolean>');
    expect(source).toContain('applyEmail(ctx: PageCtx, codeOrLink: string): Promise<void>');
    expect(source).toContain('verifySuccess(ctx: PageCtx): Promise<boolean>');
    expect(source).toContain('harvest(ctx: PageCtx): Promise<HarvestResult>');
    expect(source).not.toContain('register(context: SiteRegistrationContext): Promise<AccountRecord>');
  });

  it('provides a CallbackAdapter registry with Codex-Manager registered', async () => {
    const account: AccountRecord = {
      id: 'acct_1',
      email: 'user@example.com',
      createdAt: '2026-06-30T10:00:00.000Z',
      status: 'login_ok',
      tokens: { accessToken: 'access-token' },
    };

    expect(listCallbackAdapters()).toContain('codex-manager');
    expect(getCallbackAdapter('codex-manager')).toBeInstanceOf(CodexManagerAdapter);
    await expect(getCallbackAdapter('codex-manager').send(account)).resolves.toEqual({
      ok: true,
      detail: expect.stringContaining('access_token'),
    });
    expect(() => getCallbackAdapter('missing')).toThrow('Unknown callback adapter: missing');
  });

  it('separates account lifecycle status from task scheduling status', () => {
    const source = readProjectFile('src/shared/types.ts');

    expect(source).toContain("export type AccountStatus = 'created' | 'verified' | 'login_ok' | 'unusable'");
    expect(source).toContain('status: AccountStatus');
    expect(source).not.toContain('status: TaskStatus;');
  });

  it('keeps IPC channels compatible with design spec section 3.4 while preserving current UI aliases', () => {
    const ipc = readProjectFile('src/main/ipc.ts');
    const preload = readProjectFile('src/preload/preload.cjs');

    expect(ipc).toContain("ipcMain.handle('cmd:start'");
    expect(ipc).toContain("ipcMain.handle('cmd:saveSettings'");
    expect(ipc).toContain("window.webContents.send('evt:stats'");
    expect(ipc).toContain("window.webContents.send('evt:taskUpdate'");
    expect(ipc).toContain("window.webContents.send('evt:activity'");
    expect(ipc).toContain("ipcMain.handle('job:create'");
    expect(ipc).toContain("ipcMain.handle('settings:update'");
    expect(ipc).toContain("window.webContents.send('app:snapshot'");
    expect(preload).toContain("createJob: (input) => ipcRenderer.invoke('cmd:start', input)");
    expect(preload).toContain("updateSettings: (settings) => ipcRenderer.invoke('cmd:saveSettings', settings)");
  });
});
