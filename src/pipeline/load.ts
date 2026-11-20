import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { Deal } from '../types';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Érvénytelen dátumformátum (YYYY-MM-DD)');

const dealSchema = z.object({
  id: z.string().min(1),
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
  date_start: isoDate.nullable(),
  date_end: isoDate.nullable(),
  booking_opens: isoDate.nullable(),
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
  currency: z.enum(['HUF', 'EUR']).nullable(),
  location: z.string().min(1),
  source_url: z.string().url().nullable(),
  booking_url: z.string().url().nullable(),
  booking_note: z.string().nullable(),
  confidence: z.enum(['verified', 'unverified', 'needs-check']),
  tags: z.array(z.string()),
  notes: z.string().nullable(),
  featured: z.boolean(),
});

const dealsSchema = z.array(dealSchema).min(1);

export interface LoadResult {
  deals: Deal[];
  filePath: string;
}

export function loadDeals(filePath = path.resolve(process.cwd(), 'data/deals.json')): LoadResult {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Nem találom a deal adatbázist: ${filePath}\nFuttasd: npm run import`
    );
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `A data/deals.json nem érvényes JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const result = dealsSchema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues
      .slice(0, 12)
      .map((issue) => `- ${issue.path.join('.') || '(gyökér)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`A deal adatbázis hibás:\n${details}`);
  }

  const deals = result.data as Deal[];
  const seen = new Set<string>();

  for (const deal of deals) {
    if (seen.has(deal.id)) {
      throw new Error(`Duplikált deal id: ${deal.id}`);
    }
    seen.add(deal.id);
  }

  return { deals, filePath };
}

export function summarize(deals: Deal[]) {
  const total = deals.length;
  const verified = deals.filter((d) => d.confidence === 'verified').length;
  const dated = deals.filter((d) => d.date_start).length;
  const featured = deals.filter((d) => d.featured).length;
  const byType = deals.reduce<Record<string, number>>((acc, deal) => {
    acc[deal.type] = (acc[deal.type] ?? 0) + 1;
    return acc;
  }, {});

  return { total, verified, dated, featured, byType };
}
