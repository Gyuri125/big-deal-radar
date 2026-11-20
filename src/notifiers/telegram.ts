import { getConfig, isTelegramConfigured, getSiteUrl } from '../config';
import { logger } from '../utils/logger';
import type { Digest } from '../pipeline/digest';
import { toPlainText } from '../pipeline/digest';

const MAX_LENGTH = 3900;

function splitMessage(text: string): string[] {
  if (text.length <= MAX_LENGTH) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > MAX_LENGTH) {
    const slice = remaining.slice(0, MAX_LENGTH);
    const breakAt = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf(' '));
    const cut = breakAt > 0 ? breakAt : MAX_LENGTH;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

async function sendMessage(text: string): Promise<void> {
  const config = getConfig();

  if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHAT_ID) {
    logger.warn(
      'Telegram nincs beállítva – ez a csatorna egyelőre placeholder.'
    );
    return;
  }

  const url = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`;

  for (const chunk of splitMessage(text)) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.TELEGRAM_CHAT_ID,
        text: chunk,
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Telegram hiba: HTTP ${response.status} – ${body.slice(0, 300)}`
      );
    }
  }

  logger.info('Telegram értesítés elküldve.');
}

export async function sendTelegramDigest(digest: Digest): Promise<void> {
  if (!isTelegramConfigured()) {
    logger.warn('Telegram nincs beállítva – digest kihagyva.');
    return;
  }

  await sendMessage(toPlainText(digest, getSiteUrl()));
}

export async function sendTelegramTest(): Promise<void> {
  if (!isTelegramConfigured()) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN vagy TELEGRAM_CHAT_ID nincs beállítva. A Telegram egyelőre opcionális.'
    );
  }

  await sendMessage(
    '✅ Big-deal radar teszt – a Telegram csatorna működik.\n\nA napi digest innentől automatikusan mehet.'
  );
}
