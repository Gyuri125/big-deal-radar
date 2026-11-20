import fs from 'node:fs';
import path from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function configuredLevel(): LogLevel {
  const rawLevel = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  return rawLevel in LEVELS ? (rawLevel as LogLevel) : 'info';
}

const logDir = path.resolve(process.cwd(), 'logs');
const logFile = path.join(
  logDir,
  `daily-${new Date().toISOString().slice(0, 10)}.log`
);

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[configuredLevel()];
}

function writeToFile(line: string): void {
  if (process.env.VITEST) return;
  if (process.env.LOG_TO_FILE === '0') return;

  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(logFile, `${line}\n`, 'utf8');
  } catch {
    // A logírás hibája ne borítsa a pipeline-t.
  }
}

function formatMeta(meta: unknown): string {
  if (meta === undefined) return '';
  if (meta instanceof Error) {
    return ` ${meta.name}: ${meta.message}`;
  }
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return '';
  }
}

function log(level: LogLevel, message: string, meta?: unknown): void {
  if (!shouldLog(level)) return;

  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${level.toUpperCase().padEnd(5)} ${message}${formatMeta(meta)}`;

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }

  writeToFile(line);
}

export const logger = {
  debug: (message: string, meta?: unknown) => log('debug', message, meta),
  info: (message: string, meta?: unknown) => log('info', message, meta),
  warn: (message: string, meta?: unknown) => log('warn', message, meta),
  error: (message: string, meta?: unknown) => log('error', message, meta),
};
