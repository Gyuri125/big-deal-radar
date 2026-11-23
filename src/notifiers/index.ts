import { logger } from '../utils/logger';
import type { Digest } from '../pipeline/digest';
import { isDiscordConfigured, isTelegramConfigured } from '../config';
import { sendDiscordDigest, sendDiscordError, sendDiscordTest } from './discord';
import { sendTelegramDigest, sendTelegramTest } from './telegram';

export interface NotifyOptions {
  discord?: boolean;
  telegram?: boolean;
}

export type ChannelResult = 'sent' | 'skipped' | 'failed';

export interface NotifyResult {
  discord: ChannelResult;
  telegram: ChannelResult;
  configured: boolean;
  anySent: boolean;
}

export async function notifyDigest(
  digest: Digest,
  options: NotifyOptions = {}
): Promise<NotifyResult> {
  const discordEnabled =
    options.discord !== false && isDiscordConfigured();
  const telegramEnabled =
    options.telegram !== false && isTelegramConfigured();

  const results = await Promise.allSettled([
    discordEnabled ? sendDiscordDigest(digest) : Promise.resolve(),
    telegramEnabled ? sendTelegramDigest(digest) : Promise.resolve(),
  ]);

  if (results[0].status === 'rejected') {
    logger.error('Discord digest hiba', results[0].reason);
  }
  if (results[1].status === 'rejected') {
    logger.error('Telegram digest hiba', results[1].reason);
  }

  const discord: ChannelResult = !discordEnabled
    ? 'skipped'
    : results[0].status === 'fulfilled'
      ? 'sent'
      : 'failed';
  const telegram: ChannelResult = !telegramEnabled
    ? 'skipped'
    : results[1].status === 'fulfilled'
      ? 'sent'
      : 'failed';

  return {
    discord,
    telegram,
    configured: isDiscordConfigured() || isTelegramConfigured(),
    anySent: discord === 'sent' || telegram === 'sent',
  };
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
