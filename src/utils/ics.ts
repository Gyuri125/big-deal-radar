import { addDays } from './dates';

export interface IcsEvent {
  uid: string;
  start: Date;
  end?: Date;
  summary: string;
  description?: string;
  location?: string;
  url?: string | null;
  alarms?: readonly string[];
}

export const DEFAULT_ALARMS: readonly string[] = [
  '-P14D',
  '-P7D',
  '-P1D',
  'PT0S',
];

const encoder = new TextEncoder();

/**
 * RFC 5545 TEXT escape: backslash, sorvég, vessző és pontosvessző.
 * A `\r` és a `\r\n` is `\n`-re alakul, hogy ne maradjon nyers CR a fájlban.
 */
export function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/**
 * 75 oktetes sorhajtás UTF-8 alapon. A folytatósor egy szóközzel kezdődik,
 * ezért ott csak 74 tartalmi oktett fér el.
 */
export function foldIcsLine(line: string, maxOctets = 75): string {
  if (encoder.encode(line).length <= maxOctets) return line;

  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;
  let limit = maxOctets;

  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    if (current && currentBytes + charBytes > limit) {
      chunks.push(current);
      current = char;
      currentBytes = charBytes;
      limit = Math.max(1, maxOctets - 1);
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }

  if (current) chunks.push(current);
  return chunks.join('\r\n ');
}

export function icsDate(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}${String(date.getDate()).padStart(2, '0')}`;
}

export function icsDateTime(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

function alarmLines(summary: string, alarms: readonly string[]): string[] {
  const description = escapeIcs(`Big-deal radar: ${summary}`);
  return alarms.flatMap((trigger) => [
    'BEGIN:VALARM',
    `TRIGGER:${trigger}`,
    'ACTION:DISPLAY',
    `DESCRIPTION:${description}`,
    'END:VALARM',
  ]);
}

export function buildIcsEventLines(
  event: IcsEvent,
  now = new Date()
): string[] {
  const end = event.end ?? event.start;
  const lines = [
    'BEGIN:VEVENT',
    `UID:${escapeIcs(event.uid)}`,
    `DTSTAMP:${icsDateTime(now)}`,
    `DTSTART;VALUE=DATE:${icsDate(event.start)}`,
    `DTEND;VALUE=DATE:${icsDate(addDays(end, 1))}`,
    `SUMMARY:${escapeIcs(event.summary)}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeIcs(event.location)}`);
  }
  if (event.url) {
    lines.push(`URL:${escapeIcs(event.url)}`);
  }

  lines.push(...alarmLines(event.summary, event.alarms ?? DEFAULT_ALARMS));
  lines.push('END:VEVENT');
  return lines;
}

export function buildVCalendar(
  events: IcsEvent[],
  options: { now?: Date; prodId?: string } = {}
): string {
  const now = options.now ?? new Date();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${options.prodId ?? '-//Big-deal radar//HU'}`,
    'CALSCALE:GREGORIAN',
    ...events.flatMap((event) => buildIcsEventLines(event, now)),
    'END:VCALENDAR',
  ];

  return `${lines
    .flatMap((line) => foldIcsLine(line))
    .join('\r\n')}\r\n`;
}
