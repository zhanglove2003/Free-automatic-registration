import { describe, expect, it } from 'vitest';
import { selectCheapestSmsCountries, parseHeroSmsBalance } from '../src/shared/smsHeroApi.js';
import type { SmsCountry } from '../src/shared/smsCountries.js';

describe('SmsHero price and balance helpers', () => {
  const countries: SmsCountry[] = [
    { id: '73', en: 'Brazil', zh: '巴西', aliases: [] },
    { id: '151', en: 'Chile', zh: '智利', aliases: [] },
    { id: '50', en: 'Austria', zh: '奥地利', aliases: [] },
    { id: '36', en: 'Canada', zh: '加拿大', aliases: [] },
  ];

  it('selects the three cheapest countries with available inventory', () => {
    const prices = {
      73: { dr: { cost: 0.0456, count: 3 } },
      151: { dr: { cost: 0.0199, count: 1 } },
      50: { dr: { cost: 0.0501, count: 0 } },
      36: { dr: { cost: 0.0201, count: 9 } },
    };

    expect(selectCheapestSmsCountries(countries, prices, 'dr', 3)).toEqual([
      { id: '151', en: 'Chile', zh: '智利', aliases: [], price: 0.0199, available: 1 },
      { id: '36', en: 'Canada', zh: '加拿大', aliases: [], price: 0.0201, available: 9 },
      { id: '73', en: 'Brazil', zh: '巴西', aliases: [], price: 0.0456, available: 3 },
    ]);
  });

  it('parses HeroSMS balance responses', () => {
    expect(parseHeroSmsBalance('ACCESS_BALANCE:12.3456')).toBe(12.3456);
  });
});
