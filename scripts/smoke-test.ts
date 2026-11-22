import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const siteUrl = (
  process.env.SITE_URL ?? 'https://gyuri125.github.io/big-deal-radar/'
).replace(/\/?$/, '/');

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<{ status: number; text: string }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  });
  return { status: response.status, text: await response.text() };
}

async function main(): Promise<void> {
  const dealsPath = path.join(root, 'data', 'deals.json');
  const deals = JSON.parse(fs.readFileSync(dealsPath, 'utf8')) as Array<{
    id: string;
  }>;
  const sampleDeal = deals[0]?.id;

  const checks: Array<{ name: string; url: string; test: (text: string, status: number) => string | null }> = [
    {
      name: 'főoldal',
      url: siteUrl,
      test: (text, status) =>
        status === 200 && text.includes('Big-deal radar')
          ? null
          : `status=${status}, hiányzó cím`,
    },
    {
      name: 'status.json',
      url: `${siteUrl}status.json`,
      test: (text, status) => {
        if (status !== 200) return `status=${status}`;
        try {
          const statusData = JSON.parse(text) as {
            errors?: string[];
            counts?: { total?: number };
          };
          if ((statusData.errors ?? []).length > 0) return 'a status.json hibát jelez';
          if (!statusData.counts?.total) return 'hiányzó deal szám';
          return null;
        } catch {
          return 'érvénytelen JSON';
        }
      },
    },
    {
      name: 'RSS',
      url: `${siteUrl}feed.xml`,
      test: (text, status) =>
        status === 200 && text.includes('<rss') && text.includes('<item>')
          ? null
          : `status=${status}, hiányzó RSS tartalom`,
    },
    {
      name: 'manifest',
      url: `${siteUrl}manifest.webmanifest`,
      test: (text, status) => {
        if (status !== 200) return `status=${status}`;
        try {
          const manifest = JSON.parse(text) as { name?: string };
          return manifest.name ? null : 'hiányzó név';
        } catch {
          return 'érvénytelen JSON';
        }
      },
    },
    {
      name: 'gyűjtemények',
      url: `${siteUrl}gyujtemeny/`,
      test: (text, status) =>
        status === 200 && text.includes('Válogatott dealek')
          ? null
          : `status=${status}, hiányzó gyűjteményoldal`,
    },
    {
      name: 'forrás-egészség',
      url: `${siteUrl}forrasok/`,
      test: (text, status) =>
        status === 200 && text.includes('Forrás-egészség')
          ? null
          : `status=${status}, hiányzó forrás-egészség oldal`,
    },
    ...(sampleDeal
      ? [
          {
            name: 'minta deal-oldal',
            url: `${siteUrl}deal/${sampleDeal}/`,
            test: (text: string, status: number) =>
              status === 200 && text.includes('Big-deal radar')
                ? null
                : `status=${status}`,
          },
        ]
      : []),
  ];

  let lastErrors: string[] = [];
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const errors: string[] = [];

    for (const check of checks) {
      try {
        const { status, text } = await fetchText(check.url);
        const error = check.test(text, status);
        if (error) errors.push(`${check.name}: ${error}`);
      } catch (error) {
        errors.push(
          `${check.name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    if (errors.length === 0) {
      console.log(`✅ Élő smoke test sikeres (${attempt}. próba).`);
      return;
    }

    lastErrors = errors;
    if (attempt < 6) {
      console.log(`⏳ ${attempt}. próba nem sikerült, 5 mp múlva újra...`);
      await sleep(5000);
    }
  }

  console.error('❌ Élő smoke test sikertelen:');
  for (const error of lastErrors) console.error(`- ${error}`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
