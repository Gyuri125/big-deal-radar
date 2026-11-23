import { describe, expect, it } from 'vitest';
import type { Deal } from '../src/types';
import {
  httpUrlSchema,
  validateDeals,
  validateInputKeys,
  type InputData,
} from '../src/pipeline/schemas';

const baseDeal: Deal = {
  id: 'teszt-deal',
  title: 'Teszt deal',
  category: 'kultura',
  type: 'flat',
  timing: 'November',
  date_start: '2026-11-22',
  date_end: '2026-11-22',
  booking_opens: null,
  month: 11,
  months: [11],
  recurrence: 'annual',
  deal: 'Teszt ajánlat',
  normal_price: 1000,
  deal_price: 500,
  price_note: null,
  currency: 'HUF',
  location: 'Budapest',
  source_url: 'https://example.com',
  booking_url: null,
  booking_note: null,
  sources: [
    {
      label: 'Hivatalos',
      url: 'https://example.com',
      type: 'official',
    },
  ],
  confidence: 'verified',
  last_checked: '2026-11-22',
  tags: ['kultura'],
  notes: null,
  featured: false,
};

function inputData(overrides: Partial<InputData> = {}): InputData {
  return {
    overrides: {},
    sources: {},
    tags: {},
    titles: {},
    priceNotes: {},
    meta: { last_checked: '2026-11-22', note: 'teszt' },
    ...overrides,
  };
}

describe('URL séma', () => {
  it('csak http(s) URL-t fogad el', () => {
    expect(httpUrlSchema.safeParse('https://example.com').success).toBe(true);
    expect(httpUrlSchema.safeParse('http://example.com').success).toBe(true);
    expect(httpUrlSchema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(httpUrlSchema.safeParse('data:text/html,<script>').success).toBe(
      false
    );
    expect(httpUrlSchema.safeParse('ftp://example.com').success).toBe(false);
  });
});

describe('validateDeals', () => {
  it('elfogadja a konzisztens dealet', () => {
    expect(validateDeals([baseDeal])).toEqual([]);
  });

  it('jelzi a duplikált id-t és címet', () => {
    const errors = validateDeals([
      baseDeal,
      { ...baseDeal, title: 'Ugyanaz a cím' },
      { ...baseDeal, id: 'masik-deal', title: 'Ugyanaz a cím' },
    ]);

    expect(errors.some((error) => error.includes('duplikált deal id'))).toBe(
      true
    );
    expect(errors.some((error) => error.includes('duplikált deal cím'))).toBe(
      true
    );
  });

  it('megköveteli a verified deal last_checked dátumát', () => {
    const errors = validateDeals([{ ...baseDeal, last_checked: null }]);
    expect(errors.some((error) => error.includes('last_checked'))).toBe(true);
  });

  it('keresőlinket nem enged forrásként', () => {
    const errors = validateDeals([
      {
        ...baseDeal,
        sources: [
          {
            label: 'Keresés',
            url: 'https://www.google.com/search?q=teszt',
            type: 'search',
          },
        ],
      },
    ]);
    expect(errors.some((error) => error.includes('keresőlink'))).toBe(true);
  });

  it('jelzi a fordított dátumtartományt és a késői foglalásnyílást', () => {
    const errors = validateDeals([
      {
        ...baseDeal,
        date_start: '2026-11-22',
        date_end: '2026-11-20',
        booking_opens: '2026-11-25',
      },
    ]);
    expect(errors.some((error) => error.includes('date_start'))).toBe(true);
    expect(errors.some((error) => error.includes('booking_opens'))).toBe(true);
  });

  it('jelzi, ha a month nem egyezik a date_start hónapjával', () => {
    const errors = validateDeals([{ ...baseDeal, month: 10 }]);
    expect(errors.some((error) => error.includes('month'))).toBe(true);
  });
});

describe('validateInputKeys', () => {
  it('jelzi az árva kulcsokat minden input fájlban', () => {
    const errors = validateInputKeys(
      new Set([baseDeal.id]),
      inputData({
        overrides: { ismeretlen: {} },
        sources: { ismeretlen: [baseDeal.sources[0]] },
        tags: { ismeretlen: ['program'] },
        titles: { ismeretlen: 'Cím' },
        priceNotes: { ismeretlen: 'Megjegyzés' },
      })
    );

    expect(errors.filter((error) => error.includes('ismeretlen'))).toHaveLength(
      5
    );
  });

  it('jelzi a keresőlinket és a hiányzó meta dátumot', () => {
    const errors = validateInputKeys(
      new Set([baseDeal.id]),
      inputData({
        sources: {
          [baseDeal.id]: [
            {
              label: 'Keresés',
              url: 'https://www.google.com/search?q=teszt',
              type: 'search',
            },
          ],
        },
        meta: {},
      })
    );

    expect(errors.some((error) => error.includes('keresőlink'))).toBe(true);
    expect(errors.some((error) => error.includes('last_checked'))).toBe(true);
  });

  it('nem jelez hibát érvényes inputoknál', () => {
    const errors = validateInputKeys(
      new Set([baseDeal.id]),
      inputData({
        overrides: { [baseDeal.id]: { featured: true } },
        sources: { [baseDeal.id]: [baseDeal.sources[0]] },
        tags: { [baseDeal.id]: ['program'] },
        titles: { [baseDeal.id]: 'Új cím' },
        priceNotes: { [baseDeal.id]: 'Új megjegyzés' },
      })
    );

    expect(errors).toEqual([]);
  });
});
