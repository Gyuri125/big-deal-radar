import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { Deal } from '../types';

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Érvénytelen dátumformátum (YYYY-MM-DD)')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, 'Érvénytelen naptári dátum');

export const httpUrlSchema = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), 'Csak http(s) URL engedélyezett');

export const dealSourceSchema = z
  .object({
    label: z.string().min(1),
    url: httpUrlSchema,
    type: z.enum(['official', 'ticket', 'article', 'search']),
  })
  .strict();

export const dealSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Érvénytelen deal id'),
    title: z.string().min(1),
    category: z.enum([
      'mozi',
      'kultura',
      'muzeum',
      'gasztro',
      'utazas',
      'vasarlas',
      'penzugy',
      'egeszseg',
      'csalad',
      'egyeb',
    ]),
    type: z.enum(['flat', 'free', 'sale', 'money', 'access']),
    timing: z.string().min(1),
    date_start: isoDateSchema.nullable(),
    date_end: isoDateSchema.nullable(),
    booking_opens: isoDateSchema.nullable(),
    month: z.number().int().min(1).max(12).nullable(),
    months: z.array(z.number().int().min(1).max(12)),
    recurrence: z.enum([
      'annual',
      'monthly',
      'weekly',
      'daily',
      'continuous',
      'oneoff',
    ]),
    deal: z.string().min(1),
    normal_price: z.number().nonnegative().nullable(),
    deal_price: z.number().nonnegative().nullable(),
    price_note: z.string().nullable(),
    currency: z.enum(['HUF', 'EUR']).nullable(),
    location: z.string().min(1),
    source_url: httpUrlSchema.nullable(),
    booking_url: httpUrlSchema.nullable(),
    booking_note: z.string().nullable(),
    sources: z.array(dealSourceSchema).min(1),
    confidence: z.enum(['verified', 'unverified', 'needs-check']),
    last_checked: isoDateSchema.nullable(),
    tags: z.array(z.string()),
    notes: z.string().nullable(),
    featured: z.boolean(),
  })
  .strict();

export const dealsSchema = z.array(dealSchema).min(1);

export const dealOverrideSchema = dealSchema
  .partial()
  .omit({ id: true, title: true })
  .strict();

export const overridesSchema = z.record(
  z.string().min(1),
  dealOverrideSchema
);

export const sourcesSchema = z.record(
  z.string().min(1),
  z.array(dealSourceSchema).min(1)
);

export const tagsSchema = z.record(
  z.string().min(1),
  z.array(z.string().min(1))
);

export const titlesSchema = z.record(z.string().min(1), z.string().min(1));

export const priceNotesSchema = z.record(
  z.string().min(1),
  z.string().min(1)
);

export const metaSchema = z
  .object({
    last_checked: isoDateSchema.nullable().optional(),
    note: z.string().optional(),
  })
  .strict();

export interface InputData {
  overrides: z.infer<typeof overridesSchema>;
  sources: z.infer<typeof sourcesSchema>;
  tags: z.infer<typeof tagsSchema>;
  titles: z.infer<typeof titlesSchema>;
  priceNotes: z.infer<typeof priceNotesSchema>;
  meta: z.infer<typeof metaSchema>;
}

function readJsonFile<T>(
  filePath: string,
  schema: z.ZodType<T>,
  label: string
): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Hiányzó adatfájl: ${label} (${filePath})`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `A ${label} nem érvényes JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues
      .slice(0, 12)
      .map(
        (issue) =>
          `- ${issue.path.join('.') || '(gyökér)'}: ${issue.message}`
      )
      .join('\n');
    throw new Error(`A ${label} sémája hibás:\n${details}`);
  }

  return result.data;
}

export function loadInputData(root = process.cwd()): InputData {
  return {
    overrides: readJsonFile(
      path.join(root, 'data', 'overrides.json'),
      overridesSchema,
      'data/overrides.json'
    ),
    sources: readJsonFile(
      path.join(root, 'data', 'sources.json'),
      sourcesSchema,
      'data/sources.json'
    ),
    tags: readJsonFile(
      path.join(root, 'data', 'tags.json'),
      tagsSchema,
      'data/tags.json'
    ),
    titles: readJsonFile(
      path.join(root, 'data', 'titles.json'),
      titlesSchema,
      'data/titles.json'
    ),
    priceNotes: readJsonFile(
      path.join(root, 'data', 'price-notes.json'),
      priceNotesSchema,
      'data/price-notes.json'
    ),
    meta: readJsonFile(
      path.join(root, 'data', 'meta.json'),
      metaSchema,
      'data/meta.json'
    ),
  };
}

export function validateInputKeys(
  dealIds: Set<string>,
  inputs: InputData
): string[] {
  const errors: string[] = [];
  const checkKeys = (label: string, record: Record<string, unknown>) => {
    for (const key of Object.keys(record)) {
      if (!dealIds.has(key)) {
        errors.push(`${label}: ismeretlen deal id: ${key}`);
      }
    }
  };

  checkKeys('overrides.json', inputs.overrides);
  checkKeys('sources.json', inputs.sources);
  checkKeys('tags.json', inputs.tags);
  checkKeys('titles.json', inputs.titles);
  checkKeys('price-notes.json', inputs.priceNotes);

  for (const [id, sources] of Object.entries(inputs.sources)) {
    for (const source of sources) {
      if (source.type === 'search') {
        errors.push(
          `sources.json: ${id} keresőlinket használ forrásként (${source.url})`
        );
      }
    }
  }

  if (!inputs.meta.last_checked) {
    errors.push('meta.json: hiányzó last_checked dátum');
  }

  return errors;
}

export function validateDeals(deals: Deal[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const titles = new Set<string>();

  for (const deal of deals) {
    const label = deal.id || '(ismeretlen id)';

    if (ids.has(deal.id)) {
      errors.push(`duplikált deal id: ${deal.id}`);
    }
    ids.add(deal.id);

    if (titles.has(deal.title)) {
      errors.push(`duplikált deal cím: ${deal.title}`);
    }
    titles.add(deal.title);

    if (
      deal.date_start &&
      deal.date_end &&
      deal.date_start > deal.date_end
    ) {
      errors.push(`${label}: date_start későbbi, mint a date_end`);
    }

    if (
      deal.booking_opens &&
      deal.date_start &&
      deal.booking_opens > deal.date_start
    ) {
      errors.push(`${label}: booking_opens későbbi, mint a date_start`);
    }

    if (deal.confidence === 'verified' && !deal.last_checked) {
      errors.push(`${label}: verified deal last_checked nélkül`);
    }

    if (deal.sources.length === 0) {
      errors.push(`${label}: nincs forrás`);
    }

    for (const source of deal.sources) {
      if (source.type === 'search') {
        errors.push(`${label}: keresőlink nem lehet forrás (${source.url})`);
      }
    }

    if (deal.date_start) {
      const startMonth = Number(deal.date_start.slice(5, 7));
      if (deal.month !== null && deal.month !== startMonth) {
        errors.push(`${label}: month nem egyezik a date_start hónapjával`);
      }
      if (!deal.months.includes(startMonth)) {
        errors.push(`${label}: months nem tartalmazza a date_start hónapját`);
      }
    }
  }

  return errors;
}
