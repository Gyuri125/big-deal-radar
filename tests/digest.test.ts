import { describe, expect, it } from 'vitest';
import { buildDigest, toPlainText } from '../src/pipeline/digest';
import type { Deal } from '../src/types';

const deal: Deal = {
  id: 'teszt-filmunnep',
  title: 'Teszt Filmünnep',
  category: 'kultura',
  type: 'flat',
  timing: 'November 22.',
  date_start: '2026-11-22',
  date_end: '2026-11-22',
  booking_opens: null,
  month: 11,
  months: [11],
  recurrence: 'annual',
  deal: 'Minden jegy 1690 Ft',
  normal_price: 3100,
  deal_price: 1690,
  price_note: null,
  currency: 'HUF',
  location: 'Budapest',
  source_url: 'https://example.com',
  booking_url: null,
  booking_note: null,
  sources: [],
  confidence: 'verified',
  last_checked: '2026-11-20',
  tags: ['mozi', 'flat'],
  notes: null,
  featured: true,
};

describe('napi digest', () => {
  it('beteszi a következő 7 napos eseményt', () => {
    const digest = buildDigest([deal], new Date(2026, 10, 20));

    expect(digest.upcoming).toHaveLength(1);
    expect(digest.upcoming[0].deal.title).toBe('Teszt Filmünnep');
    expect(digest.upcoming[0].days).toBe(2);
  });

  it('a folyamatban lévő eseményt is beteszi', () => {
    const liveDeal: Deal = {
      ...deal,
      date_start: '2026-11-18',
      date_end: '2026-11-22',
    };
    const digest = buildDigest([liveDeal], new Date(2026, 10, 20));

    expect(digest.upcoming).toHaveLength(1);
    expect(digest.upcoming[0].days).toBeLessThan(0);
  });

  it('a foglalási linket beteszi a booking szekcióba', () => {
    const bookingDeal: Deal = {
      ...deal,
      booking_url: 'https://example.com/foglalas',
      booking_note: 'Foglalj előre.',
    };
    const digest = buildDigest([bookingDeal], new Date(2026, 10, 20));

    expect(digest.booking).toHaveLength(1);
    expect(digest.counts.booking).toBe(1);
  });

  it('a szöveges digest tartalmazza a címet és a linket', () => {
    const digest = buildDigest([deal], new Date(2026, 10, 20));
    const text = toPlainText(digest, 'https://example.github.io/big-deal-radar/');

    expect(text).toContain('Teszt Filmünnep');
    expect(text).toContain('https://example.github.io/big-deal-radar/');
  });

  it('üres listánál is ad értelmes szöveget', () => {
    const digest = buildDigest([], new Date(2026, 10, 20));
    const text = toPlainText(digest, 'https://example.com');

    expect(text).toContain('Nincs aktuális vagy 7 napon belüli esemény');
  });
});
