import { logger } from '../utils/logger';
import type { Digest } from '../pipeline/digest';
import { sendDiscordDigest, sendDiscordError, sendDiscordTest } from './discord';
import { sendTelegramDigest, sendTelegramTest } from './telegram';

export interface NotifyOptions {
  discord?: boolean;
  telegram?: boolean;
}

export async function notifyDigest(
  digest: Digest,
  options: NotifyOptions = {}
): Promise<void> {
  const results = await Promise.allSettled([
    options.discord === false
      ? Promise.resolve()
      : sendDiscordDigest(digest),
    options.telegram === false
      ? Promise.resolve()
      : sendTelegramDigest(digest),
  ]);

  for (const result of results) {
    if (result.status === 'rejected') {
      logger.error('Értesítési hiba', result.reason);
    }
  }
}

export async function notifyError(
  error: unknown,
  context: Record<string, string> = {},
  options: NotifyOptions = {}
): Promise<void> {
  const results = await Promise.allSettled([
    options.discord === false
      ? Promise.resolve()
      : sendDiscordError(error, context),
  ]);

  for (const result of results) {
    if (result.status === 'rejected') {
      logger.error('Hibaértesítés küldése is sikertelen', result.reason);
    }
  }
}

export async function notifyTest(): Promise<void> {
  await Promise.allSettled([sendDiscordTest(), sendTelegramTest()]);
}
