import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { getConfig, isDiscordConfigured, isTelegramConfigured } from './config';
import { buildDigest, digestSummary, TYPE_LABELS } from './pipeline/digest';
import { loadDeals, summarize } from './pipeline/load';
import { notifyDigest, notifyError } from './notifiers';
import { sendDiscordTest } from './notifiers/discord';
import { sendTelegramTest } from './notifiers/telegram';
import { logger } from './utils/logger';

interface Flags {
  dryRun: boolean;
  verbose: boolean;
  noNotify: boolean;
  noBuild: boolean;
  commit: boolean;
  ci: boolean;
  forceNotify: boolean;
}

function parseFlags(args: string[]): Flags {
  const set = new Set(args.filter((arg) => arg.startsWith('--')));
  return {
    dryRun: set.has('--dry-run'),
    verbose: set.has('--verbose'),
    noNotify: set.has('--no-notify'),
    noBuild: set.has('--no-build'),
    commit: set.has('--commit'),
    ci: set.has('--ci'),
    forceNotify: set.has('--force-notify'),
  };
}

function shouldNotify(
  digest: ReturnType<typeof buildDigest>,
  now: Date,
  force: boolean
): boolean {
  if (force) return true;
  if (now.getHours() < 10) return true;
  if (digest.booking.length > 0) return true;
  return digest.upcoming.some(
    (item) => item.days !== null && item.days >= 0 && item.days <= 3
  );
}

function writeStatusFile(params: {
  now: Date;
  source: string;
  counts: Record<string, number>;
  errors: string[];
}): void {
  const status = {
    generated_at: params.now.toISOString(),
    last_run: params.now.toISOString(),
    source: params.source,
    counts: params.counts,
    errors: params.errors,
  };

  const publicDir = path.resolve(process.cwd(), 'public');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(
    path.join(publicDir, 'status.json'),
    `${JSON.stringify(status, null, 2)}\n`,
    'utf8'
  );

  const dataDir = path.resolve(process.cwd(), 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, 'state.json'),
    `${JSON.stringify(status, null, 2)}\n`,
    'utf8'
  );
}

function runBuild(): void {
  logger.info('Site build indítása...');
  execSync('npm run build', { stdio: 'inherit', cwd: process.cwd() });
  logger.info('Site build kész.');
}

function hasDataChanges(): boolean {
  try {
    const out = execSync('git status --porcelain data/', {
      encoding: 'utf8',
      cwd: process.cwd(),
    });
    return out.trim().length > 0;
  } catch (error) {
    throw new Error(
      `Nem tudom olvasni a git állapotot. Git repo-e a mappa? Eredeti hiba: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function commitAndPush(): void {
  if (!hasDataChanges()) {
    logger.info('Nincs adatváltozás – commit kihagyva.');
    return;
  }

  try {
    const remote = execSync('git remote get-url origin', {
      encoding: 'utf8',
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    if (!remote) {
      throw new Error('nincs origin remote');
    }
  } catch {
    throw new Error(
      'Nincs beállítva git remote (origin). Előbb hozd létre a GitHub repót, majd: git remote add origin <url>'
    );
  }

  const date = new Date().toISOString().slice(0, 10);
  logger.info('Adatváltozás található – commit és push...');

  try {
    execSync('git add data/', { stdio: 'inherit', cwd: process.cwd() });
    execSync(`git commit -m "chore(data): napi frissítés ${date}"`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    execSync('git push', { stdio: 'inherit', cwd: process.cwd() });
  } catch (error) {
    throw new Error(
      `A commit/push nem sikerült. Ellenőrizd a git beállításokat és a jogosultságot. Eredeti hiba: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  logger.info('Adatváltozás felpusholva.');
}

async function daily(flags: Flags): Promise<void> {
  const now = new Date();
  const source = flags.ci || process.env.CI ? 'github-actions' : 'local';

  logger.info(`Napi radar indul (${source}).`);

  const { deals } = loadDeals();
  const summary = summarize(deals);
  const digest = buildDigest(deals, now);

  logger.info(
    `Adatok: ${summary.total} deal, ${summary.verified} ellenőrzött, ${summary.dated} dátumos.`
  );
  logger.info(`Digest: ${digestSummary(digest)}`);

  for (const [type, count] of Object.entries(summary.byType)) {
    logger.debug(`${TYPE_LABELS[type as keyof typeof TYPE_LABELS] ?? type}: ${count}`);
  }

  if (digest.upcoming.length > 0) {
    for (const item of digest.upcoming) {
      const when =
        item.days !== null && item.days < 0
          ? 'folyamatban'
          : `${item.days} nap`;
      logger.info(`Következő: ${item.deal.title} – ${item.dateLabel} (${when})`);
    }
  } else {
    logger.info('Nincs pontos dátumos esemény a következő 7 napban.');
  }

  if (!flags.dryRun) {
    writeStatusFile({
      now,
      source,
      counts: {
        total: summary.total,
        verified: summary.verified,
        dated: summary.dated,
        featured: summary.featured,
        upcoming7: digest.counts.upcoming,
        month: digest.counts.month,
        booking: digest.counts.booking,
        money: digest.counts.money,
      },
      errors: [],
    });
  }

  if (flags.dryRun) {
    logger.info('Dry-run: értesítés, build és commit kihagyva.');
    return;
  }

  if (!flags.noNotify) {
    if (shouldNotify(digest, now, flags.forceNotify)) {
      await notifyDigest(digest);
    } else {
      logger.info(
        'Nincs 3 napon belüli esemény vagy foglalásnyitás – csendes futás, értesítés kihagyva.'
      );
    }
  } else {
    logger.info('Értesítés kihagyva (--no-notify).');
  }

  if (!flags.noBuild) {
    runBuild();
  } else {
    logger.info('Build kihagyva (--no-build).');
  }

  if (flags.commit && !flags.ci) {
    commitAndPush();
  }
}

async function validate(): Promise<void> {
  const { deals, filePath } = loadDeals();
  const summary = summarize(deals);

  logger.info(`Adatfájl: ${path.relative(process.cwd(), filePath)}`);
  logger.info(`Összes deal: ${summary.total}`);
  logger.info(`Ellenőrzött: ${summary.verified}`);
  logger.info(`Dátumos: ${summary.dated}`);
  logger.info(`Kiemelt: ${summary.featured}`);
  logger.info(`Típusok: ${JSON.stringify(summary.byType)}`);

  const missingDates = deals.filter((deal) => !deal.date_start).length;
  if (missingDates > 0) {
    logger.warn(
      `${missingDates} dealnek nincs pontos dátuma – ez a havi/rugalmas listába kerül.`
    );
  }

  logger.info('✅ Az adatbázis érvényes.');
}

function check(label: string, ok: boolean, detail: string): boolean {
  const icon = ok ? '✅' : '⚠️';
  console.log(`${icon} ${label}: ${detail}`);
  return ok;
}

async function doctor(): Promise<void> {
  console.log('\n🩺 Big-deal radar – önellenőrzés\n');

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  check('Node.js', nodeMajor >= 20, process.version);
  check('npm', true, process.env.npm_config_user_agent ?? 'elérhető');

  const envExists = fs.existsSync(path.resolve(process.cwd(), '.env'));
  check('Helyi .env', envExists, envExists ? 'megvan' : 'hiányzik (nem kötelező, de Discordhoz kell)');

  const config = getConfig();
  const discordOk = isDiscordConfigured(config);
  check(
    'Discord webhook',
    discordOk,
    discordOk ? 'beállítva' : 'nincs beállítva – a digest nem megy ki'
  );

  if (config.DISCORD_WEBHOOK_URL) {
    const validDiscord =
      config.DISCORD_WEBHOOK_URL.startsWith('https://discord.com/api/webhooks/') ||
      config.DISCORD_WEBHOOK_URL.startsWith('https://discordapp.com/api/webhooks/');
    check('Discord URL formátum', validDiscord, validDiscord ? 'rendben' : 'gyanús');
  }

  const telegramOk = isTelegramConfigured(config);
  check(
    'Telegram',
    telegramOk,
    telegramOk ? 'beállítva' : 'placeholder – opcionális'
  );

  try {
    const { deals } = loadDeals();
    const summary = summarize(deals);
    check(
      'Adatbázis',
      true,
      `${summary.total} deal, ${summary.verified} ellenőrzött, ${summary.dated} dátumos`
    );
  } catch (error) {
    check(
      'Adatbázis',
      false,
      error instanceof Error ? error.message.split('\n')[0] : String(error)
    );
  }

  try {
    const inside = execSync('git rev-parse --is-inside-work-tree', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    check('Git repo', inside === 'true', inside === 'true' ? 'igen' : 'nem');

    const remote = execSync('git remote get-url origin', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    check('Git remote', Boolean(remote), remote || 'nincs origin');
  } catch {
    check('Git repo', false, 'nem git repo – a commit/push nem fog működni');
  }

  const statusExists = fs.existsSync(path.resolve(process.cwd(), 'public/status.json'));
  check(
    'Státuszfájl',
    statusExists,
    statusExists ? 'megvan' : 'még nincs – a daily futás generálja'
  );

  console.log('\nKövetkező lépés: npm run daily -- --dry-run --verbose\n');
}

async function testNotify(): Promise<void> {
  const config = getConfig();
  const results: Array<{ name: string; ok: boolean; error?: string }> = [];

  if (isDiscordConfigured(config)) {
    try {
      await sendDiscordTest();
      results.push({ name: 'Discord', ok: true });
    } catch (error) {
      results.push({
        name: 'Discord',
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    results.push({ name: 'Discord', ok: false, error: 'nincs beállítva' });
  }

  if (isTelegramConfigured(config)) {
    try {
      await sendTelegramTest();
      results.push({ name: 'Telegram', ok: true });
    } catch (error) {
      results.push({
        name: 'Telegram',
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    results.push({ name: 'Telegram', ok: false, error: 'nincs beállítva (opcionális)' });
  }

  for (const result of results) {
    console.log(
      `${result.ok ? '✅' : '❌'} ${result.name}: ${
        result.ok ? 'elküldve' : result.error
      }`
    );
  }

  if (results.every((result) => !result.ok)) {
    throw new Error('Egyik értesítési csatorna sem működött.');
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'daily';
  const flags = parseFlags(args.slice(1));

  if (flags.verbose) {
    process.env.LOG_LEVEL = 'debug';
  }

  switch (command) {
    case 'daily':
      await daily(flags);
      break;
    case 'validate':
      await validate();
      break;
    case 'doctor':
      await doctor();
      break;
    case 'test-notify':
      await testNotify();
      break;
    default:
      console.error(
        `Ismeretlen parancs: ${command}\nHasználat: daily | validate | doctor | test-notify`
      );
      process.exitCode = 1;
  }
}

main().catch(async (error) => {
  logger.error('A futás hibával állt le.', error);

  if (!process.argv.includes('--no-notify')) {
    await notifyError(error, {
      command: process.argv[2] ?? 'daily',
      source: process.env.CI ? 'github-actions' : 'local',
    });
  }

  process.exitCode = 1;
});
