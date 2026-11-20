import { getConfig, isDiscordConfigured, getSiteUrl } from '../config';
import { logger } from '../utils/logger';
import type { DiscordEmbed, Digest } from '../pipeline/digest';
import { toDiscordEmbeds } from '../pipeline/digest';

interface DiscordPayload {
  username?: string;
  content?: string;
  embeds: DiscordEmbed[];
}

async function post(payload: DiscordPayload, attempt = 0): Promise<void> {
  const config = getConfig();

  if (!config.DISCORD_WEBHOOK_URL) {
    logger.warn('Discord webhook nincs beállítva – értesítés kihagyva.');
    return;
  }

  const response = await fetch(config.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (response.status === 429 && attempt === 0) {
    const body = (await response.json().catch(() => ({}))) as {
      retry_after?: number;
    };
    const waitMs = Math.min((body.retry_after ?? 1) * 1000, 10_000);
    logger.warn(`Discord rate limit – várakozás ${Math.round(waitMs / 1000)} mp.`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return post(payload, 1);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Discord hiba: HTTP ${response.status} – ${text.slice(0, 300)}`
    );
  }

  logger.info('Discord értesítés elküldve.');
}

export async function sendDiscordDigest(digest: Digest): Promise<void> {
  if (!isDiscordConfigured()) {
    logger.warn('Discord nincs beállítva – digest kihagyva.');
    return;
  }

  const embeds = toDiscordEmbeds(digest, getSiteUrl());
  await post({
    username: 'Big-deal radar',
    content: 'Napi radar – a legjobb magyar dealek.',
    embeds,
  });
}

export async function sendDiscordError(
  error: unknown,
  context: Record<string, string> = {}
): Promise<void> {
  if (!isDiscordConfigured()) {
    logger.warn('Discord nincs beállítva – hibaértesítés kihagyva.');
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  await post({
    username: 'Big-deal radar',
    embeds: [
      {
        title: '❌ Hiba a radar futásában',
        description: message.slice(0, 1500),
        color: 0xef4444,
        fields: [
          ...Object.entries(context).map(([key, value]) => ({
            name: key,
            value: String(value).slice(0, 1024),
            inline: true,
          })),
          ...(stack
            ? [
                {
                  name: 'Stack',
                  value: `\`\`\`${stack.slice(0, 900)}\`\`\``,
                  inline: false,
                },
              ]
            : []),
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

export async function sendDiscordTest(): Promise<void> {
  if (!isDiscordConfigured()) {
    throw new Error(
      'DISCORD_WEBHOOK_URL nincs beállítva. Másold a .env.example-t .env-re, és töltsd ki.'
    );
  }

  await post({
    username: 'Big-deal radar',
    content: '✅ Teszt értesítés – a Discord webhook működik.',
    embeds: [
      {
        title: 'Big-deal radar teszt',
        description:
          'Ha ezt látod, a webhook jó. A napi digest innentől automatikusan mehet.',
        color: 0x0f9d8a,
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
