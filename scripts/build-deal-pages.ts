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
  addDays,
} from '../src/utils/dates';
import { buildVCalendar, type IcsEvent } from '../src/utils/ics';
import {
  classifyLinkStatus,
  summarizeLinkStatuses,
  type LinkStatusKind,
} from '../src/utils/link-status';
import { loadDeals } from '../src/pipeline/load';

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

function dealTypeLabel(deal: Deal): string {
  if (deal.type === 'flat') return '★ Prémium ugyanannyi';
  if (deal.type === 'free') return 'Ingyenes';
  if (deal.type === 'money') return 'Pénzügy';
  if (deal.type === 'sale') return 'Akció';
  return 'Különleges hozzáférés';
}

function googleMapsRouteUrl(deal: Deal): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${deal.location}, Hungary`
  )}`;
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

function themeBootstrapScript(): string {
  return `<script>
  try {
    var stored = localStorage.getItem('big-deal-radar-theme');
    var param = new URLSearchParams(window.location.search).get('theme');
    document.documentElement.dataset.theme =
      stored === 'dark' || stored === 'light'
        ? stored
        : param === 'dark' || param === 'light'
          ? param
          : window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
  } catch (error) {
    document.documentElement.dataset.theme = 'light';
  }
</script>`;
}

function pageCss(): string {
  return `
    :root{--navy:#12212f;--cream:#f6f1e7;--paper:#fffdf8;--line:#e5ded2;--orange:#f26b38;--teal:#0f8f7e;--gold:#c9941a;--muted:#667085;--text:#1c2530;--lead:#475467;--meta:#b5471d;--price-note:#667085;--free:#08685c;--badge-bg:#fff0e8;--badge-text:#b5471d;--note-bg:#fff6d9;--note-text:#6f5310;--booking-bg:#e7f6f3;--booking-text:#25564e;--btn-bg:var(--navy);--btn-text:var(--paper);--error:#a02c20;--ok-bg:#e7f6f3;--ok-text:#08685c;--warn-bg:#fff6d9;--warn-text:#8f6910;--fail-bg:#fdecea;--fail-text:#a02c20;color-scheme:light}
    :root[data-theme="dark"]{--navy:#e8eef5;--cream:#0a141d;--paper:#132230;--line:#293b4d;--muted:#9fb0c0;--text:#e8eef5;--lead:#aebdcc;--meta:#ff9d7a;--price-note:#aebdcc;--free:#7fe0d1;--badge-bg:#3a2118;--badge-text:#ffb59a;--note-bg:#33280d;--note-text:#f0d58e;--booking-bg:#0d2c28;--booking-text:#9ce0d4;--btn-bg:#b5471d;--btn-text:#fff;--error:#ffb3a8;--ok-bg:#0d2c28;--ok-text:#7fe0d1;--warn-bg:#33280d;--warn-text:#f0c65e;--fail-bg:#3a1715;--fail-text:#ffb3a8;color-scheme:dark}
    @media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--navy:#e8eef5;--cream:#0a141d;--paper:#132230;--line:#293b4d;--muted:#9fb0c0;--text:#e8eef5;--lead:#aebdcc;--meta:#ff9d7a;--price-note:#aebdcc;--free:#7fe0d1;--badge-bg:#3a2118;--badge-text:#ffb59a;--note-bg:#33280d;--note-text:#f0d58e;--booking-bg:#0d2c28;--booking-text:#9ce0d4;--btn-bg:#b5471d;--btn-text:#fff;--error:#ffb3a8;--ok-bg:#0d2c28;--ok-text:#7fe0d1;--warn-bg:#33280d;--warn-text:#f0c65e;--fail-bg:#3a1715;--fail-text:#ffb3a8;color-scheme:dark}}
    *{box-sizing:border-box}body{margin:0;font-family:Inter,"Segoe UI",system-ui,sans-serif;color:var(--text);background:radial-gradient(circle at 10% 0%,rgba(242,107,56,.1),transparent 28rem),var(--cream);line-height:1.55}
    a{color:inherit}.wrap{max-width:820px;margin:0 auto;padding:24px}.top{display:flex;align-items:center;justify-content:space-between;padding:16px 0;border-bottom:1px solid var(--line)}
    .brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-size:.72rem;font-weight:800;letter-spacing:.18em;line-height:1.05}
    .mark{display:grid;place-items:center;width:34px;height:34px;border:2px solid var(--navy);border-radius:50%;position:relative}.mark:before,.mark:after{content:"";position:absolute;border:1.5px solid var(--navy);border-radius:50%;opacity:.55}.mark:before{inset:7px}.mark:after{inset:13px}
    .dot{position:absolute;width:5px;height:5px;border-radius:50%;background:var(--orange)}
    .back{font-size:.78rem;font-weight:700;color:var(--muted);text-decoration:none}
    .hero{margin-top:28px;padding:32px;border:1px solid var(--line);border-top:5px solid var(--orange);border-radius:24px;background:var(--paper);box-shadow:0 18px 50px rgba(18,33,47,.08)}
    .badge{display:inline-flex;padding:4px 10px;border-radius:999px;background:var(--badge-bg);color:var(--badge-text);font-size:.66rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
    h1{margin:14px 0 0;font-family:Georgia,serif;font-size:clamp(2rem,6vw,3.5rem);line-height:1.02;letter-spacing:-.03em;color:var(--navy)}
    .meta{margin:14px 0 0;font-size:.85rem;font-weight:700;color:var(--meta)}
    .route-links{margin:6px 0 0;font-size:.76rem;font-weight:700}.route-links a{color:var(--muted);text-decoration:underline;text-underline-offset:2px}.route-links a:hover{color:var(--orange)}
    .lead{margin:16px 0 0;font-size:1.02rem;color:var(--lead)}
    .price{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-top:22px;padding-top:18px;border-top:1px dashed var(--line)}
    .old{font-size:.9rem;color:var(--muted);text-decoration:line-through}.new{font-size:1.7rem;font-weight:800;color:var(--navy)}.free{font-size:1.3rem;font-weight:800;color:var(--free)}
    .note{margin:18px 0 0;padding:12px 14px;border-left:3px solid var(--gold);border-radius:8px;background:var(--note-bg);font-size:.82rem;color:var(--note-text)}
    .booking-note{margin:12px 0 0;padding:12px 14px;border-left:3px solid var(--teal);border-radius:8px;background:var(--booking-bg);font-size:.82rem;color:var(--booking-text)}
    .actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}
    .btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border:1px solid transparent;border-radius:999px;font-size:.88rem;font-weight:700;text-decoration:none;cursor:pointer}
    .btn-primary{background:var(--btn-bg);color:var(--btn-text)}.btn-ghost{background:transparent;border-color:var(--line);color:var(--navy)}
    h2{margin:28px 0 10px;font-family:Georgia,serif;font-size:1.4rem;font-weight:500;color:var(--navy)}
    .sources{display:grid;gap:8px}.source{display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--paper);text-decoration:none}
    .source b{font-size:.8rem}.source span{margin-left:auto;font-size:.7rem;color:var(--muted)}
    .related{display:grid;gap:8px}
    .related a{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--paper);text-decoration:none}
    .related a:hover{border-color:#cfc5b6}.related b{font-size:.84rem}.related span{font-size:.72rem;color:var(--muted);white-space:nowrap}
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

function calendarEventsForDeal(
  deal: Deal,
  effective: ReturnType<typeof nextOccurrence>
): IcsEvent[] {
  if (!effective) return [];

  const events: IcsEvent[] = [
    {
      uid: `${deal.id}@big-deal-radar`,
      start: effective.start,
      end: effective.end ?? effective.start,
      summary: deal.title,
      description: `${deal.deal}${
        deal.booking_note
          ? `\n\n${deal.type === 'free' ? 'Tudnivaló' : 'Jegyvásárlás'}: ${deal.booking_note}`
          : ''
      }`,
      location: deal.location,
      url: deal.source_url,
    },
  ];

  if (deal.booking_opens) {
    const bookingDate = parseISODate(deal.booking_opens);
    events.push({
      uid: `${deal.id}-booking@big-deal-radar`,
      start: bookingDate,
      end: bookingDate,
      summary: `Foglalás nyílik: ${deal.title}`,
      description: deal.booking_note ?? deal.deal,
    });
  }

  return events;
}

function icsForDeal(
  deal: Deal,
  effective: ReturnType<typeof nextOccurrence>,
  now = new Date()
): string {
  const events = calendarEventsForDeal(deal, effective);
  return events.length > 0 ? buildVCalendar(events, { now }) : '';
}

function buildDealPage(deal: Deal, related: Deal[] = []): string {
  const effective = nextOccurrence(deal);
  const dateLabel = effectiveDateLabel(deal, effective);
  const checked = deal.last_checked
    ? ` · Ellenőrizve: ${formatHuDate(parseISODate(deal.last_checked))}`
    : '';
  const booking = deal.booking_url
    ? `<a class="btn btn-primary" href="${escapeHtml(deal.booking_url)}" target="_blank" rel="noopener">Jegyvásárlás / foglalás</a>`
    : '';
  const ics = effective
    ? `<a class="btn btn-ghost" href="./${encodeURIComponent(deal.id)}.ics">Naptárba (.ics)</a>`
    : '';
  const googleUrl = effective
    ? (() => {
        const start = effective.start;
        const end = effective.end ?? start;
        const format = (date: Date): string =>
          `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
            date.getDate()
          ).padStart(2, '0')}`;
        const details = [
          deal.deal,
          deal.booking_note
            ? `${deal.type === 'free' ? 'Tudnivaló' : 'Jegyvásárlás'}: ${deal.booking_note}`
            : '',
          deal.sources[0]?.url ? `Forrás: ${deal.sources[0].url}` : '',
        ]
          .filter(Boolean)
          .join('\n\n');
        return `https://calendar.google.com/calendar/render?${new URLSearchParams({
          action: 'TEMPLATE',
          text: deal.title,
          dates: `${format(start)}/${format(addDays(end, 1))}`,
          details,
          location: deal.location,
        }).toString()}`;
      })()
    : '';
  const google = googleUrl
    ? `<a class="btn btn-ghost" href="${escapeHtml(googleUrl)}" target="_blank" rel="noopener">Google Naptárba</a>`
    : '';
  const relatedItems = related
    .map((item) => {
      const itemEffective = nextOccurrence(item);
      return `<a href="../${encodeURIComponent(item.id)}/"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(effectiveDateLabel(item, itemEffective))}</span></a>`;
    })
    .join('');
  const radarLink = `../../?deal=${encodeURIComponent(deal.id)}`;
  const routeLinks =
    deal.location !== 'Online'
      ? `<p class="route-links"><a href="${escapeHtml(googleMapsRouteUrl(deal))}" target="_blank" rel="noopener">Útvonal Google Mapsen</a>${
          deal.location === 'Budapest'
            ? ' · <a href="https://utvonalterv.hu/" target="_blank" rel="noopener">BKK útvonalterv</a>'
            : ''
        }</p>`
      : '';
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

  const jsonLdPrice =
    deal.type === 'free' || deal.deal_price === 0 ? 0 : deal.deal_price;
  const offer =
    jsonLdPrice !== null
      ? {
          '@type': 'Offer',
          price: jsonLdPrice,
          priceCurrency: deal.currency ?? 'HUF',
          availability: 'https://schema.org/InStock',
          url:
            deal.booking_url ??
            deal.source_url ??
            `${siteUrl}deal/${deal.id}/`,
        }
      : null;

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
        ...(offer ? { offers: offer } : {}),
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
  <meta name="color-scheme" content="light dark"/>
  <link rel="icon" type="image/svg+xml" href="../../favicon.svg"/>
  <title>${escapeHtml(deal.title)} – Big-deal radar</title>
  <meta name="description" content="${escapeHtml(`${deal.deal} ${dateLabel} · ${deal.location}`)}"/>
  <link rel="canonical" href="${escapeHtml(`${siteUrl}deal/${deal.id}/`)}"/>
  <link rel="alternate" type="application/rss+xml" title="Big-deal radar – következő dealek" href="../../feed.xml"/>
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
  ${themeBootstrapScript()}
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
      ${routeLinks}
      <p class="lead">${escapeHtml(deal.deal)}</p>

      <div class="price">
        ${deal.normal_price !== null ? `<span class="old">${escapeHtml(normalPriceLabel(deal).replace('Normál ár: ', ''))}</span>` : ''}
        <span class="${deal.type === 'free' || deal.deal_price === 0 ? 'free' : 'new'}">${escapeHtml(priceLabel(deal))}</span>
        ${deal.price_note ? `<span style="font-size:.78rem;color:var(--price-note)">${escapeHtml(deal.price_note)}</span>` : ''}
      </div>

      ${deal.booking_note ? `<p class="booking-note"><strong>${deal.type === 'free' ? 'Tudnivaló' : 'Jegyvásárlás'}:</strong> ${escapeHtml(deal.booking_note)}</p>` : ''}
      ${deal.notes ? `<p class="note">${escapeHtml(deal.notes)}</p>` : ''}

      <div class="actions">
        <a class="btn btn-primary" href="${radarLink}">Megnyitás a radarom</a>
        ${booking}
        ${ics}
        ${google}
      </div>

      <h2>Források</h2>
      <div class="sources">${sources}</div>

      ${relatedItems ? `<h2>Hasonló dealek</h2><div class="related">${relatedItems}</div>` : ''}
    </main>

    <footer class="footer">
      <p>Big-deal radar · <a href="../../">a teljes lista</a> · <a href="../../gyujtemeny/">gyűjtemények</a> · <a href="../../forrasok/">források</a> · <a href="${reportUrl}" target="_blank" rel="noopener">Hibát jelentek</a></p>
      <p>Az adatok évente változnak, ellenőrizd a hivatalos forráson.</p>
    </footer>
  </div>
</body>
</html>`;
}

interface Collection {
  slug: string;
  title: string;
  subtitle: string;
  pick: (deal: Deal) => boolean;
}

const collections: Collection[] = [
  {
    slug: 'ingyenes',
    title: 'Ingyenes dealek',
    subtitle: 'Olyan helyek és programok, ahová máskor fizetnél.',
    pick: (deal) => deal.type === 'free',
  },
  {
    slug: 'mozi',
    title: 'Mozi dealek',
    subtitle: 'Filmünnepek, art mozi kedvezmények, szabadtéri vetítések.',
    pick: (deal) => deal.category === 'mozi',
  },
  {
    slug: 'gasztro',
    title: 'Gasztro dealek',
    subtitle: 'Restaurant Week, fesztiválok, kávé és bor.',
    pick: (deal) => deal.category === 'gasztro',
  },
  {
    slug: 'unnep',
    title: 'Ünnepek és évfordulók',
    subtitle: 'Karácsony, szülinap, húsvét és más kiemelt alkalmak.',
    pick: (deal) => deal.tags.includes('unnep'),
  },
  {
    slug: 'program',
    title: 'Programok',
    subtitle: 'Fesztiválok, koncertek, kiállítások és városi séták.',
    pick: (deal) => deal.tags.includes('program'),
  },
  {
    slug: 'premium',
    title: 'Prémium ugyanannyi',
    subtitle: 'Egy ár, a prémium élmény is benne.',
    pick: (deal) => deal.type === 'flat',
  },
  {
    slug: 'csalad',
    title: 'Családi programok',
    subtitle: 'Gyerekekkel is könnyen teljesíthető dealek.',
    pick: (deal) => deal.category === 'csalad',
  },
  {
    slug: 'penzugy',
    title: 'Pénzügyi dobások',
    subtitle: 'Támogatások, adójóváírások, banki bónuszok.',
    pick: (deal) => deal.category === 'penzugy',
  },
];

function collectionDeals(collection: Collection, deals: Deal[]): Deal[] {
  return deals
    .filter(collection.pick)
    .sort((a, b) => {
      const aStart = nextOccurrence(a)?.start.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bStart = nextOccurrence(b)?.start.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aStart - bStart || a.title.localeCompare(b.title, 'hu');
    });
}

function collectionCss(): string {
  return `${pageCss()}
    .collection-hero{padding-bottom:24px}
    .collection-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin-top:22px}
    .collection-card{display:flex;flex-direction:column;gap:8px;padding:16px;border:1px solid var(--line);border-radius:16px;background:var(--paper);text-decoration:none;transition:border-color 160ms ease,transform 160ms ease}
    .collection-card:hover{border-color:#cfc5b6;transform:translateY(-2px)}
    .collection-card .badge{align-self:flex-start}
    .collection-card strong{font-family:Georgia,serif;font-size:1.08rem;font-weight:500;line-height:1.2;color:var(--navy)}
    .collection-card .collection-date{font-size:.72rem;font-weight:700;color:var(--meta)}
    .collection-card .collection-deal{font-size:.78rem;color:var(--muted)}
    .collection-card .collection-price{margin-top:auto;font-size:.86rem;font-weight:800;color:var(--navy)}
    .collection-links{display:flex;flex-wrap:wrap;gap:8px;margin-top:26px}
    .collection-links a{padding:8px 12px;border:1px solid var(--line);border-radius:999px;background:var(--paper);font-size:.76rem;font-weight:700;text-decoration:none}
  `;
}

function buildCollectionPage(collection: Collection, deals: Deal[]): string {
  const items = collectionDeals(collection, deals);
  const cards = items
    .map((deal) => {
      const effective = nextOccurrence(deal);
      return `<a class="collection-card" href="../../deal/${encodeURIComponent(deal.id)}/">
        <span class="badge">${escapeHtml(dealTypeLabel(deal))}</span>
        <strong>${escapeHtml(deal.title)}</strong>
        <span class="collection-date">${escapeHtml(effectiveDateLabel(deal, effective))}</span>
        <span class="collection-deal">${escapeHtml(deal.deal)}</span>
        <span class="collection-price">${escapeHtml(priceLabel(deal))}</span>
      </a>`;
    })
    .join('');

  const otherLinks = collections
    .filter((item) => item.slug !== collection.slug)
    .map(
      (item) =>
        `<a href="../${item.slug}/">${escapeHtml(item.title)}</a>`
    )
    .join('');

  return `<!doctype html>
<html lang="hu">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="theme-color" content="#12212f"/>
  <link rel="icon" type="image/svg+xml" href="../../favicon.svg"/>
  <title>${escapeHtml(collection.title)} – Big-deal radar</title>
  <meta name="description" content="${escapeHtml(collection.subtitle)}"/>
  <link rel="canonical" href="${escapeHtml(`${siteUrl}gyujtemeny/${collection.slug}/`)}"/>
  <link rel="alternate" type="application/rss+xml" title="Big-deal radar – következő dealek" href="../../feed.xml"/>
  ${themeBootstrapScript()}
  <style>${collectionCss()}</style>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <a class="brand" href="../../"><span class="mark"><span class="dot"></span></span><span>BIG-DEAL<br/>RADAR</span></a>
      <a class="back" href="../../">← Vissza a radarhoz</a>
    </header>

    <main class="hero collection-hero">
      <span class="badge">Gyűjtemény</span>
      <h1>${escapeHtml(collection.title)}</h1>
      <p class="lead">${escapeHtml(collection.subtitle)}</p>
      <p class="meta">${items.length} deal · Az adatokat a forrásnál ellenőrizd.</p>

      <div class="collection-grid">${cards}</div>

      <div class="collection-links">
        <a href="../">Minden gyűjtemény</a>
        ${otherLinks}
      </div>
    </main>

    <footer class="footer">
      <p>Big-deal radar · <a href="../../">a teljes lista</a> · <a href="../../feed.xml">RSS</a></p>
      <p>Az adatok évente változnak, ellenőrizd a hivatalos forráson.</p>
    </footer>
  </div>
</body>
</html>`;
}

function buildCollectionIndex(deals: Deal[]): string {
  const cards = collections
    .map((collection) => {
      const count = collectionDeals(collection, deals).length;
      return `<a class="collection-card" href="./${collection.slug}/">
        <strong>${escapeHtml(collection.title)}</strong>
        <span class="collection-date">${count} deal</span>
        <span class="collection-deal">${escapeHtml(collection.subtitle)}</span>
      </a>`;
    })
    .join('');

  return `<!doctype html>
<html lang="hu">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="theme-color" content="#12212f"/>
  <link rel="icon" type="image/svg+xml" href="../favicon.svg"/>
  <title>Gyűjtemények – Big-deal radar</title>
  <meta name="description" content="Válogatott dealgyűjtemények: ingyenes, mozi, gasztro, ünnepek, programok."/>
  <link rel="canonical" href="${escapeHtml(`${siteUrl}gyujtemeny/`)}"/>
  ${themeBootstrapScript()}
  <style>${collectionCss()}</style>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <a class="brand" href="../"><span class="mark"><span class="dot"></span></span><span>BIG-DEAL<br/>RADAR</span></a>
      <a class="back" href="../">← Vissza a radarhoz</a>
    </header>
    <main class="hero collection-hero">
      <span class="badge">Gyűjtemények</span>
      <h1>Válogatott dealek</h1>
      <p class="lead">Nem tudod, hol kezdd? Válassz egy témát, és nézd meg a hozzá tartozó dealeket.</p>
      <div class="collection-grid">${cards}</div>
    </main>
    <footer class="footer">
      <p>Big-deal radar · <a href="../">a teljes lista</a> · <a href="../feed.xml">RSS</a></p>
    </footer>
  </div>
</body>
</html>`;
}

interface LinkStatusEntry {
  url: string;
  status: number | string;
  finalUrl: string | null;
  error: string | null;
  deals: string[];
}

interface LinkStatusFile {
  checked_at: string;
  total: number;
  ok: number;
  redirected: number;
  blocked: number;
  failed: number;
  unreachable?: number;
  links: LinkStatusEntry[];
}

interface SourceMonitorReport {
  checked_at: string;
  changed: Array<{ label: string; url: string }>;
  added: Array<{ label: string; url: string }>;
  errors: Array<{ label: string; url: string; error: string }>;
}

function buildSourcesPage(
  status: LinkStatusFile | null,
  monitor: SourceMonitorReport | null
): string {
  const checked = status?.checked_at
    ? new Date(status.checked_at).toLocaleString('hu-HU', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;
  const linkCounts = status
    ? summarizeLinkStatuses(status.links.map((entry) => entry.status))
    : null;
  const monitorChecked = monitor?.checked_at
    ? new Date(monitor.checked_at).toLocaleString('hu-HU', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;
  const monitorProblems: Array<{
    label: string;
    url: string;
    kind: 'változott' | 'hiba';
    error?: string;
  }> = [
    ...(monitor?.changed ?? []).map((item) => ({
      ...item,
      kind: 'változott' as const,
    })),
    ...(monitor?.errors ?? []).map((item) => ({
      ...item,
      kind: 'hiba' as const,
      error: item.error,
    })),
  ];
  const monitorSection = monitor
    ? `<div class="monitor-box">
        <strong>Automatikus forrásfigyelés</strong>
        <span>Utolsó futás: ${escapeHtml(monitorChecked ?? '')} · változott: ${monitor.changed.length} · hiba: ${monitor.errors.length}</span>
        ${
          monitorProblems.length > 0
            ? `<ul>${monitorProblems
                .map(
                  (item) =>
                    `<li><b>${escapeHtml(item.kind)}:</b> <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.label)}</a>${item.error ? ` – ${escapeHtml(item.error)}` : ''}</li>`
                )
                .join('')}</ul>`
            : '<span class="monitor-ok">Nincs friss változás vagy hiba.</span>'
        }
      </div>`
    : '';

  const kindOrder: Record<LinkStatusKind, number> = {
    failed: 0,
    unreachable: 1,
    blocked: 2,
    ok: 3,
  };
  const rows = (status?.links ?? [])
    .slice()
    .sort((a, b) => {
      return (
        kindOrder[classifyLinkStatus(a.status)] -
          kindOrder[classifyLinkStatus(b.status)] ||
        a.url.localeCompare(b.url)
      );
    })
    .map((entry) => {
      const kind = classifyLinkStatus(entry.status);
      const label =
        kind === 'failed'
          ? String(entry.status)
          : kind === 'unreachable'
            ? 'Elérhetetlen'
            : kind === 'blocked'
              ? `${entry.status} botblokk`
              : String(entry.status);
      const final =
        entry.finalUrl &&
        entry.finalUrl.replace(/\/$/, '') !== entry.url.replace(/\/$/, '')
          ? `<span class="source-final">→ ${escapeHtml(entry.finalUrl)}</span>`
          : '';
      return `<li class="source-row source-${kind}">
        <span class="source-status">${escapeHtml(label)}</span>
        <div class="source-main">
          <a href="${escapeHtml(entry.url)}" target="_blank" rel="noopener">${escapeHtml(entry.url)}</a>
          ${final}
          <span class="source-deals">${escapeHtml(entry.deals.join(' · '))}</span>
          ${entry.error ? `<span class="source-error">${escapeHtml(entry.error)}</span>` : ''}
        </div>
      </li>`;
    })
    .join('');

  const summary = status
    ? `<div class="source-summary">
        <div><strong>${status.total}</strong><span>link</span></div>
        <div><strong>${linkCounts?.ok ?? status.ok}</strong><span>OK</span></div>
        <div><strong>${status.redirected}</strong><span>átirányítva</span></div>
        <div><strong>${linkCounts?.blocked ?? status.blocked}</strong><span>botblokk</span></div>
        <div><strong>${linkCounts?.unreachable ?? status.unreachable ?? 0}</strong><span>elérhetetlen</span></div>
        <div><strong>${linkCounts?.failed ?? status.failed}</strong><span>hiba</span></div>
      </div>
      <p class="source-note">Utolsó ellenőrzés: <strong>${escapeHtml(checked ?? '')}</strong>. A botblokkolt oldalak böngészőből általában elérhetők; az „elérhetetlen” átmeneti hálózati hibát is jelenthet.</p>`
    : `<p class="source-note">Még nem futott linkellenőrzés. Indítsd el a <a href="https://github.com/Gyuri125/big-deal-radar/actions/workflows/link-check.yml">Link check</a> workflow-t.</p>`;

  return `<!doctype html>
<html lang="hu">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="theme-color" content="#12212f"/>
  <link rel="icon" type="image/svg+xml" href="../favicon.svg"/>
  <title>Forrás-egészség – Big-deal radar</title>
  <meta name="description" content="A Big-deal radar forrásainak legutóbbi linkellenőrzési állapota."/>
  <link rel="canonical" href="${escapeHtml(`${siteUrl}forrasok/`)}"/>
  ${themeBootstrapScript()}
  <style>${pageCss()}
    .source-summary{display:grid;grid-template-columns:repeat(6,1fr);gap:1px;overflow:hidden;margin-top:22px;border:1px solid var(--line);border-radius:14px;background:var(--line)}
    .source-summary>div{display:flex;flex-direction:column;gap:2px;padding:14px;background:var(--paper)}
    .source-summary strong{font-family:Georgia,serif;font-size:1.5rem;font-weight:500;color:var(--navy)}
    .source-summary span{font-size:.7rem;color:var(--muted)}
    .source-note{font-size:.8rem;color:var(--muted)}
    .monitor-box{display:flex;flex-direction:column;gap:5px;margin-top:14px;padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--paper);font-size:.8rem}
    .monitor-box strong{color:var(--navy)}.monitor-box span{color:var(--muted)}
    .monitor-box ul{margin:4px 0 0;padding-left:18px}.monitor-box li{font-size:.76rem}
    .monitor-ok{color:var(--ok-text)!important;font-weight:700}
    .source-list{display:grid;gap:6px;margin:0;padding:0;list-style:none}
    .source-row{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--paper)}
    .source-status{flex:0 0 auto;min-width:86px;padding:3px 7px;border-radius:6px;font-size:.64rem;font-weight:800;text-align:center}
    .source-ok .source-status{background:var(--ok-bg);color:var(--ok-text)}
    .source-blocked .source-status{background:var(--warn-bg);color:var(--warn-text)}
    .source-unreachable .source-status{background:var(--warn-bg);color:var(--warn-text)}
    .source-failed .source-status{background:var(--fail-bg);color:var(--fail-text)}
    .source-main{display:flex;flex-direction:column;gap:2px;min-width:0}
    .source-main a{font-size:.8rem;font-weight:700;overflow-wrap:anywhere}
    .source-final,.source-deals,.source-error{font-size:.68rem;color:var(--muted);overflow-wrap:anywhere}
    .source-error{color:var(--error)}
    @media(max-width:600px){.source-summary{grid-template-columns:repeat(2,1fr)}.source-row{flex-direction:column}.source-status{min-width:0}}
  </style>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <a class="brand" href="../"><span class="mark"><span class="dot"></span></span><span>BIG-DEAL<br/>RADAR</span></a>
      <a class="back" href="../">← Vissza a radarhoz</a>
    </header>
    <main class="hero">
      <span class="badge">Forrás-egészség</span>
      <h1>Forrás-egészség</h1>
      <p class="lead">Átláthatóan mutatjuk, mely források élnek, melyek botblokkoltak, és hol volt hiba a legutóbbi ellenőrzéskor.</p>
      ${summary}
      ${monitorSection}
      <ul class="source-list">${rows}</ul>
      <p class="source-note">A linkellenőrzés hetente fut. Ha hibát látsz, a <a href="https://github.com/Gyuri125/big-deal-radar/issues/new/choose">GitHub Issue űrlapon</a> jelezheted.</p>
    </main>
    <footer class="footer">
      <p>Big-deal radar · <a href="../">a teljes lista</a> · <a href="../feed.xml">RSS</a></p>
    </footer>
  </div>
</body>
</html>`;
}

async function main(): Promise<void> {
  if (!fs.existsSync(dealsPath)) {
    throw new Error('Nincs data/deals.json – futtasd: npm run import');
  }

  const { deals } = loadDeals(dealsPath);
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(path.join(distDir, 'og'), { recursive: true });

  const buildNow = new Date();

  for (const deal of deals) {
    const effective = nextOccurrence(deal);
    const dateLabel = effectiveDateLabel(deal, effective);
    const pageDir = path.join(distDir, 'deal', deal.id);
    const related = deals
      .filter((item) => item.id !== deal.id && item.category === deal.category)
      .sort((a, b) => {
        const aStart = nextOccurrence(a)?.start.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bStart = nextOccurrence(b)?.start.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aStart - bStart;
      })
      .slice(0, 3);
    fs.mkdirSync(pageDir, { recursive: true });
    fs.writeFileSync(path.join(pageDir, 'index.html'), buildDealPage(deal, related), 'utf8');

    const ics = icsForDeal(deal, effective, buildNow);
    if (ics) {
      fs.writeFileSync(path.join(pageDir, `${deal.id}.ics`), ics, 'utf8');
    }

    const svg = ogSvg(deal, dateLabel);
    await sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(distDir, 'og', `${deal.id}.png`));
  }

  const collectionsDir = path.join(distDir, 'gyujtemeny');
  fs.mkdirSync(collectionsDir, { recursive: true });
  for (const collection of collections) {
    const collectionDir = path.join(collectionsDir, collection.slug);
    fs.mkdirSync(collectionDir, { recursive: true });
    fs.writeFileSync(
      path.join(collectionDir, 'index.html'),
      buildCollectionPage(collection, deals),
      'utf8'
    );
  }
  fs.writeFileSync(
    path.join(collectionsDir, 'index.html'),
    buildCollectionIndex(deals),
    'utf8'
  );

  const linkStatusPath = path.join(root, 'data', 'link-status.json');
  const linkStatus = fs.existsSync(linkStatusPath)
    ? (JSON.parse(fs.readFileSync(linkStatusPath, 'utf8')) as LinkStatusFile)
    : null;
  const monitorReportPath = path.join(root, 'data', 'source-monitor-report.json');
  const monitorReport = fs.existsSync(monitorReportPath)
    ? (JSON.parse(
        fs.readFileSync(monitorReportPath, 'utf8')
      ) as SourceMonitorReport)
    : null;
  const sourcesDir = path.join(distDir, 'forrasok');
  fs.mkdirSync(sourcesDir, { recursive: true });
  fs.writeFileSync(
    path.join(sourcesDir, 'index.html'),
    buildSourcesPage(linkStatus, monitorReport),
    'utf8'
  );

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
    `${siteUrl}gyujtemeny/`,
    ...collections.map(
      (collection) => `${siteUrl}gyujtemeny/${collection.slug}/`
    ),
    `${siteUrl}forrasok/`,
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

  const feedItems = deals
    .map((deal) => ({ deal, effective: nextOccurrence(deal) }))
    .filter(
      (item): item is { deal: Deal; effective: NonNullable<ReturnType<typeof nextOccurrence>> } =>
        item.effective !== null
    )
    .sort((a, b) => a.effective.start.getTime() - b.effective.start.getTime())
    .slice(0, 60);

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Big-deal radar – következő dealek</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>Budapest és Magyarország legjobb ritka dealjei, időrendben.</description>
    <language>hu-HU</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(`${siteUrl}feed.xml`)}" rel="self" type="application/rss+xml" />
${feedItems
  .map(({ deal, effective }) => {
    const url = `${siteUrl}deal/${deal.id}/`;
    const dateLabel = effectiveDateLabel(deal, effective);
    const description = [
      deal.deal,
      dateLabel,
      deal.location,
      priceLabel(deal),
      deal.booking_note,
    ]
      .filter(Boolean)
      .join(' · ');
    const pubDate = new Date(
      effective.start.getFullYear(),
      effective.start.getMonth(),
      effective.start.getDate(),
      8
    ).toUTCString();

    return `    <item>
      <title>${escapeXml(deal.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(deal.category)}</category>
      <description>${escapeXml(description)}</description>
    </item>`;
  })
  .join('\n')}
  </channel>
</rss>
`;
  fs.writeFileSync(path.join(distDir, 'feed.xml'), feed, 'utf8');

  console.log(
    `✅ ${deals.length} deal-oldal + ${collections.length} gyűjtemény + forrás-egészség + OG kép + sitemap + ${feedItems.length} elemes RSS elkészült.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
