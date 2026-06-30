export interface ReceivedMail {
  to: string;
  from?: string;
  subject?: string;
  code?: string;
  link?: string;
  receivedAt: string;
}

export interface EmailReceiver {
  pollLatest(to: string, since: string): Promise<ReceivedMail | undefined>;
}

export class CloudflareEmailWorkerReceiver implements EmailReceiver {
  async pollLatest(_to: string, _since: string): Promise<ReceivedMail | undefined> {
    throw new Error('Cloudflare Email Worker polling is a skeleton; deploy Worker API and configure token before enabling');
  }
}
