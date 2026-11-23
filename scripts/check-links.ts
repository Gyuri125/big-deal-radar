import fs from 'node:fs';
import path from 'node:path';
import type { Deal, DealSource } from '../src/types';
import {
  classifyLinkStatus,
  summarizeLinkStatuses,
} from '../src/utils/link-status';

interface LinkCheck {
  url: string;
  status: number | 'ERR';
  finalUrl?: string;
  error?: string;
  deals: string[];
}

const root = process.cwd();
const dealsPath = path.join(root, 'data', 'deals.json');

function loadDeals(): Deal[] {
  if (!fs.existsSync(dealsPath)) {
    throw new Error('Nincs data/deals.json – futtasd: npm run import');
  }
  return JSON.parse(fs.readFileSync(dealsPath, 'utf8')) as Deal[];
}

function collectLinks(deals: Deal[]): Map<string, Set<string>> {
  const links = new Map<string, Set<string>>();

  const add = (source: DealSource, deal: Deal) => {
    if (!links.has(source.url)) links.set(source.url, new Set());
    links.get(source.url)!.add(deal.title);
  };

  for (const deal of deals) {
    for (const source of deal.sources) add(source, deal);
    if (deal.source_url) {
      add({ label: 'Forrás', url: deal.source_url, type: 'official' }, deal);
    }
    if (deal.booking_url) {
      add(
        { label: 'Jegyvásárlás', url: deal.booking_url, type: 'ticket' },
        deal
      );
    }
  }

  return links;
}

function describeFetchError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  const cause = error.cause;
  if (cause instanceof Error && cause.message) {
    return `${error.message}: ${cause.message}`;
  }
  if (cause && typeof cause === 'object' && 'code' in cause) {
    return `${error.message}: ${String(cause.code)}`;
  }
  return error.message;
}

async function checkOne(url: string, dealTitles: string[]): Promise<LinkCheck> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(25_000),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      return {
        url,
        status: response.status,
        finalUrl: response.url,
        deals: dealTitles,
      };
    } catch (error) {
      if (attempt === maxAttempts) {
        return {
          url,
          status: 'ERR',
          error: describeFetchError(error),
          deals: dealTitles,
        };
      }

      // Átmeneti hálózati hiba esetén növekvő várakozással újrapróbáljuk.
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  return {
    url,
    status: 'ERR',
    error: 'Ismeretlen hiba',
    deals: dealTitles,
  };
}

async function main(): Promise<void> {
  const deals = loadDeals();
  const links = collectLinks(deals);
  const entries = [...links.entries()];
  const results: LinkCheck[] = [];
  let index = 0;
  const concurrency = 8;

  async function worker() {
    while (index < entries.length) {
      const [url, titles] = entries[index++];
      results.push(await checkOne(url, [...titles]));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));

  const counts = summarizeLinkStatuses(results.map((result) => result.status));
  const blocked = results.filter(
    (result) => classifyLinkStatus(result.status) === 'blocked'
  );
  const failed = results.filter(
    (result) => classifyLinkStatus(result.status) === 'failed'
  );
  const unreachable = results.filter(
    (result) => classifyLinkStatus(result.status) === 'unreachable'
  );
  const redirected = results.filter(
    (result) =>
      result.finalUrl &&
      result.finalUrl.replace(/\/$/, '') !== result.url.replace(/\/$/, '')
  );

  const statusFile = {
    checked_at: new Date().toISOString(),
    total: results.length,
    ok: counts.ok,
    redirected: redirected.length,
    blocked: counts.blocked,
    failed: counts.failed,
    unreachable: counts.unreachable,
    links: results
      .slice()
      .sort((a, b) => a.url.localeCompare(b.url))
      .map((result) => ({
        url: result.url,
        status: result.status,
        finalUrl: result.finalUrl ?? null,
        error: result.error ?? null,
        deals: result.deals,
      })),
  };

  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'data', 'link-status.json'),
    `${JSON.stringify(statusFile, null, 2)}\n`,
    'utf8'
  );

  console.log(`\n🔗 ${results.length} egyedi link ellenőrzése kész.`);
  console.log(`✅ OK: ${counts.ok}`);
  console.log(`↪️  Átirányítva: ${redirected.length}`);
  console.log(
    `⚠️  Botblokk (böngészőben valószínűleg ok): ${counts.blocked}`
  );
  console.log(
    `⚠️  Elérhetetlen (átmeneti hálózati hiba): ${counts.unreachable}`
  );
  console.log(`❌ HTTP hiba: ${counts.failed}`);

  if (blocked.length > 0) {
    console.log('\nBotblokkolt oldalak:');
    for (const result of blocked.sort((a, b) => a.url.localeCompare(b.url))) {
      console.log(`- [${result.status}] ${result.url}`);
    }
  }

  if (unreachable.length > 0) {
    console.log('\nElérhetetlen linkek (nem buktatják meg a workflow-t):');
    for (const result of unreachable.sort((a, b) =>
      a.url.localeCompare(b.url)
    )) {
      console.log(
        `- ${result.url}${result.error ? ` – ${result.error}` : ''}\n  Deale(k): ${result.deals.join(', ')}`
      );
    }
  }

  if (failed.length > 0) {
    console.log('\nHibás linkek:');
    for (const result of failed.sort((a, b) => a.url.localeCompare(b.url))) {
      console.log(
        `- [${result.status}] ${result.url}${
          result.error ? ` – ${result.error}` : ''
        }\n  Deale(k): ${result.deals.join(', ')}`
      );
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
