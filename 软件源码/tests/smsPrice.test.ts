import { describe, expect, it } from 'vitest';
import { formatSmsPriceInput, formatSmsPriceParam, parseSmsPriceInput } from '../src/shared/smsPrice.js';

describe('SmsHero price precision', () => {
  it('keeps purchase prices at four decimal places for settings display and API params', () => {
    expect(parseSmsPriceInput('0.04564')).toBe(0.0456);
    expect(parseSmsPriceInput('0.04565')).toBe(0.0457);
    expect(formatSmsPriceInput(0.05)).toBe('0.0500');
    expect(formatSmsPriceParam(0.05)).toBe('0.0500');
  });
});
