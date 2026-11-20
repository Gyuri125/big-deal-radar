import './style.css';
import dealsData from '../../data/deals.json';
import type { Deal, DealCategory, DealType } from '../types';
import {
  addDays,
  diffDays,
  effectiveDateLabel,
  formatHuf,
  isInMonth,
  monthLabel,
  nextOccurrence,
  parseISODate,
  startOfDay,
  valueScore,
  type EffectiveDate,
} from '../utils/dates';

type StatusKind = 'live' | 'upcoming' | 'past' | 'continuous' | 'unknown';
type SortMode = 'next' | 'value' | 'title';

interface EnrichedDeal extends Deal {
  effective: EffectiveDate | null;
  days: number | null;
  dateLabel: string;
  status: StatusKind;
  discount: number | null;
}

interface StatusData {
  generated_at: string;
  last_run: string;
  source: string;
  counts: Record<string, number>;
  errors: string[];
}

const deals = dealsData as unknown as Deal[];
const now = new Date();

const TYPE_LABELS: Record<DealType, string> = {
  flat: '★ Prémium ugyanannyi',
  free: 'Ingyenes',
  sale: 'Akció',
  money: 'Pénzügy',
  access: 'Különleges hozzáférés',
};

const CATEGORY_LABELS: Record<DealCategory, string> = {
  mozi: 'Mozi',
  kultura: 'Kultúra',
  muzeum: 'Múzeum',
  gasztro: 'Gasztronómia',
  utazas: 'Utazás',
  vasarlas: 'Vásárlás',
  penzugy: 'Pénzügy',
  egeszseg: 'Egészség',
  csalad: 'Család',
  egyeb: 'Egyéb',
};

const TYPE_FILTERS: Array<{ value: 'all' | DealType; label: string }> = [
  { value: 'all', label: 'Mind' },
  { value: 'flat', label: '★ Prémium' },
  { value: 'free', label: 'Ingyenes' },
  { value: 'sale', label: 'Akció' },
  { value: 'money', label: 'Pénzügy' },
  { value: 'access', label: 'Hozzáférés' },
];

const CATEGORY_FILTERS: Array<{ value: 'all' | DealCategory; label: string }> = [
  { value: 'all', label: 'Minden kategória' },
  ...Object.entries(CATEGORY_LABELS)
    .filter(([value]) => deals.some((deal) => deal.category === value))
    .map(([value, label]) => ({
      value: value as DealCategory,
      label,
    })),
];

const state = {
  query: '',
  type: 'all' as 'all' | DealType,
  category: 'all' as 'all' | DealCategory,
  location: 'all',
  sort: 'next' as SortMode,
  visible: 24,
};

const app = document.querySelector<HTMLDivElement>('#app');
const dialog = document.querySelector<HTMLDialogElement>('#deal-dialog');
const toast = document.querySelector<HTMLDivElement>('#toast');

if (!app || !dialog || !toast) {
  throw new Error('Hiányzó gyökér elemek az index.html-ben.');
}

const appRoot: HTMLDivElement = app;
const dialogEl: HTMLDialogElement = dialog;
const toastEl: HTMLDivElement = toast;

let status: StatusData | null = null;

function enrich(deal: Deal): EnrichedDeal {
  const effective = nextOccurrence(deal, now);
  const discount = valueScore(deal.normal_price, deal.deal_price);

  let statusKind: StatusKind = 'unknown';
  let days: number | null = null;

  if (effective) {
    const today = startOfDay(now);
    const start = startOfDay(effective.start);
    const end = effective.end ? startOfDay(effective.end) : start;
    statusKind = start <= today && end >= today ? 'live' : 'upcoming';
    days = diffDays(now, start);
  } else if (
    deal.recurrence === 'continuous' ||
    deal.recurrence === 'monthly' ||
    deal.recurrence === 'weekly' ||
    deal.recurrence === 'daily'
  ) {
    statusKind = 'continuous';
  } else if (deal.date_start && parseISODate(deal.date_start) < startOfDay(now)) {
    statusKind = 'past';
  }

  return {
    ...deal,
    effective,
    days,
    dateLabel: effectiveDateLabel(deal, effective),
    status: statusKind,
    discount,
  };
}

const enriched = deals.map(enrich);

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

function typeLabel(type: DealType): string {
  return TYPE_LABELS[type];
}

function statusLabel(deal: EnrichedDeal): string {
  if (deal.status === 'live') return 'MOST';
  if (deal.status === 'upcoming' && deal.days !== null) {
    if (deal.days === 0) return 'MA';
    if (deal.days === 1) return 'HOLNAP';
    return `${deal.days} NAP`;
  }
  if (deal.status === 'continuous') return 'FOLYAMATOS';
  if (deal.status === 'past') return 'ELMÚLT';
  return 'ÉVENTE';
}

function priceMarkup(deal: EnrichedDeal): string {
  if (deal.type === 'free' || deal.deal_price === 0) {
    return '<span class="price-free">Ingyenes</span>';
  }

  if (deal.deal_price !== null && deal.normal_price !== null) {
    const percent =
      deal.discount !== null ? Math.round(deal.discount * 100) : null;
    return `
      <span class="price-old">${formatHuf(deal.normal_price)}</span>
      <strong class="price-new">${formatHuf(deal.deal_price)}</strong>
      ${percent !== null && percent > 0 ? `<span class="price-save">-${percent}%</span>` : ''}
    `;
  }

  if (deal.deal_price !== null) {
    return `<strong class="price-new">${formatHuf(deal.deal_price)}</strong>`;
  }

  return '<span class="price-muted">Részletek a forrásban</span>';
}

function cardMarkup(deal: EnrichedDeal): string {
  const tags = deal.tags
    .filter((tag) => tag !== deal.category && tag !== deal.type)
    .slice(0, 3)
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join('');

  return `
    <article class="deal-card type-${deal.type}" data-id="${escapeHtml(deal.id)}">
      <div class="card-top">
        <span class="badge badge-${deal.type}">${typeLabel(deal.type)}</span>
        <span class="status status-${deal.status}">${statusLabel(deal)}</span>
      </div>
      <h3 class="card-title">${escapeHtml(deal.title)}</h3>
      <p class="card-date">${escapeHtml(deal.dateLabel)} <span class="card-location">· ${escapeHtml(deal.location)}</span></p>
      <p class="card-deal">${escapeHtml(deal.deal)}</p>
      <div class="price-row">${priceMarkup(deal)}</div>
      <div class="card-footer">
        <div class="tags">${tags}</div>
        <div class="card-actions">
          <button class="btn btn-ghost" data-action="ics" type="button" ${deal.effective ? '' : 'disabled title="Ehhez a dealhez nincs pontos dátum"'}>Naptárba</button>
          <button class="btn btn-solid" data-action="details" type="button">Részletek</button>
        </div>
      </div>
    </article>
  `;
}

function sortDeals(items: EnrichedDeal[], mode: SortMode): EnrichedDeal[] {
  return [...items].sort((a, b) => {
    if (mode === 'value') {
      const aValue = a.discount ?? -1;
      const bValue = b.discount ?? -1;
      if (aValue !== bValue) return bValue - aValue;
    }

    if (mode === 'title') {
      return a.title.localeCompare(b.title, 'hu');
    }

    const aDays = a.days ?? Number.MAX_SAFE_INTEGER;
    const bDays = b.days ?? Number.MAX_SAFE_INTEGER;
    if (aDays !== bDays) return aDays - bDays;
    return a.title.localeCompare(b.title, 'hu');
  });
}

function matchesFilters(deal: EnrichedDeal): boolean {
  if (state.type !== 'all' && deal.type !== state.type) return false;
  if (state.category !== 'all' && deal.category !== state.category) return false;
  if (state.location !== 'all' && deal.location !== state.location) return false;

  const query = state.query.trim().toLowerCase();
  if (!query) return true;

  return [deal.title, deal.deal, deal.timing, deal.location, ...deal.tags]
    .join(' ')
    .toLowerCase()
    .includes(query);
}

function hasActiveFilters(): boolean {
  return (
    state.query.trim().length > 0 ||
    state.type !== 'all' ||
    state.category !== 'all' ||
    state.location !== 'all'
  );
}

function upcomingDeals(): EnrichedDeal[] {
  return enriched
    .filter((deal) => {
      if (deal.status === 'live') return true;
      return (
        deal.status === 'upcoming' &&
        deal.days !== null &&
        deal.days >= 0 &&
        deal.days <= 7
      );
    })
    .sort((a, b) => {
      if (a.status === 'live' && b.status !== 'live') return -1;
      if (b.status === 'live' && a.status !== 'live') return 1;
      return (a.days ?? 99) - (b.days ?? 99);
    });
}

function monthDeals(): EnrichedDeal[] {
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const upcomingIds = new Set(upcomingDeals().map((deal) => deal.id));

  return enriched
    .filter((deal) => {
      if (upcomingIds.has(deal.id)) return false;
      if (!isInMonth(deal, currentMonth)) return false;
      if (!deal.effective) return true;
      return deal.effective.start.getFullYear() === currentYear;
    })
    .sort((a, b) => {
      const aDays = a.days ?? Number.MAX_SAFE_INTEGER;
      const bDays = b.days ?? Number.MAX_SAFE_INTEGER;
      return aDays - bDays || a.title.localeCompare(b.title, 'hu');
    });
}

function sectionMarkup(
  title: string,
  subtitle: string,
  items: EnrichedDeal[],
  emptyText?: string
): string {
  if (items.length === 0 && !emptyText) return '';

  return `
    <section class="results-section">
      <div class="section-head">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(subtitle)}</p>
        </div>
        <span class="section-count">${items.length}</span>
      </div>
      ${
        items.length > 0
          ? `<div class="grid">${items.map(cardMarkup).join('')}</div>`
          : `<div class="empty">${escapeHtml(emptyText ?? '')}</div>`
      }
    </section>
  `;
}

function renderStats(): void {
  const total = enriched.length;
  const flat = enriched.filter((deal) => deal.type === 'flat').length;
  const free = enriched.filter((deal) => deal.type === 'free').length;
  const upcoming = upcomingDeals().length;

  const stats = document.querySelector<HTMLDivElement>('#stats');
  if (!stats) return;

  stats.innerHTML = `
    <div class="stat"><strong>${total}</strong><span>deal a radarom</span></div>
    <div class="stat"><strong>${flat}</strong><span>prémium ugyanannyi</span></div>
    <div class="stat"><strong>${upcoming}</strong><span>a következő 7 napban</span></div>
    <div class="stat"><strong>${free}</strong><span>ingyenes</span></div>
  `;
}

function updateFilterButtons(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-filter-type]').forEach((button) => {
    const active = button.dataset.filterType === state.type;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  document.querySelectorAll<HTMLButtonElement>('[data-filter-category]').forEach((button) => {
    const active = button.dataset.filterCategory === state.category;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function renderResults(): void {
  const results = document.querySelector<HTMLElement>('#results');
  if (!results) return;

  const filtered = sortDeals(enriched.filter(matchesFilters), state.sort);

  if (hasActiveFilters()) {
    const visible = filtered.slice(0, state.visible);
    results.innerHTML = sectionMarkup(
      'Találatok',
      `${filtered.length} deal felel meg a szűrésnek`,
      visible,
      'Nincs találat. Próbálj más keresőszót vagy szűrőt.'
    );

    if (filtered.length > state.visible) {
      results.innerHTML += `
        <div class="load-more">
          <button class="btn btn-solid" data-action="more" type="button">
            További ${Math.min(24, filtered.length - state.visible)} deal
          </button>
        </div>
      `;
    }
    return;
  }

  const upcoming = upcomingDeals();
  const month = monthDeals();
  const all = sortDeals(filtered, state.sort).slice(0, state.visible);

  results.innerHTML = [
    sectionMarkup(
      'Most és a következő 7 napban',
      'Ami éppen él, vagy 7 napon belül kezdődik.',
      upcoming,
      'Nincs aktuális vagy 7 napon belüli esemény. Nézd a havi listát vagy a teljes kínálatot.'
    ),
    month.length > 0
      ? sectionMarkup(
          `${monthLabel(now.getMonth() + 1)} – havi radar`,
          'Akciók és események, amelyek ebben a hónapban esedékesek.',
          month
        )
      : '',
    sectionMarkup(
      'Teljes kínálat',
      'Minden deal, ami a radarom van.',
      all
    ),
  ].join('');

  if (filtered.length > state.visible) {
    results.innerHTML += `
      <div class="load-more">
        <button class="btn btn-solid" data-action="more" type="button">
          További ${Math.min(24, filtered.length - state.visible)} deal
        </button>
      </div>
    `;
  }
}

function renderFooter(): void {
  const footer = document.querySelector<HTMLElement>('#footer-status');
  if (!footer) return;

  if (status?.last_run) {
    const date = new Date(status.last_run).toLocaleString('hu-HU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    footer.innerHTML = `
      <span>Utolsó futás: <strong>${escapeHtml(date)}</strong></span>
      <span>Következő: <strong>08:00 / 12:00 / 20:00</strong></span>
      <span>Forrás: <strong>${escapeHtml(status.source)}</strong></span>
    `;
  } else {
    footer.innerHTML = `
      <span>Utolsó futás: <strong>a napi pipeline generálja</strong></span>
      <span>Következő: <strong>08:00 / 12:00 / 20:00</strong></span>
    `;
  }
}

function renderDebug(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get('debug') !== '1') return;

  const debug = document.createElement('details');
  debug.className = 'debug';
  debug.innerHTML = `
    <summary>Debug adatok</summary>
    <pre>${escapeHtml(
      JSON.stringify(
        {
          deals: enriched.length,
          upcoming: upcomingDeals().length,
          month: monthDeals().length,
          status,
        },
        null,
        2
      )
    )}</pre>
  `;
  document.querySelector('footer')?.before(debug);
}

function repoUrl(): string {
  if (window.location.hostname.endsWith('.github.io')) {
    const owner = window.location.hostname.split('.')[0];
    const repo = window.location.pathname.split('/').filter(Boolean)[0];
    if (owner && repo) {
      return `https://github.com/${owner}/${repo}`;
    }
  }
  return 'https://github.com/';
}

function renderShell(): void {
  const locations = [...new Set(enriched.map((deal) => deal.location))].sort((a, b) =>
    a.localeCompare(b, 'hu')
  );

  appRoot.innerHTML = `
    <header class="topbar">
      <a class="brand" href="./" aria-label="Big-deal radar főoldal">
        <span class="brand-mark" aria-hidden="true">
          <span></span><span></span><span></span>
        </span>
        <span class="brand-text">BIG-DEAL<br />RADAR</span>
      </a>
      <div class="topbar-right">
        <span class="live-dot"></span>
        <span>napi frissítés</span>
      </div>
    </header>

    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">MAGYAR DEAL-RADAR</p>
        <h1>A legjobb dealek,<br /><em>időben elkapva.</em></h1>
        <p class="lead">
          Budapest és Magyarország legjobb ritka alkalmai egy helyen:
          mozi, színház, múzeum, gasztro, utazás, pénzügy.
          Nem a sima kedvezmények – a nagy dobások.
        </p>
        <div class="hero-actions">
          <a class="btn btn-solid" href="#results">Böngészem a dealeket</a>
          <a class="btn btn-ghost" href="#results" data-action="jump-flat">★ Prémium ugyanannyi</a>
        </div>
      </div>
      <div class="hero-panel">
        <div class="hero-panel-head">
          <span>Radar állapot</span>
          <span class="pulse"></span>
        </div>
        <div class="hero-stats" id="stats"></div>
        <p class="hero-note">
          A lista naponta frissül. A részletek minden esetben a hivatalos forrásból ellenőrizendők.
        </p>
      </div>
    </section>

    <section class="controls">
      <div class="search-wrap">
        <span class="search-icon" aria-hidden="true">⌕</span>
        <input
          id="search"
          type="search"
          placeholder="Keresés: mozi, múzeum, ingyenes, Balaton..."
          autocomplete="off"
          aria-label="Keresés a dealek között"
        />
      </div>

      <div class="filter-block">
        <span class="filter-label">Típus</span>
        <div class="chips" id="type-filters">
          ${TYPE_FILTERS.map(
            (filter) => `
              <button
                class="chip"
                type="button"
                data-filter-type="${filter.value}"
                aria-pressed="false"
              >${filter.label}</button>
            `
          ).join('')}
        </div>
      </div>

      <div class="filter-block">
        <span class="filter-label">Kategória</span>
        <div class="chips" id="category-filters">
          ${CATEGORY_FILTERS.map(
            (filter) => `
              <button
                class="chip"
                type="button"
                data-filter-category="${filter.value}"
                aria-pressed="false"
              >${filter.label}</button>
            `
          ).join('')}
        </div>
      </div>

      <div class="filter-row">
        <label class="select-wrap">
          <span>Helyszín</span>
          <select id="location-filter">
            <option value="all">Minden helyszín</option>
            ${locations
              .map(
                (location) =>
                  `<option value="${escapeHtml(location)}">${escapeHtml(location)}</option>`
              )
              .join('')}
          </select>
        </label>

        <label class="select-wrap">
          <span>Rendezés</span>
          <select id="sort-filter">
            <option value="next">Legközelebbi</option>
            <option value="value">Legjobb érték</option>
            <option value="title">ABC</option>
          </select>
        </label>
      </div>
    </section>

    <main id="results" class="results"></main>

    <footer class="site-footer">
      <div class="footer-brand">
        <span class="brand-mark small" aria-hidden="true">
          <span></span><span></span><span></span>
        </span>
        <div>
          <strong>Big-deal radar</strong>
          <p>Ritka, nagy dobások. Nem a napi aprókedvezmények.</p>
        </div>
      </div>
      <div id="footer-status" class="footer-status"></div>
      <div class="footer-links">
        <a href="${escapeHtml(repoUrl())}" target="_blank" rel="noopener">GitHub</a>
        <a href="#results">Vissza a tetejére</a>
      </div>
    </footer>
  `;
}

function updateStatusBanner(): void {
  const messages: string[] = [];

  if (status?.errors?.length) {
    messages.push(`A legutóbbi futás hibát jelzett: ${status.errors[0]}`);
  }

  if (status?.last_run) {
    const age = Date.now() - new Date(status.last_run).getTime();
    const fortyEightHours = 48 * 60 * 60 * 1000;
    if (age > fortyEightHours) {
      messages.push(
        'Az adat több mint 48 órás. Indítsd el a napi pipeline-t, vagy nézd meg a GitHub Actions futását.'
      );
    }
  }

  if (messages.length === 0) return;

  const banner = document.createElement('div');
  banner.className = 'error-banner';
  banner.textContent = messages.join(' ');
  document.querySelector('.controls')?.after(banner);
}

function openDialog(id: string): void {
  const deal = enriched.find((item) => item.id === id);
  if (!deal) return;

  const source = deal.source_url
    ? `<a class="btn btn-ghost" href="${escapeHtml(deal.source_url)}" target="_blank" rel="noopener">Forrás megnyitása</a>`
    : '<span class="muted">Forrás hamarosan</span>';

  dialogEl.dataset.dealId = deal.id;
  dialogEl.innerHTML = `
    <div class="dialog-head">
      <div>
        <span class="badge badge-${deal.type}">${typeLabel(deal.type)}</span>
        <h2>${escapeHtml(deal.title)}</h2>
      </div>
      <button class="dialog-close" data-dialog-action="close" type="button" aria-label="Bezárás">×</button>
    </div>
    <p class="dialog-date">${escapeHtml(deal.dateLabel)} · ${escapeHtml(deal.location)}</p>
    <p class="dialog-deal">${escapeHtml(deal.deal)}</p>
    <div class="dialog-grid">
      <div><span>Normál ár</span><strong>${deal.normal_price !== null ? formatHuf(deal.normal_price) : '—'}</strong></div>
      <div><span>Deal ár</span><strong>${deal.deal_price !== null ? formatHuf(deal.deal_price) : '—'}</strong></div>
      <div><span>Megtakarítás</span><strong>${deal.discount !== null ? `${Math.round(deal.discount * 100)}%` : '—'}</strong></div>
      <div><span>Bizonyosság</span><strong>${deal.confidence === 'verified' ? 'Ellenőrzött' : deal.confidence === 'needs-check' ? 'Ellenőrizendő' : 'Nem ellenőrzött'}</strong></div>
    </div>
    ${
      deal.notes
        ? `<p class="dialog-notes">${escapeHtml(deal.notes)}</p>`
        : ''
    }
    <div class="dialog-actions">
      <button class="btn btn-solid" data-dialog-action="ics" type="button" ${deal.effective ? '' : 'disabled'}>Naptárba</button>
      ${source}
    </div>
  `;

  dialogEl.showModal();
}

function downloadIcs(id: string): void {
  const deal = enriched.find((item) => item.id === id);
  if (!deal) return;

  if (!deal.effective) {
    showToast('Ehhez a dealhez nincs pontos dátum – nézd a „Mikor” mezőt.');
    return;
  }

  const start = deal.effective.start;
  const end = deal.effective.end ?? start;
  const icsDate = (date: Date) =>
    `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
      date.getDate()
    ).padStart(2, '0')}`;
  const icsDateTime = (date: Date) =>
    `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;

  const escapeIcs = (value: string) =>
    value
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');

  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Big-deal radar//HU',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${deal.id}@big-deal-radar`,
    `DTSTAMP:${icsDateTime(new Date())}`,
    `DTSTART;VALUE=DATE:${icsDate(start)}`,
    `DTEND;VALUE=DATE:${icsDate(addDays(end, 1))}`,
    `SUMMARY:${escapeIcs(deal.title)}`,
    `DESCRIPTION:${escapeIcs(deal.deal)}`,
    `LOCATION:${escapeIcs(deal.location)}`,
    ...(deal.source_url ? [`URL:${deal.source_url}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${deal.id}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('Naptárbejegyzés letöltve.');
}

let toastTimer: number | undefined;

function showToast(message: string): void {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.classList.remove('show');
  }, 3200);
}

function handleAction(action: string, target: HTMLElement): void {
  if (action === 'more') {
    state.visible += 24;
    renderResults();
    return;
  }

  if (action === 'jump-flat') {
    state.type = 'flat';
    state.category = 'all';
    state.location = 'all';
    state.query = '';
    state.sort = 'next';
    state.visible = 24;

    const search = document.querySelector<HTMLInputElement>('#search');
    const location = document.querySelector<HTMLSelectElement>('#location-filter');
    const sort = document.querySelector<HTMLSelectElement>('#sort-filter');
    if (search) search.value = '';
    if (location) location.value = 'all';
    if (sort) sort.value = 'next';

    updateFilterButtons();
    renderResults();
    document.querySelector('#results')?.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  const card = target.closest<HTMLElement>('.deal-card');
  if (!card?.dataset.id) return;

  if (action === 'details') openDialog(card.dataset.id);
  if (action === 'ics') downloadIcs(card.dataset.id);
}

appRoot.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;

  const typeButton = target.closest<HTMLButtonElement>('[data-filter-type]');
  if (typeButton) {
    state.type = typeButton.dataset.filterType as 'all' | DealType;
    state.visible = 24;
    updateFilterButtons();
    renderResults();
    return;
  }

  const categoryButton = target.closest<HTMLButtonElement>('[data-filter-category]');
  if (categoryButton) {
    state.category = categoryButton.dataset.filterCategory as 'all' | DealCategory;
    state.visible = 24;
    updateFilterButtons();
    renderResults();
    return;
  }

  const actionTarget = target.closest<HTMLElement>('[data-action]');
  if (actionTarget?.dataset.action) {
    handleAction(actionTarget.dataset.action, actionTarget);
  }
});

appRoot.addEventListener('input', (event) => {
  const target = event.target as HTMLInputElement;
  if (target.id !== 'search') return;
  state.query = target.value;
  state.visible = 24;
  renderResults();
});

appRoot.addEventListener('change', (event) => {
  const target = event.target as HTMLSelectElement;

  if (target.id === 'location-filter') {
    state.location = target.value;
    state.visible = 24;
    renderResults();
  }

  if (target.id === 'sort-filter') {
    state.sort = target.value as SortMode;
    renderResults();
  }
});

dialogEl.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const action = target.closest<HTMLElement>('[data-dialog-action]')?.dataset
    .dialogAction;

  if (action === 'close' || target === dialogEl) {
    dialogEl.close();
    return;
  }

  if (action === 'ics') {
    const dealId = dialogEl.dataset.dealId;
    if (dealId) downloadIcs(dealId);
  }
});

async function fetchStatus(): Promise<void> {
  try {
    const response = await fetch('./status.json', { cache: 'no-store' });
    if (!response.ok) return;
    status = (await response.json()) as StatusData;
  } catch {
    status = null;
  }
}

async function init(): Promise<void> {
  renderShell();
  renderStats();
  updateFilterButtons();
  renderResults();
  await fetchStatus();
  renderFooter();
  updateStatusBanner();
  renderDebug();
}

void init();
