import { describe, expect, it } from 'vitest';
import { formatSmsTestPurchaseError } from '../src/shared/smsErrors.js';

describe('SmsHero user-facing errors', () => {
  it('turns Electron-wrapped NO_NUMBERS errors into actionable Chinese feedback', () => {
    const error = new Error("Error invoking remote method 'sms:testPurchase': Error: HeroSMS getNumber failed: NO_NUMBERS for countries 73, 151, 50");

    expect(formatSmsTestPurchaseError(error)).toBe('当前候选国家暂无可购买号码。请更换候选国家、提高最高购买价格，或稍后重试。');
  });
});
