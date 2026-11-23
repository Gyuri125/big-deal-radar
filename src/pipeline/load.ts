import fs from 'node:fs';
import path from 'node:path';
import type { Deal } from '../types';
import { dealsSchema, validateDeals } from './schemas';

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
  const validationErrors = validateDeals(deals);
  if (validationErrors.length > 0) {
    throw new Error(
      `A deal adatbázis konzisztencia-hibás:\n${validationErrors
        .slice(0, 20)
        .map((error) => `- ${error}`)
        .join('\n')}`
    );
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
