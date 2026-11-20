import fs from 'node:fs';
import path from 'node:path';
import type { Deal, DealSource } from '../src/types';

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

async function checkOne(url: string, dealTitles: string[]): Promise<LinkCheck> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
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
    return {
      url,
      status: 'ERR',
      error: error instanceof Error ? error.message : String(error),
      deals: dealTitles,
    };
  }
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

  const blocked = results.filter(
    (result) =>
      result.status === 401 || result.status === 403 || result.status === 429
  );
  const failed = results.filter(
    (result) =>
      result.status === 'ERR' ||
      (result.status >= 400 &&
        result.status !== 401 &&
        result.status !== 403 &&
        result.status !== 429)
  );
  const redirected = results.filter(
    (result) =>
      result.finalUrl &&
      result.finalUrl.replace(/\/$/, '') !== result.url.replace(/\/$/, '')
  );

  console.log(`\n🔗 ${results.length} egyedi link ellenőrzése kész.`);
  console.log(
    `✅ OK: ${results.length - failed.length - blocked.length}`
  );
  console.log(`↪️  Átirányítva: ${redirected.length}`);
  console.log(
    `⚠️  Botblokk (böngészőben valószínűleg ok): ${blocked.length}`
  );
  console.log(`❌ Hiba: ${failed.length}`);

  if (blocked.length > 0) {
    console.log('\nBotblokkolt oldalak:');
    for (const result of blocked.sort((a, b) => a.url.localeCompare(b.url))) {
      console.log(`- [${result.status}] ${result.url}`);
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
