export type LinkStatusKind = 'ok' | 'blocked' | 'failed' | 'unreachable';

/**
 * Ezek a státuszkódok jellemzően botblokkot jelentenek, nem halott linket.
 * A böngészőből ugyanaz az oldal általában elérhető.
 */
export const BLOCKED_LINK_STATUSES = new Set<number>([
  401, 403, 429, 511, 520, 521, 522, 523, 524,
]);

export function classifyLinkStatus(
  status: number | string
): LinkStatusKind {
  if (status === 'ERR' || typeof status !== 'number') return 'unreachable';
  if (BLOCKED_LINK_STATUSES.has(status)) return 'blocked';
  if (status >= 400) return 'failed';
  return 'ok';
}

export interface LinkStatusCounts {
  ok: number;
  blocked: number;
  failed: number;
  unreachable: number;
}

export function summarizeLinkStatuses(
  statuses: Array<number | string>
): LinkStatusCounts {
  const counts: LinkStatusCounts = {
    ok: 0,
    blocked: 0,
    failed: 0,
    unreachable: 0,
  };

  for (const status of statuses) {
    counts[classifyLinkStatus(status)] += 1;
  }

  return counts;
}
