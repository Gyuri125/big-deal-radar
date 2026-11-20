import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  Deal,
  DealCategory,
  DealOverride,
  DealType,
  Recurrence,
} from '../src/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const markdownPath = path.join(root, 'budapesti-100-big-deal.md');
const overridesPath = path.join(root, 'data', 'overrides.json');
const outputPath = path.join(root, 'data', 'deals.json');

const SECTION_MAP: Array<{
  test: RegExp;
  category: DealCategory;
  fallbackType: DealType;
}> = [
  { test: /Prémium ugyanannyi/, category: 'kultura', fallbackType: 'flat' },
  { test: /Ingyenes kulturális/, category: 'kultura', fallbackType: 'free' },
  { test: /Mozi, színház, zene/, category: 'kultura', fallbackType: 'access' },
  { test: /Gasztronómia/, category: 'gasztro', fallbackType: 'access' },
  { test: /Utazás/, category: 'utazas', fallbackType: 'sale' },
  { test: /Vásárlás/, category: 'vasarlas', fallbackType: 'sale' },
  { test: /Pénzügy/, category: 'penzugy', fallbackType: 'money' },
  { test: /Egészség/, category: 'egeszseg', fallbackType: 'free' },
  { test: /Család/, category: 'csalad', fallbackType: 'access' },
];

const MONTHS: Record<string, number> = {
  január: 1,
  jan: 1,
  február: 2,
  febr: 2,
  feb: 2,
  március: 3,
  márc: 3,
  április: 4,
  ápr: 4,
  május: 5,
  máj: 5,
  június: 6,
  jún: 6,
  július: 7,
  júl: 7,
  augusztus: 8,
  aug: 8,
  szeptember: 9,
  szept: 9,
  október: 10,
  okt: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractMonths(text: string): number[] {
  const normalized = text.toLowerCase().replace(/\./g, ' ');
  const found = new Set<number>();

  for (const [name, month] of Object.entries(MONTHS)) {
    if (normalized.includes(name)) found.add(month);
  }

  if (found.size === 0) {
    if (/tavasz/.test(normalized)) [3, 4, 5].forEach((m) => found.add(m));
    if (/nyár/.test(normalized)) [6, 7, 8].forEach((m) => found.add(m));
    if (/ősz/.test(normalized)) [9, 10, 11].forEach((m) => found.add(m));
    if (/tél/.test(normalized)) [12, 1, 2].forEach((m) => found.add(m));
  }

  return [...found].sort((a, b) => a - b);
}

function inferType(text: string, fallback: DealType): DealType {
  if (fallback === 'money') return 'money';
  if (fallback === 'free') return 'free';

  if (/ingyenes|\b0\s*ft\b|díjmentes/i.test(text)) return 'free';
  if (/féláron|kedvezmény|%|akció|leárazás|olcsóbb/i.test(text)) return 'sale';
  if (/egy jegy|karszalag|fix ár|ugyanannyi|egységes|egyetlen/i.test(text)) {
    return 'flat';
  }

  return fallback;
}

function inferRecurrence(timing: string): Recurrence {
  const t = timing.toLowerCase();

  if (/mindennap|minden nap|naponta/.test(t)) return 'daily';
  if (/hetente|heti|keddenként|hétfőnként|szerdánként|csütörtökönként|péntekenként|szombatonként|vasárnaponként/.test(t)) {
    return 'weekly';
  }
  if (/havonta/.test(t)) return 'monthly';
  if (/egész évben|folyamatos|rendszeres|folyamatosan/.test(t)) {
    return 'continuous';
  }
  if (/időszakos pályázat/i.test(t)) return 'oneoff';

  return 'annual';
}

function inferLocation(title: string, timing: string, deal: string): string {
  const text = `${title} ${timing} ${deal}`.toLowerCase();

  if (text.includes('baja')) return 'Baja';
  if (text.includes('siófok')) return 'Siófok';
  if (text.includes('balaton')) return 'Balaton';
  if (text.includes('külföld')) return 'Külföld';
  if (text.includes('országos')) return 'Országos';
  if (
    text.includes('online') ||
    text.includes('webshop') ||
    text.includes('banki') ||
    text.includes('revolut') ||
    text.includes('wizz') ||
    text.includes('ryanair') ||
    text.includes('repülőtéri')
  ) {
    return 'Online';
  }

  return 'Budapest';
}

function parseRows(markdown: string): Deal[] {
  const deals: Deal[] = [];
  const parts = markdown.split(/^## /m).slice(1);

  for (const part of parts) {
    const lines = part.split(/\r?\n/);
    const heading = lines[0]?.trim() ?? '';
    const section = SECTION_MAP.find((entry) => entry.test.test(heading));
    if (!section) continue;

    for (const line of lines) {
      const match = line.match(
        /^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/
      );
      if (!match) continue;

      const [, numberText, title, timing, dealText] = match;
      const text = `${timing} ${dealText}`;
      const months = extractMonths(timing);
      const type = inferType(text, section.fallbackType);
      const location = inferLocation(title, timing, dealText);

      deals.push({
        id: slugify(title),
        title,
        category: section.category,
        type,
        timing,
        date_start: null,
        date_end: null,
        booking_opens: null,
        month: months[0] ?? null,
        months,
        recurrence: inferRecurrence(timing),
        deal: dealText,
        normal_price: null,
        deal_price: null,
        currency: 'HUF',
        location,
        source_url: null,
        booking_url: null,
        booking_note: null,
        confidence: 'unverified',
        tags: Array.from(
          new Set([
            section.category,
            type,
            location.toLowerCase(),
            ...(location === 'Budapest' ? ['budapest'] : []),
          ])
        ),
        notes: `Forrás: budapesti-100-big-deal.md #${numberText}`,
        featured: false,
      });
    }
  }

  return deals;
}

function loadOverrides(): Record<string, DealOverride> {
  if (!fs.existsSync(overridesPath)) return {};
  const raw = fs.readFileSync(overridesPath, 'utf8');
  return JSON.parse(raw) as Record<string, DealOverride>;
}

function mergeOverrides(
  deals: Deal[],
  overrides: Record<string, DealOverride>
): Deal[] {
  return deals.map((deal) => {
    const override = overrides[deal.id];
    if (!override) return deal;

    const merged: Deal = {
      ...deal,
      ...override,
      id: deal.id,
      title: deal.title,
      tags: override.tags ?? deal.tags,
    };

    merged.tags = Array.from(
      new Set([
        ...merged.tags.filter(
          (tag) => tag !== deal.category && tag !== deal.type
        ),
        merged.category,
        merged.type,
      ])
    );

    if (merged.date_start) {
      const month = Number(merged.date_start.slice(5, 7));
      if (Number.isFinite(month)) {
        merged.month = month;
        if (!merged.months.includes(month)) merged.months.push(month);
      }
    }

    return merged;
  });
}

function main() {
  if (!fs.existsSync(markdownPath)) {
    throw new Error(`Nem találom a markdown forrást: ${markdownPath}`);
  }

  const markdown = fs.readFileSync(markdownPath, 'utf8');
  const parsed = parseRows(markdown);
  const overrides = loadOverrides();

  const parsedIds = new Set(parsed.map((deal) => deal.id));
  for (const id of Object.keys(overrides)) {
    if (!parsedIds.has(id)) {
      console.warn(`⚠️  Az overridesban szereplő id nem található a markdownban: ${id}`);
    }
  }

  const merged = mergeOverrides(parsed, overrides);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');

  const verified = merged.filter((d) => d.confidence === 'verified').length;
  const dated = merged.filter((d) => d.date_start).length;

  console.log(`✅ ${merged.length} deal beolvasva.`);
  console.log(`   Ebből dátumos: ${dated}, ellenőrzött: ${verified}`);
  console.log(`   Kimenet: ${path.relative(root, outputPath)}`);
}

main();
