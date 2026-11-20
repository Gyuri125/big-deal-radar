import type { Deal, Recurrence } from '../types';

export interface EffectiveDate {
  start: Date;
  end: Date | null;
  estimated: boolean;
}

const HU_MONTHS = [
  'január',
  'február',
  'március',
  'április',
  'május',
  'június',
  'július',
  'augusztus',
  'szeptember',
  'október',
  'november',
  'december',
];

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function parseISODate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function diffDays(from: Date, to: Date): number {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function formatHuDate(date: Date): string {
  return new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatHuDateShort(date: Date): string {
  return new Intl.DateTimeFormat('hu-HU', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatHuRange(start: Date, end: Date | null): string {
  if (!end) return formatHuDate(start);

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (sameDay) return formatHuDate(start);

  const sameMonth =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth();

  if (sameMonth) {
    const month = HU_MONTHS[start.getMonth()];
    return `${start.getFullYear()}. ${month} ${start.getDate()}–${end.getDate()}.`;
  }

  return `${formatHuDate(start)} – ${formatHuDate(end)}`;
}

export function formatHuf(value: number | null): string {
  if (value === null) return '';
  return `${value.toLocaleString('hu-HU')} Ft`;
}

export function valueScore(
  normalPrice: number | null,
  dealPrice: number | null
): number | null {
  if (normalPrice === null || dealPrice === null) return null;
  if (normalPrice <= 0) return null;
  const score = 1 - dealPrice / normalPrice;
  return Math.max(0, Math.min(1, score));
}

export function nextOccurrence(deal: Deal, now = new Date()): EffectiveDate | null {
  if (!deal.date_start) return null;

  const start = parseISODate(deal.date_start);
  const end = deal.date_end ? parseISODate(deal.date_end) : null;
  const recurrence: Recurrence = deal.recurrence;

  if (recurrence === 'continuous' || recurrence === 'monthly' || recurrence === 'weekly' || recurrence === 'daily') {
    return null;
  }

  if (recurrence === 'oneoff') {
    if (end && end >= startOfDay(now)) {
      return { start, end, estimated: false };
    }
    if (start >= startOfDay(now)) {
      return { start, end, estimated: false };
    }
    return null;
  }

  const startMonth = start.getMonth();
  const startDay = start.getDate();
  const endMonth = end?.getMonth() ?? null;
  const endDay = end?.getDate() ?? null;
  const endYearOffset =
    end && endMonth !== null && endMonth < startMonth ? 1 : 0;

  const referenceYear = start.getFullYear();
  const today = startOfDay(now);

  for (let year = now.getFullYear() - 1; year <= now.getFullYear() + 2; year += 1) {
    const candidateStart = new Date(year, startMonth, startDay);
    const candidateEnd = end
      ? new Date(year + endYearOffset, endMonth!, endDay!)
      : null;

    const isOngoing = candidateEnd
      ? candidateStart <= today && candidateEnd >= today
      : candidateStart.getTime() === today.getTime();

    if (isOngoing) {
      return {
        start: candidateStart,
        end: candidateEnd,
        estimated: year !== referenceYear,
      };
    }

    if (candidateStart >= startOfDay(now)) {
      return {
        start: candidateStart,
        end: candidateEnd,
        estimated: year !== referenceYear,
      };
    }
  }

  return null;
}

export function monthLabel(month: number | null): string {
  if (!month) return '';
  return HU_MONTHS[month - 1] ?? '';
}

export function currentMonthLabel(now = new Date()): string {
  return HU_MONTHS[now.getMonth()];
}

export function isInMonth(deal: Deal, month: number): boolean {
  if (deal.month === month) return true;
  return deal.months.includes(month);
}

export function daysUntil(date: Date, now = new Date()): number {
  return diffDays(now, date);
}

export function effectiveDateLabel(
  deal: Deal,
  effective: EffectiveDate | null
): string {
  if (!effective) return deal.timing;
  const label = formatHuRange(effective.start, effective.end);
  return effective.estimated ? `${label} (becsült)` : label;
}
