import fs from 'node:fs';
import path from 'node:path';
import type { Digest } from './digest';

export interface DigestState {
  last_sent_slot: string | null;
  last_sent_at: string | null;
  source: string | null;
  last_attempt_slot: string | null;
  last_attempt_at: string | null;
  last_attempt_ok: boolean | null;
}

export type NotificationKind = 'morning' | 'urgent';

export interface NotifyDecision {
  notify: boolean;
  kind: NotificationKind;
  slot: string;
  reason: string;
}

const STATE_FILE = 'data/digest-state.json';

const EMPTY_STATE: DigestState = {
  last_sent_slot: null,
  last_sent_at: null,
  source: null,
  last_attempt_slot: null,
  last_attempt_at: null,
  last_attempt_ok: null,
};

export function budapestParts(now = new Date()): {
  year: string;
  month: string;
  day: string;
  hour: string;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const get = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? '00';

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
  };
}

export function budapestDate(now = new Date()): string {
  const { year, month, day } = budapestParts(now);
  return `${year}-${month}-${day}`;
}

export function budapestHour(now = new Date()): number {
  return Number(budapestParts(now).hour);
}

export function slotFor(now: Date, kind: NotificationKind): string {
  return `${budapestDate(now)}T${kind}`;
}

function isUrgent(digest: Digest): boolean {
  if (digest.bookingOpens.length > 0) return true;
  return digest.upcoming.some(
    (item) => item.days !== null && item.days >= 0 && item.days <= 3
  );
}

/**
 * Eldönti, hogy a mostani futásnak kell-e digestet küldenie.
 *
 * - reggelente (10 óra előtt) naponta egyszer megy a teljes digest;
 * - napközben csak sürgős esemény vagy friss foglalásnyílás miatt megy,
 *   és ilyenkor is legfeljebb egyszer;
 * - ha a korábbi küldés hibára futott, a következő futás újrapróbálja;
 * - a `last_sent_slot` a közös, commitolt `data/digest-state.json`-ból jön,
 *   így a laptop és a GitHub Actions nem küld ugyanabban a slotban.
 */
export function decideNotification(params: {
  digest: Digest;
  now?: Date;
  force?: boolean;
  state?: DigestState;
}): NotifyDecision {
  const now = params.now ?? new Date();
  const state = params.state ?? EMPTY_STATE;
  const today = budapestDate(now);
  const hour = budapestHour(now);
  const morningSlot = `${today}Tmorning`;
  const urgentSlot = `${today}Turgent`;
  const sentMorningToday = state.last_sent_slot === morningSlot;
  const sentUrgentToday = state.last_sent_slot === urgentSlot;
  const sentToday = sentMorningToday || sentUrgentToday;
  const attemptedToday = state.last_attempt_slot?.startsWith(today) ?? false;

  if (params.force) {
    return {
      notify: true,
      kind: 'urgent',
      slot: urgentSlot,
      reason: 'kényszerített küldés',
    };
  }

  if (hour < 10) {
    if (sentToday) {
      return {
        notify: false,
        kind: 'morning',
        slot: morningSlot,
        reason: 'ma már ment digest',
      };
    }
    return {
      notify: true,
      kind: 'morning',
      slot: morningSlot,
      reason: 'reggeli digest',
    };
  }

  if (sentUrgentToday) {
    return {
      notify: false,
      kind: 'urgent',
      slot: urgentSlot,
      reason: 'a mai sürgős digest már kiment',
    };
  }

  if (!sentToday && state.last_attempt_ok === false) {
    return {
      notify: true,
      kind: 'urgent',
      slot: urgentSlot,
      reason: 'a korábbi digestküldés hibára futott – újrapróbálás',
    };
  }

  if (isUrgent(params.digest)) {
    return {
      notify: true,
      kind: 'urgent',
      slot: urgentSlot,
      reason: 'sürgős esemény vagy foglalásnyílás',
    };
  }

  if (!sentToday && !attemptedToday && hour < 14) {
    return {
      notify: true,
      kind: 'morning',
      slot: morningSlot,
      reason: 'reggeli digest pótlása',
    };
  }

  return {
    notify: false,
    kind: 'urgent',
    slot: urgentSlot,
    reason: 'nincs 3 napon belüli esemény vagy foglalásnyílás',
  };
}

export function readDigestState(root = process.cwd()): DigestState {
  const filePath = path.join(root, STATE_FILE);
  if (!fs.existsSync(filePath)) {
    return { ...EMPTY_STATE };
  }

  try {
    const parsed = JSON.parse(
      fs.readFileSync(filePath, 'utf8')
    ) as Partial<DigestState>;
    return {
      last_sent_slot:
        typeof parsed.last_sent_slot === 'string'
          ? parsed.last_sent_slot
          : null,
      last_sent_at:
        typeof parsed.last_sent_at === 'string' ? parsed.last_sent_at : null,
      source: typeof parsed.source === 'string' ? parsed.source : null,
      last_attempt_slot:
        typeof parsed.last_attempt_slot === 'string'
          ? parsed.last_attempt_slot
          : null,
      last_attempt_at:
        typeof parsed.last_attempt_at === 'string'
          ? parsed.last_attempt_at
          : null,
      last_attempt_ok:
        typeof parsed.last_attempt_ok === 'boolean'
          ? parsed.last_attempt_ok
          : null,
    };
  } catch {
    return { ...EMPTY_STATE };
  }
}

export function writeDigestState(
  state: DigestState,
  root = process.cwd()
): void {
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(
    path.join(root, STATE_FILE),
    `${JSON.stringify(state, null, 2)}\n`,
    'utf8'
  );
}
