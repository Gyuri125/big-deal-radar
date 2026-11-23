import { describe, expect, it } from 'vitest';
import type { Digest, DigestItem } from '../src/pipeline/digest';
import {
  budapestDate,
  budapestHour,
  decideNotification,
  slotFor,
  type DigestState,
} from '../src/pipeline/notify-schedule';

const emptyState: DigestState = {
  last_sent_slot: null,
  last_sent_at: null,
  source: null,
  last_attempt_slot: null,
  last_attempt_at: null,
  last_attempt_ok: null,
};

function digest(overrides: Partial<Digest> = {}): Digest {
  return {
    generatedAt: '2026-11-22T08:00:00.000Z',
    upcoming: [],
    booking: [],
    bookingOpens: [],
    month: [],
    money: [],
    counts: {
      total: 0,
      upcoming: 0,
      month: 0,
      money: 0,
      booking: 0,
      bookingOpens: 0,
    },
    ...overrides,
  };
}

function item(days: number): DigestItem {
  return { days } as DigestItem;
}

describe('Budapest idő', () => {
  it('nyáron és télen is a helyi órát adja', () => {
    expect(budapestHour(new Date('2026-07-15T06:30:00Z'))).toBe(8);
    expect(budapestHour(new Date('2026-01-15T09:30:00Z'))).toBe(10);
    expect(budapestDate(new Date('2026-07-15T22:30:00Z'))).toBe('2026-07-16');
  });
});

describe('digest küldési döntés', () => {
  it('reggel küld, és a slot a nap + reggel', () => {
    const now = new Date('2026-01-15T07:30:00Z');
    const decision = decideNotification({ digest: digest(), now });

    expect(decision.notify).toBe(true);
    expect(decision.kind).toBe('morning');
    expect(decision.slot).toBe('2026-01-15Tmorning');
  });

  it('ugyanabban a reggeli slotban nem küld újra', () => {
    const now = new Date('2026-01-15T07:30:00Z');
    const decision = decideNotification({
      digest: digest(),
      now,
      state: { ...emptyState, last_sent_slot: '2026-01-15Tmorning' },
    });

    expect(decision.notify).toBe(false);
  });

  it('délben sürgős eseményre küld, de a reggeli digest után is csak egyszer', () => {
    const now = new Date('2026-01-15T11:30:00Z');
    const urgentDigest = digest({ upcoming: [item(2)] });

    const first = decideNotification({
      digest: urgentDigest,
      now,
      state: { ...emptyState, last_sent_slot: '2026-01-15Tmorning' },
    });
    expect(first.notify).toBe(true);
    expect(first.kind).toBe('urgent');

    const second = decideNotification({
      digest: urgentDigest,
      now: new Date('2026-01-15T19:30:00Z'),
      state: { ...emptyState, last_sent_slot: '2026-01-15Turgent' },
    });
    expect(second.notify).toBe(false);
  });

  it('foglalásnyílásra is sürgős digestet küld', () => {
    const decision = decideNotification({
      digest: digest({ bookingOpens: [item(5)] }),
      now: new Date('2026-01-15T11:30:00Z'),
    });

    expect(decision.notify).toBe(true);
    expect(decision.kind).toBe('urgent');
  });

  it('hiba után a következő futás újrapróbálja', () => {
    const decision = decideNotification({
      digest: digest(),
      now: new Date('2026-01-15T11:30:00Z'),
      state: {
        ...emptyState,
        last_attempt_slot: '2026-01-15T8',
        last_attempt_ok: false,
      },
    });

    expect(decision.notify).toBe(true);
    expect(decision.reason).toContain('újrapróbálás');
  });

  it('délután csendes, ha nincs sürgős esemény és már volt próbálkozás', () => {
    const decision = decideNotification({
      digest: digest(),
      now: new Date('2026-01-15T14:30:00Z'),
      state: {
        ...emptyState,
        last_attempt_slot: '2026-01-15T12',
        last_attempt_ok: true,
      },
    });

    expect(decision.notify).toBe(false);
  });

  it('kora délután pótolja az elmaradt reggeli digestet', () => {
    const decision = decideNotification({
      digest: digest(),
      now: new Date('2026-01-15T11:30:00Z'),
    });

    expect(decision.notify).toBe(true);
    expect(decision.reason).toContain('pótlása');
  });

  it('kényszerített küldés mindig megy', () => {
    const decision = decideNotification({
      digest: digest(),
      now: new Date('2026-01-15T11:30:00Z'),
      force: true,
      state: { ...emptyState, last_sent_slot: '2026-01-15Turgent' },
    });

    expect(decision.notify).toBe(true);
  });

  it('a slot a helyi napot használja', () => {
    expect(slotFor(new Date('2026-07-15T22:30:00Z'), 'morning')).toBe(
      '2026-07-16Tmorning'
    );
  });
});
