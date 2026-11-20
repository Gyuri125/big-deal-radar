import { describe, expect, it } from 'vitest';
import { nextOccurrence } from '../src/utils/dates';
import type { Deal } from '../src/types';

const base: Deal = {
  id: 'test-deal',
  title: 'Teszt deal',
  category: 'kultura',
  type: 'flat',
  timing: 'Október eleje',
  date_start: '2026-10-08',
  date_end: '2026-10-11',
  booking_opens: null,
  month: 10,
  months: [10],
  recurrence: 'annual',
  deal: 'Teszt',
  normal_price: 3100,
  deal_price: 1690,
  price_note: null,
  currency: 'HUF',
  location: 'Budapest',
  source_url: null,
  booking_url: null,
  booking_note: null,
  sources: [],
  confidence: 'verified',
  last_checked: '2026-11-20',
  tags: ['kultura', 'flat'],
  notes: null,
  featured: true,
};

describe('nextOccurrence', () => {
  it('átviszi a következő évre a lejárt éves eseményt', () => {
    const now = new Date(2026, 10, 20);
    const occurrence = nextOccurrence(base, now);

    expect(occurrence).not.toBeNull();
    expect(occurrence?.start.getFullYear()).toBe(2027);
    expect(occurrence?.start.getMonth()).toBe(9);
    expect(occurrence?.start.getDate()).toBe(8);
    expect(occurrence?.estimated).toBe(true);
  });

  it('felismeri a folyamatban lévő eseményt', () => {
    const now = new Date(2026, 9, 9);
    const occurrence = nextOccurrence(base, now);

    expect(occurrence).not.toBeNull();
    expect(occurrence?.start.getFullYear()).toBe(2026);
    expect(occurrence?.estimated).toBe(false);
  });

  it('a lejárt egyszeri eseményre null-t ad', () => {
    const deal: Deal = {
      ...base,
      recurrence: 'oneoff',
      date_start: '2026-01-10',
      date_end: '2026-01-11',
    };

    expect(nextOccurrence(deal, new Date(2026, 10, 20))).toBeNull();
  });

  it('kezeli az évhatáron átnyúló eseményt', () => {
    const deal: Deal = {
      ...base,
      date_start: '2026-11-01',
      date_end: '2027-02-28',
      month: 11,
      months: [11, 12, 1, 2],
    };

    const occurrence = nextOccurrence(deal, new Date(2026, 11, 15));

    expect(occurrence).not.toBeNull();
    expect(occurrence?.start.getFullYear()).toBe(2026);
    expect(occurrence?.end?.getFullYear()).toBe(2027);
  });
});
