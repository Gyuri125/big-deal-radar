import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type { Deal } from '../src/types';
import {
  effectiveDateLabel,
  nextOccurrence,
  formatHuf,
  formatHuDate,
  parseISODate,
  toISODate,
} from '../src/utils/dates';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const dealsPath = path.join(root, 'data', 'deals.json');
const siteUrl = (
  process.env.SITE_URL ?? 'https://gyuri125.github.io/big-deal-radar/'
).replace(/\/?$/, '/');

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return map[char] ?? char;
  });
}

function escapeXml(value: string): string {
  return escapeHtml(value);
}

function priceLabel(deal: Deal): string {
  if (deal.type === 'free' || deal.deal_price === 0) return 'Ingyenes';
  if (deal.deal_price !== null) return formatHuf(deal.deal_price);
  return 'Ár a forrásban';
}

function normalPriceLabel(deal: Deal): string {
  if (deal.normal_price !== null) return `Normál ár: ${formatHuf(deal.normal_price)}`;
  return '';
}

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = next;
    }
  }

  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

function ogSvg(deal: Deal, dateLabel: string): string {
  const lines = wrapText(deal.title, 28, 3);
  const fontSize = lines.length >= 3 ? 54 : 66;
  const lineHeight = Math.round(fontSize * 1.12);
  const title = lines
    .map(
      (line, index) =>
        `<tspan x="80" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`
    )
    .join('');
  const typeLabel =
    deal.type === 'flat'
      ? '★ PRÉMIUM UGYANANNYI'
      : deal.type === 'free'
        ? 'INGYENES'
        : deal.type === 'money'
          ? 'PÉNZÜGY'
          : deal.type === 'sale'
            ? 'AKCIÓ'
            : 'KÜLÖNLEGES HOZZÁFÉRÉS';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="bg" cx="12%" cy="0%" r="90%">
      <stop offset="0%" stop-color="#29465d"/>
      <stop offset="55%" stop-color="#12212f"/>
      <stop offset="100%" stop-color="#0c1722"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f26b38" stop-opacity=".35"/>
      <stop offset="100%" stop-color="#f26b38" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="980" cy="120" r="260" fill="url(#glow)"/>
  <g fill="none" stroke="#f6f1e7" opacity=".12">
    <circle cx="1030" cy="110" r="190" stroke-width="2"/>
    <circle cx="1030" cy="110" r="130" stroke-width="2"/>
    <circle cx="1030" cy="110" r="70" stroke-width="2"/>
  </g>
  <circle cx="1030" cy="110" r="9" fill="#f26b38"/>
  <text x="80" y="92" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="5" fill="#f6f1e7" opacity=".72">BIG-DEAL RADAR</text>
  <text x="80" y="150" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" font-weight="700" letter-spacing="3" fill="#ffb28f">${escapeXml(typeLabel)}</text>
  <text x="80" y="250" font-family="DejaVu Sans, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#fffdf8">${title}</text>
  <text x="80" y="520" font-family="DejaVu Sans, Arial, sans-serif" font-size="30" fill="#f6f1e7" opacity=".82">${escapeXml(dateLabel)}</text>
  <text x="80" y="575" font-family="DejaVu Sans, Arial, sans-serif" font-size="40" font-weight="700" fill="#ffb28f">${escapeXml(priceLabel(deal))}</text>
  <text x="1120" y="575" text-anchor="end" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#f6f1e7" opacity=".48">gyuri125.github.io/big-deal-radar</text>
</svg>`;
}

function iconSvg(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#12212f"/>
  <circle cx="32" cy="32" r="22" fill="none" stroke="#f6f1e7" stroke-width="2" opacity=".55"/>
  <circle cx="32" cy="32" r="14" fill="none" stroke="#f6f1e7" stroke-width="2" opacity=".7"/>
  <circle cx="32" cy="32" r="6" fill="none" stroke="#f6f1e7" stroke-width="2" opacity=".85"/>
  <circle cx="32" cy="32" r="3.2" fill="#f26b38"/>
  <path d="M32 32 L49 20" stroke="#f26b38" stroke-width="2" stroke-linecap="round"/>
</svg>`;
}

function pageCss(): string {
  return `
    :root{--navy:#12212f;--cream:#f6f1e7;--paper:#fffdf8;--line:#e5ded2;--orange:#f26b38;--teal:#0f8f7e;--gold:#c9941a;--muted:#667085}
    *{box-sizing:border-box}body{margin:0;font-family:Inter,"Segoe UI",system-ui,sans-serif;color:#1c2530;background:radial-gradient(circle at 10% 0%,rgba(242,107,56,.1),transparent 28rem),var(--cream);line-height:1.55}
    a{color:inherit}.wrap{max-width:820px;margin:0 auto;padding:24px}.top{display:flex;align-items:center;justify-content:space-between;padding:16px 0;border-bottom:1px solid var(--line)}
    .brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-size:.72rem;font-weight:800;letter-spacing:.18em;line-height:1.05}
    .mark{display:grid;place-items:center;width:34px;height:34px;border:2px solid var(--navy);border-radius:50%;position:relative}.mark:before,.mark:after{content:"";position:absolute;border:1.5px solid var(--navy);border-radius:50%;opacity:.55}.mark:before{inset:7px}.mark:after{inset:13px}
    .dot{position:absolute;width:5px;height:5px;border-radius:50%;background:var(--orange)}
    .back{font-size:.78rem;font-weight:700;color:var(--muted);text-decoration:none}
    .hero{margin-top:28px;padding:32px;border:1px solid var(--line);border-top:5px solid var(--orange);border-radius:24px;background:var(--paper);box-shadow:0 18px 50px rgba(18,33,47,.08)}
    .badge{display:inline-flex;padding:4px 10px;border-radius:999px;background:#fff0e8;color:#b5471d;font-size:.66rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
    h1{margin:14px 0 0;font-family:Georgia,serif;font-size:clamp(2rem,6vw,3.5rem);line-height:1.02;letter-spacing:-.03em;color:var(--navy)}
    .meta{margin:14px 0 0;font-size:.85rem;font-weight:700;color:#b5471d}
    .lead{margin:16px 0 0;font-size:1.02rem;color:#475467}
    .price{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-top:22px;padding-top:18px;border-top:1px dashed var(--line)}
    .old{font-size:.9rem;color:var(--muted);text-decoration:line-through}.new{font-size:1.7rem;font-weight:800;color:var(--navy)}.free{font-size:1.3rem;font-weight:800;color:#08685c}
    .note{margin:18px 0 0;padding:12px 14px;border-left:3px solid var(--gold);border-radius:8px;background:#fff6d9;font-size:.82rem;color:#6f5310}
    .booking-note{margin:12px 0 0;padding:12px 14px;border-left:3px solid var(--teal);border-radius:8px;background:#e7f6f3;font-size:.82rem;color:#25564e}
    .actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}
    .btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border:1px solid transparent;border-radius:999px;font-size:.88rem;font-weight:700;text-decoration:none;cursor:pointer}
    .btn-primary{background:var(--navy);color:var(--paper)}.btn-ghost{background:transparent;border-color:var(--line);color:var(--navy)}
    h2{margin:28px 0 10px;font-family:Georgia,serif;font-size:1.4rem;font-weight:500;color:var(--navy)}
    .sources{display:grid;gap:8px}.source{display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--paper);text-decoration:none}
    .source b{font-size:.8rem}.source span{margin-left:auto;font-size:.7rem;color:var(--muted)}
    .footer{margin:36px 0 20px;color:var(--muted);font-size:.74rem;text-align:center}
    .footer a{color:var(--navy);font-weight:700}
    @media(max-width:600px){.wrap{padding:18px}.hero{padding:22px}.top{flex-direction:column;align-items:flex-start;gap:10px}}
  `;
}

function sourceTypeLabel(type: Deal['sources'][number]['type']): string {
  if (type === 'official') return 'Hivatalos';
  if (type === 'ticket') return 'Jegy';
  if (type === 'article') return 'Cikk';
  return 'Keresés';
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function buildDealPage(deal: Deal): string {
  const effective = nextOccurrence(deal);
  const dateLabel = effectiveDateLabel(deal, effective);
  const checked = deal.last_checked
    ? ` · Ellenőrizve: ${formatHuDate(parseISODate(deal.last_checked))}`
    : '';
  const booking = deal.booking_url
    ? `<a class="btn btn-primary" href="${escapeHtml(deal.booking_url)}" target="_blank" rel="noopener">Jegyvásárlás / foglalás</a>`
    : '';
  const radarLink = `../../?deal=${encodeURIComponent(deal.id)}`;
  const reportUrl = `https://github.com/Gyuri125/big-deal-radar/issues/new?title=${encodeURIComponent(
    `Hiba: ${deal.title}`
  )}&body=${encodeURIComponent(
    `Deal: ${deal.title}\nOldal: ${siteUrl}deal/${deal.id}/\n\nMit tapasztaltál?\n- Hibás ár:\n- Halott link:\n- Hibás dátum:\n`
  )}`;
  const sources = deal.sources
    .map(
      (source) =>
        `<a class="source" href="${escapeHtml(source.url)}" target="_blank" rel="noopener"><b>${escapeHtml(source.label)}</b><span>${sourceTypeLabel(source.type)} · ${escapeHtml(domainOf(source.url))}</span></a>`
    )
    .join('');

  const jsonLd = effective
    ? {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: deal.title,
        startDate: toISODate(effective.start),
        endDate: toISODate(effective.end ?? effective.start),
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        description: deal.deal,
        image: `${siteUrl}og/${deal.id}.png`,
        url: `${siteUrl}deal/${deal.id}/`,
        location: {
          '@type': 'Place',
          name: deal.location,
          address: {
            '@type': 'PostalAddress',
            addressLocality: deal.location,
            addressCountry: 'HU',
          },
        },
        offers: {
          '@type': 'Offer',
          price: deal.deal_price ?? 0,
          priceCurrency: 'HUF',
          availability: 'https://schema.org/InStock',
          url: deal.booking_url ?? deal.source_url ?? `${siteUrl}deal/${deal.id}/`,
        },
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: deal.title,
        description: deal.deal,
        url: `${siteUrl}deal/${deal.id}/`,
        isPartOf: {
          '@type': 'WebSite',
          name: 'Big-deal radar',
          url: siteUrl,
        },
      };

  return `<!doctype html>
<html lang="hu">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="theme-color" content="#12212f"/>
  <link rel="icon" type="image/svg+xml" href="../../favicon.svg"/>
  <title>${escapeHtml(deal.title)} – Big-deal radar</title>
  <meta name="description" content="${escapeHtml(`${deal.deal} ${dateLabel} · ${deal.location}`)}"/>
  <link rel="canonical" href="${escapeHtml(`${siteUrl}deal/${deal.id}/`)}"/>
  <meta property="og:type" content="article"/>
  <meta property="og:site_name" content="Big-deal radar"/>
  <meta property="og:title" content="${escapeHtml(deal.title)}"/>
  <meta property="og:description" content="${escapeHtml(`${deal.deal} ${dateLabel} · ${deal.location}`)}"/>
  <meta property="og:url" content="${escapeHtml(`${siteUrl}deal/${deal.id}/`)}"/>
  <meta property="og:image" content="${escapeHtml(`${siteUrl}og/${deal.id}.png`)}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${escapeHtml(deal.title)}"/>
  <meta name="twitter:description" content="${escapeHtml(deal.deal)}"/>
  <meta name="twitter:image" content="${escapeHtml(`${siteUrl}og/${deal.id}.png`)}"/>
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
  <style>${pageCss()}</style>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <a class="brand" href="../../"><span class="mark"><span class="dot"></span></span><span>BIG-DEAL<br/>RADAR</span></a>
      <a class="back" href="../../">← Vissza a radarhoz</a>
    </header>

    <main class="hero">
      <span class="badge">${deal.type === 'flat' ? '★ Prémium ugyanannyi' : deal.type === 'free' ? 'Ingyenes' : deal.type === 'money' ? 'Pénzügy' : deal.type === 'sale' ? 'Akció' : 'Különleges hozzáférés'}</span>
      <h1>${escapeHtml(deal.title)}</h1>
      <p class="meta">${escapeHtml(dateLabel)} · ${escapeHtml(deal.location)}${escapeHtml(checked)}</p>
      <p class="lead">${escapeHtml(deal.deal)}</p>

      <div class="price">
        ${deal.normal_price !== null ? `<span class="old">${escapeHtml(normalPriceLabel(deal).replace('Normál ár: ', ''))}</span>` : ''}
        <span class="${deal.type === 'free' || deal.deal_price === 0 ? 'free' : 'new'}">${escapeHtml(priceLabel(deal))}</span>
        ${deal.price_note ? `<span style="font-size:.78rem;color:#667085">${escapeHtml(deal.price_note)}</span>` : ''}
      </div>

      ${deal.booking_note ? `<p class="booking-note"><strong>Jegyvásárlás:</strong> ${escapeHtml(deal.booking_note)}</p>` : ''}
      ${deal.notes ? `<p class="note">${escapeHtml(deal.notes)}</p>` : ''}

      <div class="actions">
        <a class="btn btn-primary" href="${radarLink}">Megnyitás a radarom</a>
        ${booking}
      </div>

      <h2>Források</h2>
      <div class="sources">${sources}</div>
    </main>

    <footer class="footer">
      <p>Big-deal radar · <a href="../../">a teljes lista</a> · <a href="${reportUrl}" target="_blank" rel="noopener">Hibát jelentek</a></p>
      <p>Az adatok évente változnak, ellenőrizd a hivatalos forráson.</p>
    </footer>
  </div>
</body>
</html>`;
}

async function main(): Promise<void> {
  if (!fs.existsSync(dealsPath)) {
    throw new Error('Nincs data/deals.json – futtasd: npm run import');
  }

  const deals = JSON.parse(fs.readFileSync(dealsPath, 'utf8')) as Deal[];
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(path.join(distDir, 'og'), { recursive: true });

  for (const deal of deals) {
    const effective = nextOccurrence(deal);
    const dateLabel = effectiveDateLabel(deal, effective);
    const pageDir = path.join(distDir, 'deal', deal.id);
    fs.mkdirSync(pageDir, { recursive: true });
    fs.writeFileSync(path.join(pageDir, 'index.html'), buildDealPage(deal), 'utf8');

    const svg = ogSvg(deal, dateLabel);
    await sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(distDir, 'og', `${deal.id}.png`));
  }

  const siteTitle = 'A legjobb magyar dealek, időben elkapva.';
  const siteSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs><radialGradient id="bg" cx="12%" cy="0%" r="90%"><stop offset="0%" stop-color="#29465d"/><stop offset="55%" stop-color="#12212f"/><stop offset="100%" stop-color="#0c1722"/></radialGradient></defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <g fill="none" stroke="#f6f1e7" opacity=".12"><circle cx="1030" cy="110" r="190" stroke-width="2"/><circle cx="1030" cy="110" r="130" stroke-width="2"/><circle cx="1030" cy="110" r="70" stroke-width="2"/></g>
    <circle cx="1030" cy="110" r="9" fill="#f26b38"/>
    <text x="80" y="92" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="5" fill="#f6f1e7" opacity=".72">BIG-DEAL RADAR</text>
    <text x="80" y="230" font-family="DejaVu Sans, Arial, sans-serif" font-size="64" font-weight="700" fill="#fffdf8">${escapeXml(siteTitle)}</text>
    <text x="80" y="320" font-family="DejaVu Sans, Arial, sans-serif" font-size="28" fill="#f6f1e7" opacity=".7">100+ magyar deal · napi digest · naptár-emlékeztető</text>
    <text x="80" y="520" font-family="DejaVu Sans, Arial, sans-serif" font-size="30" fill="#ffb28f">gyuri125.github.io/big-deal-radar</text>
  </svg>`;
  await sharp(Buffer.from(siteSvg)).png().toFile(path.join(distDir, 'og-image.png'));

  for (const size of [192, 512]) {
    await sharp(Buffer.from(iconSvg(size)))
      .png()
      .toFile(path.join(distDir, `icon-${size}.png`));
  }

  const urls = [
    siteUrl,
    ...deals.map((deal) => `${siteUrl}deal/${deal.id}/`),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) =>
      `  <url><loc>${escapeXml(url)}</loc><changefreq>weekly</changefreq><priority>${url === siteUrl ? '1.0' : '0.7'}</priority></url>`
  )
  .join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap, 'utf8');

  console.log(`✅ ${deals.length} deal-oldal + OG kép + sitemap elkészült.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
