import 'dotenv/config';
import { z } from 'zod';

const optionalString = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  z.string().optional()
);

const optionalUrl = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  z.string().url().optional()
);

const schema = z.object({
  DISCORD_WEBHOOK_URL: optionalUrl,
  TELEGRAM_BOT_TOKEN: optionalString,
  TELEGRAM_CHAT_ID: optionalString,
  SITE_URL: optionalUrl,
  TZ: z.string().default('Europe/Budapest'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type AppConfig = z.infer<typeof schema>;

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Hibás környezeti változó:\n${details}`);
  }

  cached = parsed.data;
  return cached;
}

export function isDiscordConfigured(config = getConfig()): boolean {
  return Boolean(config.DISCORD_WEBHOOK_URL);
}

export function isTelegramConfigured(config = getConfig()): boolean {
  return Boolean(config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_CHAT_ID);
}

export function getSiteUrl(config = getConfig()): string {
  return config.SITE_URL ?? 'https://example.github.io/big-deal-radar/';
}
