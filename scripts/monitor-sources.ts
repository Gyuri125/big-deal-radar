import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

interface MonitorSource {
  label: string;
  url: string;
  threshold?: number;
}

interface StoredSource extends MonitorSource {
  hash: string;
  words: string[];
  checked_at: string;
}

interface HashFile {
  checked_at: string;
  sources: Record<string, StoredSource>;
}

interface MonitorReport {
  checked_at: string;
  changed: MonitorSource[];
  added: MonitorSource[];
  errors: Array<MonitorSource & { error: string }>;
}

const root = process.cwd();
const configPath = path.join(root, 'data', 'source-monitor.json');
const hashPath = path.join(root, 'data', 'source-hashes.json');
const reportPath = path.join(root, 'data', 'source-monitor-report.json');

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function normalizeHtml(html: string): string {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const description =
    html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i
    )?.[1] ?? '';
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/[A-Za-z0-9+/=]{40,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return `${title} ${description} ${text}`.trim();
}

function hashText(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function extractWords(html: string): string[] {
  const text = normalizeHtml(html).toLowerCase();
  const words = text
    .split(/[^\p{L}\p{N}]+/u)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3);
  return [...new Set(words)].slice(0, 8000);
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection += 1;
  }
  return intersection / (setA.size + setB.size - intersection);
}

async function fetchSource(source: MonitorSource): Promise<string> {
  const response = await fetch(source.url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return normalizeHtml(await response.text());
}

async function main(): Promise<void> {
  const sources = readJson<MonitorSource[]>(configPath, []);
  const previous = readJson<HashFile>(hashPath, {
    checked_at: '',
    sources: {},
  });
  const next: HashFile = {
    checked_at: new Date().toISOString(),
    sources: {},
  };
  const changed: MonitorSource[] = [];
  const added: MonitorSource[] = [];
  const errors: Array<MonitorSource & { error: string }> = [];

  for (const source of sources) {
    try {
      const text = await fetchSource(source);
      const hash = hashText(text);
      const words = extractWords(text);
      const old = previous.sources[source.url];
      const threshold = source.threshold ?? 0.9;
      let similarity = 1;

      if (!old) {
        added.push(source);
      } else if (old.words?.length && words.length) {
        similarity = jaccardSimilarity(old.words, words);
        if (similarity < threshold) {
          changed.push(source);
          console.log(
            `  ${source.label}: hasonlóság ${Math.round(similarity * 100)}% (küszöb ${Math.round(threshold * 100)}%)`
          );
        }
      }

      next.sources[source.url] = {
        ...source,
        hash,
        words,
        checked_at: next.checked_at,
      };
    } catch (error) {
      errors.push({
        ...source,
        error: error instanceof Error ? error.message : String(error),
      });
      if (previous.sources[source.url]) {
        next.sources[source.url] = previous.sources[source.url];
      }
    }
  }

  const report: MonitorReport = {
    checked_at: next.checked_at,
    changed,
    added,
    errors,
  };

  fs.writeFileSync(hashPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`🔎 ${sources.length} forrás figyelése kész.`);
  console.log(`🆕 Új: ${added.length}, változott: ${changed.length}, hiba: ${errors.length}`);
  for (const item of changed) console.log(`- változott: ${item.label} (${item.url})`);
  for (const item of errors) console.log(`- hiba: ${item.label} – ${item.error}`);

  if (changed.length > 0 || errors.length > 0) {
    process.exitCode = 0;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
