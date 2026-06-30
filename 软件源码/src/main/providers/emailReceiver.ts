import { randomUUID } from 'node:crypto';
import { ComplianceBoundaryError } from '../domain/errors.js';

export interface MailMessage {
  to: string;
  from?: string;
  subject?: string;
  text?: string;
  html?: string;
  receivedAt: string;
  headers?: Record<string, string>;
}

export type MailMatcher = (mail: MailMessage) => boolean;

export interface ExtractRule {
  pattern: RegExp | string;
  group?: number;
}

export interface EmailReceiver {
  allocAddress(): Promise<string>;
  waitMail(to: string, matcher: MailMatcher, timeoutMs: number): Promise<MailMessage>;
  extractCode(mail: MailMessage, rule: ExtractRule): string | null;
  extractLink(mail: MailMessage, rule: ExtractRule): string | null;
}

export class CloudflareEmailWorkerReceiver implements EmailReceiver {
  constructor(private readonly domain?: string) {}

  async allocAddress(): Promise<string> {
    if (!this.domain?.trim()) {
      throw new ComplianceBoundaryError('Email catch-all domain is required before allocating addresses');
    }
    const localPart = `u_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    return `${localPart}@${this.domain}`;
  }

  async waitMail(_to: string, _matcher: MailMatcher, _timeoutMs: number): Promise<MailMessage> {
    throw new ComplianceBoundaryError('Cloudflare Email Worker polling is a skeleton; deploy Worker API and configure token before enabling');
  }

  extractCode(mail: MailMessage, rule: ExtractRule): string | null {
    return extractByRule(`${mail.subject ?? ''}\n${mail.text ?? ''}\n${mail.html ?? ''}`, rule);
  }

  extractLink(mail: MailMessage, rule: ExtractRule): string | null {
    return extractByRule(`${mail.text ?? ''}\n${mail.html ?? ''}`, rule);
  }
}

function extractByRule(content: string, rule: ExtractRule): string | null {
  const pattern = typeof rule.pattern === 'string' ? new RegExp(rule.pattern) : rule.pattern;
  const match = pattern.exec(content);
  if (!match) return null;
  return match[rule.group ?? 1] ?? match[0] ?? null;
}
