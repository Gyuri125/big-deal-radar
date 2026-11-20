import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'logs',
  'coverage',
  '.vite',
  '.cache',
]);
const IGNORED_FILES = new Set([
  '.env.example',
  'README.md',
  'package-lock.json',
]);
const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.html',
  '.css',
  '.ps1',
  '.txt',
  '.example',
]);

const PATTERNS: Array<{ name: string; regex: RegExp }> = [
  {
    name: 'Discord webhook',
    regex: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d{6,}\/[\w-]{20,}/g,
  },
  {
    name: 'Telegram bot token',
    regex: /\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/g,
  },
];

function listFiles(): string[] {
  try {
    const out = execSync('git ls-files', {
      encoding: 'utf8',
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .split(/\r?\n/)
      .map((file) => file.trim())
      .filter(Boolean)
      .map((file) => path.resolve(ROOT, file));
  } catch {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.has(entry.name)) walk(path.join(dir, entry.name));
          continue;
        }
        files.push(path.join(dir, entry.name));
      }
    };
    walk(ROOT);
    return files;
  }
}

function isTextFile(file: string): boolean {
  const ext = path.extname(file).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || path.basename(file).startsWith('.env');
}

function loadEnvValues(): string[] {
  const envPath = path.resolve(ROOT, '.env');
  if (!fs.existsSync(envPath)) return [];

  const values: string[] = [];
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (!match) continue;
    const [, key, value] = match;
    if (!/TOKEN|WEBHOOK|SECRET|KEY|PASSWORD/i.test(key)) continue;
    if (value.length < 12) continue;
    values.push(value.replace(/^["']|["']$/g, ''));
  }
  return values;
}

function main(): void {
  const files = listFiles();
  const envValues = loadEnvValues();
  const findings: string[] = [];

  for (const file of files) {
    const base = path.basename(file);
    if (IGNORED_FILES.has(base)) continue;
    if (!isTextFile(file)) continue;

    let content: string;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    for (const pattern of PATTERNS) {
      for (const match of content.matchAll(pattern.regex)) {
        const line = content.slice(0, match.index ?? 0).split(/\r?\n/).length;
        findings.push(
          `${path.relative(ROOT, file)}:${line} – ${pattern.name}`
        );
      }
    }

    for (const value of envValues) {
      if (content.includes(value)) {
        findings.push(
          `${path.relative(ROOT, file)} – a .env egyik titka szerepel a fájlban`
        );
      }
    }
  }

  if (findings.length > 0) {
    console.error('\n❌ Titokszivárgás-gyanú:\n');
    for (const finding of [...new Set(findings)]) {
      console.error(`  - ${finding}`);
    }
    console.error(
      '\nTávolítsd el a titkokat, és csak GitHub Secrets / .env használatával dolgozz.\n'
    );
    process.exitCode = 1;
    return;
  }

  console.log(`✅ Nem találtam titkot ${files.length} fájlban.`);
}

main();
