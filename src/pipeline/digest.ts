import type { Deal } from '../types';
import {
  daysUntil,
  effectiveDateLabel,
  formatHuDate,
  formatHuf,
  isInMonth,
  monthLabel,
  nextOccurrence,
  parseISODate,
  startOfDay,
  type EffectiveDate,
} from '../utils/dates';

export interface DigestItem {
  deal: Deal;
  effective: EffectiveDate | null;
  days: number | null;
  dateLabel: string;
}

export interface Digest {
  generatedAt: string;
  upcoming: DigestItem[];
  booking: DigestItem[];
  bookingOpens: DigestItem[];
  month: DigestItem[];
  money: DigestItem[];
  counts: {
    total: number;
    upcoming: number;
    month: number;
    money: number;
    booking: number;
    bookingOpens: number;
  };
}

export const TYPE_LABELS: Record<Deal['type'], string> = {
  flat: '★ Prémium ugyanannyi',
  free: 'Ingyenes',
  sale: 'Akció',
  money: 'Pénzügy',
  access: 'Különleges hozzáférés',
};

export const CATEGORY_LABELS: Record<Deal['category'], string> = {
  mozi: 'Mozi',
  kultura: 'Kultúra',
  muzeum: 'Múzeum',
  gasztro: 'Gasztronómia',
  utazas: 'Utazás',
  vasarlas: 'Vásárlás',
  penzugy: 'Pénzügy',
  egeszseg: 'Egészség',
  csalad: 'Család',
  egyeb: 'Egyéb',
};

function toItem(deal: Deal, now: Date): DigestItem {
  const effective = nextOccurrence(deal, now);
  const days = effective ? daysUntil(effective.start, now) : null;
  return {
    deal,
    effective,
    days,
    dateLabel: effectiveDateLabel(deal, effective),
  };
}

function sortItems(items: DigestItem[]): DigestItem[] {
  return [...items].sort((a, b) => {
    if (a.days !== null && b.days !== null && a.days !== b.days) {
      return a.days - b.days;
    }
    if (a.days === null && b.days !== null) return 1;
    if (a.days !== null && b.days === null) return -1;
    return a.deal.title.localeCompare(b.deal.title, 'hu');
  });
}

export function buildDigest(deals: Deal[], now = new Date()): Digest {
  const upcoming: DigestItem[] = [];
  const month: DigestItem[] = [];
  const money: DigestItem[] = [];

  for (const deal of deals) {
    const item = toItem(deal, now);
    const today = startOfDay(now);
    const isLive = Boolean(
      item.effective &&
        item.effective.start <= today &&
        (!item.effective.end || item.effective.end >= today)
    );

    if (isLive || (item.days !== null && item.days >= 0 && item.days <= 7)) {
      upcoming.push(item);
    }

    if (isInMonth(deal, now.getMonth() + 1)) {
      month.push(item);
    }

    if (deal.type === 'money') {
      const monthValue = deal.month ?? deal.months[0] ?? 12;
      if (monthValue === 12 || now.getMonth() + 1 >= 10) {
        money.push(item);
      }
    }
  }

  const upcomingIds = new Set(upcoming.map((item) => item.deal.id));
  const filteredMonth = month.filter((item) => !upcomingIds.has(item.deal.id));

  const bookingById = new Map<string, DigestItem>();
  const bookingOpens: DigestItem[] = [];
  const today = startOfDay(now);

  for (const deal of deals) {
    const item = toItem(deal, now);
    let shouldInclude = false;

    if (deal.booking_opens) {
      const bookingDate = new Date(`${deal.booking_opens}T00:00:00`);
      const diff = daysUntil(bookingDate, now);
      if (diff >= 0 && diff <= 14) {
        shouldInclude = true;
        bookingOpens.push(item);
      }
    }

    if (deal.booking_url) {
      const isLive = Boolean(
        item.effective &&
          item.effective.start <= today &&
          (!item.effective.end || item.effective.end >= today)
      );
      if (
        isLive ||
        (item.days !== null && item.days >= 0 && item.days <= 30)
      ) {
        shouldInclude = true;
      }
    }

    if (shouldInclude) {
      bookingById.set(deal.id, item);
    }
  }

  const bookingOpeningIds = new Set(
    bookingOpens.map((item) => item.deal.id)
  );
  const booking = [...bookingById.values()].filter(
    (item) => !bookingOpeningIds.has(item.deal.id)
  );

  return {
    generatedAt: now.toISOString(),
    upcoming: sortItems(upcoming),
    booking: sortItems(booking),
    bookingOpens: sortItems(bookingOpens),
    month: sortItems(filteredMonth),
    money: sortItems(money),
    counts: {
      total: deals.length,
      upcoming: upcoming.length,
      month: filteredMonth.length,
      money: money.length,
      booking: booking.length,
      bookingOpens: bookingOpens.length,
    },
  };
}

function priceLine(deal: Deal): string {
  if (deal.type === 'free' || deal.deal_price === 0) return 'Ingyenes';
  if (deal.deal_price !== null && deal.normal_price !== null) {
    return `${formatHuf(deal.deal_price)} (normál: ${formatHuf(deal.normal_price)})`;
  }
  if (deal.deal_price !== null) return formatHuf(deal.deal_price);
  return '';
}

function itemLine(item: DigestItem): string {
  const { deal } = item;
  const price = priceLine(deal);
  const parts = [deal.title, item.dateLabel, deal.deal];
  if (price) parts.push(price);
  return parts.join(' • ');
}

function bookingOpenLabel(item: DigestItem): string {
  const value = item.deal.booking_opens;
  return value
    ? `Foglalás nyílik: ${formatHuDate(parseISODate(value))}`
    : item.dateLabel;
}

export interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
  url?: string;
}

export function toDiscordEmbeds(digest: Digest, siteUrl: string): DiscordEmbed[] {
  const embeds: DiscordEmbed[] = [];
  const footer = {
    text: `Big-deal radar • ${new Date(digest.generatedAt).toLocaleDateString('hu-HU')}`,
  };

  if (digest.upcoming.length > 0) {
    embeds.push({
      title: '📅 Most és a következő 7 napban',
      description:
        'Ezekre érdemes most figyelni. A részletekért nyisd meg a radart.',
      color: 0xff6b35,
      fields: digest.upcoming.slice(0, 10).map((item) => ({
        name: item.deal.title,
        value: `${item.dateLabel}\n${item.deal.deal}${
          priceLine(item.deal) ? `\n${priceLine(item.deal)}` : ''
        }`,
        inline: false,
      })),
      footer,
      timestamp: digest.generatedAt,
      url: siteUrl,
    });
  } else {
    embeds.push({
      title: '📅 Most és a következő 7 napban',
      description:
        'Nincs aktuális vagy 7 napon belüli esemény. Nézd a havi radart, hátha ott van valami.',
      color: 0xff6b35,
      footer,
      timestamp: digest.generatedAt,
      url: siteUrl,
    });
  }

  if (digest.month.length > 0) {
    embeds.push({
      title: `🗓️ ${monthLabel(new Date(digest.generatedAt).getMonth() + 1)} – havi radar`,
      description: 'Akciók és események, amelyek ebben a hónapban esedékesek.',
      color: 0x0f9d8a,
      fields: digest.month.slice(0, 10).map((item) => ({
        name: item.deal.title,
        value: `${item.dateLabel}\n${item.deal.deal}`,
        inline: false,
      })),
      footer,
      timestamp: digest.generatedAt,
      url: siteUrl,
    });
  }

  if (digest.money.length > 0) {
    embeds.push({
      title: '💰 Pénzügyi határidők',
      description:
        'Év végi adójóváírások, támogatások és banki akciók – ne maradj le róluk.',
      color: 0xf4c95d,
      fields: digest.money.slice(0, 8).map((item) => ({
        name: item.deal.title,
        value: `${item.deal.deal}${
          item.deal.notes ? `\n${item.deal.notes}` : ''
        }`,
        inline: false,
      })),
      footer,
      timestamp: digest.generatedAt,
      url: siteUrl,
    });
  }

  if (digest.bookingOpens.length > 0) {
    embeds.push({
      title: '🎟️ Foglalás nyílik',
      description:
        'Ezeknél hamarosan indul a jegy- vagy asztalfoglalás. Ne maradj le a nyitásról.',
      color: 0x7c5cff,
      fields: digest.bookingOpens.slice(0, 8).map((item) => ({
        name: item.deal.title,
        value: `${bookingOpenLabel(item)}\n${
          item.deal.booking_note ?? item.deal.deal
        }`,
        inline: false,
      })),
      footer,
      timestamp: digest.generatedAt,
      url: siteUrl,
    });
  }

  if (digest.booking.length > 0) {
    embeds.push({
      title: '🎟️ Jegyvásárlás / foglalás',
      description:
        'Ezeknél érdemes előre venni vagy foglalni. A részletek a dealnél.',
      color: 0x7c5cff,
      fields: digest.booking.slice(0, 8).map((item) => ({
        name: item.deal.title,
        value: `${item.dateLabel}\n${
          item.deal.booking_note ?? item.deal.deal
        }`,
        inline: false,
      })),
      footer,
      timestamp: digest.generatedAt,
      url: siteUrl,
    });
  }

  return embeds.slice(0, 6);
}

export function toPlainText(digest: Digest, siteUrl: string): string {
  const lines: string[] = [];
  lines.push('BIG-DEAL RADAR – napi digest');
  lines.push('');

  lines.push('📅 Most és a következő 7 napban');
  if (digest.upcoming.length === 0) {
    lines.push('Nincs aktuális vagy 7 napon belüli esemény.');
  } else {
    for (const item of digest.upcoming.slice(0, 10)) {
      lines.push(`• ${itemLine(item)}`);
    }
  }
  lines.push('');

  if (digest.month.length > 0) {
    lines.push(`🗓️ ${monthLabel(new Date(digest.generatedAt).getMonth() + 1)} – havi radar`);
    for (const item of digest.month.slice(0, 10)) {
      lines.push(`• ${itemLine(item)}`);
    }
    lines.push('');
  }

  if (digest.bookingOpens.length > 0) {
    lines.push('🎟️ Foglalás nyílik');
    for (const item of digest.bookingOpens.slice(0, 8)) {
      lines.push(
        `• ${item.deal.title} – ${bookingOpenLabel(item)}: ${
          item.deal.booking_note ?? item.deal.deal
        }`
      );
    }
    lines.push('');
  }

  if (digest.booking.length > 0) {
    lines.push('🎟️ Jegyvásárlás / foglalás');
    for (const item of digest.booking.slice(0, 8)) {
      lines.push(
        `• ${item.deal.title}: ${
          item.deal.booking_note ?? item.deal.deal
        }`
      );
    }
    lines.push('');
  }

  if (digest.money.length > 0) {
    lines.push('💰 Pénzügyi határidők');
    for (const item of digest.money.slice(0, 8)) {
      lines.push(`• ${item.deal.title}: ${item.deal.deal}`);
    }
    lines.push('');
  }

  lines.push(`Teljes lista: ${siteUrl}`);
  return lines.join('\n');
}

export function digestSummary(digest: Digest): string {
  return [
    `összes: ${digest.counts.total}`,
    `következő 7 nap: ${digest.counts.upcoming}`,
    `havi: ${digest.counts.month}`,
    `foglalás: ${digest.counts.booking}`,
    `foglalásnyílás: ${digest.counts.bookingOpens}`,
    `pénzügy: ${digest.counts.money}`,
  ].join(', ');
}

export function isToday(date: Date, now = new Date()): boolean {
  return startOfDay(date).getTime() === startOfDay(now).getTime();
}
