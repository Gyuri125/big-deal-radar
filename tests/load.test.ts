import { describe, expect, it } from 'vitest';
import { loadDeals, summarize } from '../src/pipeline/load';

describe('deal adatbázis', () => {
  it('betölti a dealeket', () => {
    const { deals } = loadDeals();
    expect(deals.length).toBeGreaterThanOrEqual(100);
  });

  it('minden dealnek van egyedi azonosítója és címe', () => {
    const { deals } = loadDeals();
    const ids = new Set(deals.map((deal) => deal.id));

    expect(ids.size).toBe(deals.length);
    for (const deal of deals) {
      expect(deal.title.length).toBeGreaterThan(0);
      expect(deal.id.length).toBeGreaterThan(0);
    }
  });

  it('van elég ellenőrzött és dátumos tétel', () => {
    const { deals } = loadDeals();
    const summary = summarize(deals);

    expect(summary.verified).toBeGreaterThanOrEqual(30);
    expect(summary.dated).toBeGreaterThanOrEqual(30);
    expect(summary.byType.flat).toBeGreaterThanOrEqual(8);
  });
});
