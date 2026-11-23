import { describe, expect, it } from 'vitest';
import {
  buildIcsEventLines,
  buildVCalendar,
  escapeIcs,
  foldIcsLine,
  icsDate,
} from '../src/utils/ics';

const encoder = new TextEncoder();

function unfold(value: string): string {
  return value.replace(/\r\n /g, '');
}

describe('ICS escape', () => {
  it('kezeli a backslasht, a sorvégeket, a vesszőt és a pontosvesszőt', () => {
    expect(escapeIcs('A\\B\r\nC\nD\rE,F;G')).toBe(
      'A\\\\B\\nC\\nD\\nE\\,F\\;G'
    );
  });
});

describe('ICS sorhajtás', () => {
  it('75 oktett alatt nem tör', () => {
    const line = 'x'.repeat(75);
    expect(foldIcsLine(line)).toBe(line);
  });

  it('75 oktett felett folytatósorokra tör, és visszahajtható', () => {
    const line = `DESCRIPTION:${'á'.repeat(80)}`;
    const folded = foldIcsLine(line);
    const parts = folded.split('\r\n');

    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
    }
    expect(parts.slice(1).every((part) => part.startsWith(' '))).toBe(true);
    expect(unfold(folded)).toBe(line);
  });
});

describe('ICS naptár', () => {
  it('egynapos eseménynél a DTEND a következő nap', () => {
    const lines = buildIcsEventLines(
      {
        uid: 'teszt@big-deal-radar',
        start: new Date(2026, 10, 22),
        summary: 'Teszt esemény',
      },
      new Date('2026-11-22T08:00:00Z')
    );

    expect(lines).toContain('DTSTART;VALUE=DATE:20261122');
    expect(lines).toContain('DTEND;VALUE=DATE:20261123');
  });

  it('négy emlékeztetőt és escape-elt URL-t tesz a naptárba', () => {
    const content = buildVCalendar(
      [
        {
          uid: 'teszt@big-deal-radar',
          start: new Date(2026, 10, 22),
          summary: 'Teszt esemény',
          description: 'Leírás, pontosvessző; és backslash \\',
          url: 'https://example.com/a,b;c',
        },
      ],
      { now: new Date('2026-11-22T08:00:00Z') }
    );

    expect(content.match(/BEGIN:VALARM/g)).toHaveLength(4);
    expect(content).toContain('URL:https://example.com/a\\,b\\;c');
    expect(content).toContain('DESCRIPTION:Leírás\\, pontosvessző\\; és backslash \\\\');
    expect(content.endsWith('\r\n')).toBe(true);
  });

  it('a dátum helyi naptári napot használ', () => {
    expect(icsDate(new Date(2026, 11, 31))).toBe('20261231');
  });
});
