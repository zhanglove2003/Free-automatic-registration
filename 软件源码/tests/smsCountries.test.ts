import { describe, expect, it } from 'vitest';
import { filterSmsCountries, parseHeroSmsCountries } from '../src/shared/smsCountries.js';

describe('SmsHero country catalog', () => {
  const heroSmsPayload = {
    73: { id: 73, eng: 'Brazil', chn: '巴西', rus: 'Бразилия', visible: 1 },
    87: { id: 87, eng: 'Paraguay', chn: '巴拉圭', rus: 'Парагвай', visible: 1 },
    151: { id: 151, eng: 'Chile', chn: '智利', rus: 'Чили', visible: 1 },
  };

  it('parses HeroSMS getCountries payload into searchable country records', () => {
    const countries = parseHeroSmsCountries(JSON.stringify(heroSmsPayload));

    expect(countries).toContainEqual({ id: '73', en: 'Brazil', zh: '巴西', aliases: ['Бразилия'] });
    expect(countries).toContainEqual({ id: '151', en: 'Chile', zh: '智利', aliases: ['Чили'] });
  });

  it('filters exact Chinese, English, and numeric country searches', () => {
    const countries = parseHeroSmsCountries(JSON.stringify(heroSmsPayload));

    expect(filterSmsCountries(countries, '巴西')).toEqual([
      { id: '73', en: 'Brazil', zh: '巴西', aliases: ['Бразилия'] },
    ]);
    expect(filterSmsCountries(countries, 'Chile')).toEqual([
      { id: '151', en: 'Chile', zh: '智利', aliases: ['Чили'] },
    ]);
    expect(filterSmsCountries(countries, '151')).toEqual([
      { id: '151', en: 'Chile', zh: '智利', aliases: ['Чили'] },
    ]);
  });
});
