import './style.css';
import dealsData from '../../data/deals.json';
import type { Deal, DealCategory, DealType } from '../types';
import {
  addDays,
  diffDays,
  effectiveDateLabel,
  formatHuf,
  formatHuDate,
  isInMonth,
  monthLabel,
  nextOccurrence,
  parseISODate,
  startOfDay,
  valueScore,
  type EffectiveDate,
} from '../utils/dates';
import {
  loadWatchlist,
  priorityLabel,
  saveWatchlist,
  watchCount,
  type Priority,
  type Watchlist,
} from './watchlist';

type StatusKind = 'live' | 'upcoming' | 'past' | 'continuous' | 'unknown';
type SortMode = 'next' | 'value' | 'title';
type Focus = 'all' | 'mozi' | 'gasztro' | 'program' | 'unnep' | 'free';
type TimeFilter = 'all' | 'today' | 'weekend' | 'next7';
type BudgetFilter = 'all' | 'free' | 'under5' | 'under10' | 'over10';
type ViewMode = 'list' | 'calendar';

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

const FOCUS_FILTERS: Array<{ value: Focus; label: string }> = [
  { value: 'all', label: 'Mind' },
  { value: 'mozi', label: '🎬 Mozi' },
  { value: 'gasztro', label: '🍽️ Ételek' },
  { value: 'program', label: '🎉 Programok' },
  { value: 'unnep', label: '🎂 Ünnepek' },
  { value: 'free', label: '🆓 Ingyenes' },
];

const TIME_FILTERS: Array<{ value: TimeFilter; label: string }> = [
  { value: 'all', label: 'Mind' },
  { value: 'today', label: 'Ma' },
  { value: 'weekend', label: 'Hétvége' },
  { value: 'next7', label: '7 nap' },
];

const BUDGET_FILTERS: Array<{ value: BudgetFilter; label: string }> = [
  { value: 'all', label: 'Mind' },
  { value: 'free', label: 'Ingyenes' },
  { value: 'under5', label: '5 ezer alatt' },
  { value: 'under10', label: '10 ezer alatt' },
  { value: 'over10', label: '10 ezer felett' },
];

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
  watchlistOnly: false,
  focus: 'all' as Focus,
  time: 'all' as TimeFilter,
  budget: 'all' as BudgetFilter,
  view: 'list' as ViewMode,
  calendarMonth: new Date(now.getFullYear(), now.getMonth(), 1),
};

let watchlist: Watchlist = loadWatchlist();

function isWatched(id: string): boolean {
  return Boolean(watchlist[id]);
}

function priorityOf(id: string): Priority {
  return watchlist[id]?.priority ?? 0;
}

function setWatchPriority(id: string, priority: Priority): void {
  if (priority <= 0) {
    delete watchlist[id];
  } else {
    const existing = watchlist[id];
    watchlist[id] = {
      id,
      priority,
      addedAt: existing?.addedAt ?? new Date().toISOString(),
    };
  }

  saveWatchlist(watchlist);
  updateWatchCount();
  renderResults();
}

function toggleWatch(id: string): void {
  if (isWatched(id)) {
    delete watchlist[id];
    showToast('Kivetted a dealet a saját listádból.');
  } else {
    watchlist[id] = {
      id,
      priority: 1,
      addedAt: new Date().toISOString(),
    };
    showToast('Hozzáadva a saját listához. A részleteknél csillaggal prioritást adhatsz.');
  }

  saveWatchlist(watchlist);
  updateWatchCount();
  renderResults();
}

function updateWatchCount(): void {
  const count = watchCount(watchlist);
  document.querySelectorAll<HTMLElement>('[data-watch-count]').forEach((element) => {
    element.textContent = String(count);
  });

  const button = document.querySelector<HTMLButtonElement>(
    '[data-action="toggle-watchlist"]'
  );
  if (button) {
    button.classList.toggle('active', state.watchlistOnly);
    button.setAttribute('aria-pressed', state.watchlistOnly ? 'true' : 'false');
  }
}

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

function sourcesMarkup(deal: EnrichedDeal): string {
  if (deal.sources.length === 0) {
    return '<p class="muted">Forrás hamarosan.</p>';
  }

  return `
    <div class="source-list">
      ${deal.sources
        .map(
          (source) => `
            <a
              class="source-item"
              href="${escapeHtml(source.url)}"
              target="_blank"
              rel="noopener"
              data-link-preview="${escapeHtml(source.url)}"
              data-link-label="${escapeHtml(source.label)}"
            >
              <span class="source-type source-${source.type}">${sourceTypeLabel(source.type)}</span>
              <span class="source-label">${escapeHtml(source.label)}</span>
              <span class="source-domain">${escapeHtml(domainOf(source.url))}</span>
            </a>
          `
        )
        .join('')}
    </div>
    <p class="source-hint">Tartsd az egeret a linken 3 mp-ig, és megmutatja a teljes URL-t.</p>
  `;
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
  const watched = isWatched(deal.id);
  const priority = priorityOf(deal.id);
  const priorityTag = watched
    ? `<span class="tag tag-priority">${'★'.repeat(priority)} ${priorityLabel(priority)}</span>`
    : '';
  const tags = deal.tags
    .filter((tag) => tag !== deal.category && tag !== deal.type)
    .slice(0, 3)
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join('');

  return `
    <article class="deal-card type-${deal.type}" data-id="${escapeHtml(deal.id)}">
      <div class="card-top">
        <span class="badge badge-${deal.type}">${typeLabel(deal.type)}</span>
        <div class="card-top-right">
          <span class="status status-${deal.status}">${statusLabel(deal)}</span>
          <button class="watch-btn ${watched ? 'active' : ''}" data-action="watch" type="button" aria-pressed="${watched}" title="${watched ? `Követve – ${priorityLabel(priority)}` : 'Követem'}">${watched ? '★' : '☆'}</button>
        </div>
      </div>
      <h3 class="card-title">${escapeHtml(deal.title)}</h3>
      <p class="card-date">${escapeHtml(deal.dateLabel)} <span class="card-location">· ${escapeHtml(deal.location)}</span></p>
      <p class="card-deal">${escapeHtml(deal.deal)}</p>
      <div class="price-row">${priceMarkup(deal)}</div>
      <div class="card-footer">
        <div class="tags">${priorityTag}${tags}</div>
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
    if (state.watchlistOnly) {
      const aPriority = priorityOf(a.id);
      const bPriority = priorityOf(b.id);
      if (aPriority !== bPriority) return bPriority - aPriority;
    }

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
  if (state.watchlistOnly && !isWatched(deal.id)) return false;
  if (state.focus === 'mozi' && deal.category !== 'mozi') return false;
  if (state.focus === 'gasztro' && deal.category !== 'gasztro') return false;
  if (state.focus === 'program' && !deal.tags.includes('program')) return false;
  if (state.focus === 'unnep' && !deal.tags.includes('unnep')) return false;
  if (state.focus === 'free' && deal.type !== 'free') return false;
  if (state.time === 'today') {
    if (!(deal.status === 'live' || deal.days === 0)) return false;
  }
  if (state.time === 'next7') {
    if (deal.days === null || deal.days < 0 || deal.days > 7) return false;
  }
  if (state.time === 'weekend') {
    if (!deal.effective) return false;
    const start = startOfDay(deal.effective.start);
    const end = startOfDay(deal.effective.end ?? deal.effective.start);
    const today = startOfDay(now);
    let isWeekend = false;
    for (let offset = 0; offset <= 14; offset += 1) {
      const day = addDays(today, offset);
      if (
        day >= start &&
        day <= end &&
        (day.getDay() === 0 || day.getDay() === 6)
      ) {
        isWeekend = true;
        break;
      }
    }
    if (!isWeekend) return false;
  }
  if (state.budget !== 'all') {
    const price = deal.deal_price;
    if (state.budget === 'free') {
      if (deal.type !== 'free' && price !== 0) return false;
    } else if (state.budget === 'under5') {
      if (price === null || price > 5000) return false;
    } else if (state.budget === 'under10') {
      if (price === null || price > 10000) return false;
    } else if (state.budget === 'over10') {
      if (price === null || price <= 10000) return false;
    }
  }
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
    state.watchlistOnly ||
    state.focus !== 'all' ||
    state.time !== 'all' ||
    state.budget !== 'all' ||
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

function datesForDealInMonth(
  deal: EnrichedDeal,
  year: number,
  month: number
): Array<{ start: Date; end: Date }> {
  if (!deal.date_start) return [];

  const refStart = parseISODate(deal.date_start);
  const refEnd = deal.date_end ? parseISODate(deal.date_end) : null;
  const startMonth = refStart.getMonth();
  const startDay = refStart.getDate();
  const endMonth = refEnd ? refEnd.getMonth() : null;
  const endDay = refEnd ? refEnd.getDate() : null;
  const endYearOffset = refEnd && endMonth! < startMonth ? 1 : 0;

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const years =
    deal.recurrence === 'oneoff'
      ? [refStart.getFullYear()]
      : [year - 1, year, year + 1];

  const results: Array<{ start: Date; end: Date }> = [];
  for (const candidateYear of years) {
    const start = new Date(candidateYear, startMonth, startDay);
    const end = refEnd
      ? new Date(candidateYear + endYearOffset, endMonth!, endDay!)
      : start;
    if (start <= monthEnd && end >= monthStart) {
      results.push({ start, end });
    }
  }

  return results;
}

function dealInDay(deal: EnrichedDeal, day: Date): boolean {
  const ranges = datesForDealInMonth(
    deal,
    day.getFullYear(),
    day.getMonth()
  );
  const target = startOfDay(day).getTime();
  return ranges.some(
    (range) =>
      target >= startOfDay(range.start).getTime() &&
      target <= startOfDay(range.end).getTime()
  );
}

function topDeals(): EnrichedDeal[] {
  const featured = enriched
    .filter((deal) => deal.featured && deal.effective)
    .sort((a, b) => (a.days ?? 999) - (b.days ?? 999));

  if (featured.length >= 5) return featured.slice(0, 5);

  const rest = enriched
    .filter((deal) => !deal.featured && deal.effective)
    .sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0));

  return [...featured, ...rest].slice(0, 5);
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
  document.querySelectorAll<HTMLButtonElement>('[data-focus]').forEach((button) => {
    const active = button.dataset.focus === state.focus;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

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

  document.querySelectorAll<HTMLButtonElement>('[data-time]').forEach((button) => {
    const active = button.dataset.time === state.time;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  document.querySelectorAll<HTMLButtonElement>('[data-budget]').forEach((button) => {
    const active = button.dataset.budget === state.budget;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
    const active = button.dataset.view === state.view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function renderCalendar(): void {
  const results = document.querySelector<HTMLElement>('#results');
  if (!results) return;

  const year = state.calendarMonth.getFullYear();
  const month = state.calendarMonth.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const monthTitle = new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: 'long',
  }).format(monthStart);

  const filtered = enriched.filter(matchesFilters);
  const monthDeals = filtered.filter(
    (deal) => datesForDealInMonth(deal, year, month).length > 0
  );

  const firstWeekday = (monthStart.getDay() + 6) % 7;
  const daysInMonth = monthEnd.getDate();
  const cells: string[] = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push('<div class="cal-cell cal-empty" aria-hidden="true"></div>');
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const dayDeals = monthDeals.filter((deal) => dealInDay(deal, date));
    const isToday =
      startOfDay(date).getTime() === startOfDay(now).getTime();

    const chips = dayDeals
      .slice(0, 3)
      .map(
        (deal) => `
          <button
            class="cal-chip type-${deal.type}"
            type="button"
            data-action="calendar-deal"
            data-id="${escapeHtml(deal.id)}"
            title="${escapeHtml(deal.title)}"
          >${escapeHtml(deal.title)}</button>
        `
      )
      .join('');

    const more =
      dayDeals.length > 3
        ? `<span class="cal-more">+${dayDeals.length - 3}</span>`
        : '';

    cells.push(`
      <div class="cal-cell${isToday ? ' cal-today' : ''}">
        <span class="cal-day">${day}</span>
        ${chips}
        ${more}
      </div>
    `);
  }

  while (cells.length % 7 !== 0) {
    cells.push('<div class="cal-cell cal-empty" aria-hidden="true"></div>');
  }

  results.innerHTML = `
    <section class="calendar-view">
      <div class="cal-head">
        <div>
          <h2>${escapeHtml(monthTitle)}</h2>
          <p>${monthDeals.length} esemény ebben a hónapban</p>
        </div>
        <div class="cal-nav">
          <button class="btn btn-ghost" data-action="cal-prev" type="button">← Előző</button>
          <button class="btn btn-ghost" data-action="cal-today" type="button">Ma</button>
          <button class="btn btn-ghost" data-action="cal-next" type="button">Következő →</button>
          <button class="btn btn-solid" data-action="ics-month" type="button" ${monthDeals.length > 0 ? '' : 'disabled'}>Hónap naptárba</button>
        </div>
      </div>

      <div class="cal-scroll">
        <div class="cal-weekdays">
          ${['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
            .map((day) => `<span>${day}</span>`)
            .join('')}
        </div>
        <div class="cal-grid">${cells.join('')}</div>
      </div>

      <p class="cal-note">
        A naptárban csak a pontos dátumú dealek vannak. A „havi / évente” jelöléssel szereplő dealek a listában találhatók.
      </p>
    </section>
  `;
}

function renderResults(): void {
  const results = document.querySelector<HTMLElement>('#results');
  if (!results) return;

  updateWatchCount();

  if (state.view === 'calendar') {
    renderCalendar();
    return;
  }

  const filtered = sortDeals(enriched.filter(matchesFilters), state.sort);

  if (state.watchlistOnly) {
    results.innerHTML = sectionMarkup(
      'Saját listám',
      `${filtered.length} követett deal – prioritás szerint`,
      filtered.slice(0, state.visible),
      'Még nincs követett deal. Kattints a kártyákon a ☆ ikonra, és itt gyűjtheted őket.'
    );

    if (filtered.some((deal) => deal.effective)) {
      results.innerHTML += `
        <div class="watchlist-actions">
          <button class="btn btn-solid" data-action="ics-all" type="button">
            ★ Saját lista naptárba
          </button>
        </div>
      `;
    }
    return;
  }

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
  const top = topDeals();
  const all = sortDeals(filtered, state.sort).slice(0, state.visible);

  const upcomingSection =
    sectionMarkup(
      'Most és a következő 7 napban',
      'Ami éppen él, vagy 7 napon belül kezdődik.',
      upcoming,
      'Nincs aktuális vagy 7 napon belüli esemény. Nézd a havi listát vagy a teljes kínálatot.'
    ) +
    (upcoming.length > 0
      ? `
        <div class="section-actions">
          <button class="btn btn-ghost" data-action="ics-upcoming" type="button">
            Következő 7 nap naptárba
          </button>
        </div>
      `
      : '');

  results.innerHTML = [
    top.length > 0
      ? sectionMarkup(
          'Heti top 5',
          'Szerkesztői válogatás – a legnagyobb dobások.',
          top
        )
      : '',
    upcomingSection,
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

function dealPageUrl(id: string): string {
  const base = window.location.href.split('?')[0].replace(/[^/]*$/, '');
  return `${base}deal/${encodeURIComponent(id)}/`;
}

function fallbackCopy(text: string): boolean {
  try {
    const input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    document.body.appendChild(input);
    input.focus();
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    return copied;
  } catch {
    return false;
  }
}

async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return fallbackCopy(text);
    }
  }
  return fallbackCopy(text);
}

function reportIssueUrl(deal: EnrichedDeal): string {
  const title = encodeURIComponent(`Hiba: ${deal.title}`);
  const body = encodeURIComponent(
    `Deal: ${deal.title}\nOldal: ${dealPageUrl(deal.id)}\n\nMit tapasztaltál?\n- Hibás ár:\n- Halott link:\n- Hibás dátum:\n\nKérlek, írd le röviden.`
  );
  return `https://github.com/Gyuri125/big-deal-radar/issues/new?title=${title}&body=${body}`;
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

    <section class="how-it-works" aria-label="Hogyan ne maradj le">
      <div class="how-step">
        <span class="step-num">1</span>
        <div><strong>Követem</strong><p>Csillagozd be, ami érdekel.</p></div>
      </div>
      <div class="how-step">
        <span class="step-num">2</span>
        <div><strong>Prioritás</strong><p>Fontos / kiemelt sorrend.</p></div>
      </div>
      <div class="how-step">
        <span class="step-num">3</span>
        <div><strong>Naptárba</strong><p>14 nappal, 7 nappal, 1 nappal és aznap emlékeztet.</p></div>
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
        <div class="view-toggle" role="group" aria-label="Nézet">
          <button class="chip active" type="button" data-view="list" aria-pressed="true">Lista</button>
          <button class="chip" type="button" data-view="calendar" aria-pressed="false">Naptár</button>
        </div>
      </div>

      <div class="filter-block focus-block">
        <span class="filter-label">Nekem</span>
        <div class="chips" id="focus-filters">
          ${FOCUS_FILTERS.map(
            (filter) => `
              <button
                class="chip"
                type="button"
                data-focus="${filter.value}"
                aria-pressed="false"
              >${filter.label}</button>
            `
          ).join('')}
        </div>
      </div>

      <div class="filter-block">
        <span class="filter-label">Mikor</span>
        <div class="chips" id="time-filters">
          ${TIME_FILTERS.map(
            (filter) => `
              <button class="chip" type="button" data-time="${filter.value}" aria-pressed="false">${filter.label}</button>
            `
          ).join('')}
        </div>
      </div>

      <div class="filter-block">
        <span class="filter-label">Ár</span>
        <div class="chips" id="budget-filters">
          ${BUDGET_FILTERS.map(
            (filter) => `
              <button class="chip" type="button" data-budget="${filter.value}" aria-pressed="false">${filter.label}</button>
            `
          ).join('')}
        </div>
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
        <span class="filter-label">Saját</span>
        <div class="chips">
          <button class="chip watch-filter" type="button" data-action="toggle-watchlist" aria-pressed="false">
            ★ Saját listám <span class="watch-count" data-watch-count>0</span>
          </button>
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

  const watched = isWatched(deal.id);
  const priority = priorityOf(deal.id);
  const hasPrice = deal.normal_price !== null || deal.deal_price !== null;

  const priceCells = hasPrice
    ? `
      <div><span>Normál ár</span><strong>${deal.normal_price !== null ? formatHuf(deal.normal_price) : '—'}</strong></div>
      <div><span>Deal ár</span><strong>${deal.deal_price !== null ? formatHuf(deal.deal_price) : '—'}</strong></div>
      <div><span>Megtakarítás</span><strong>${deal.discount !== null ? `${Math.round(deal.discount * 100)}%` : '—'}</strong></div>
    `
    : `<div><span>Ár</span><strong>${deal.type === 'free' ? 'Ingyenes' : 'A forrásban'}</strong></div>`;

  const confidenceLabel =
    deal.confidence === 'verified'
      ? `Ellenőrzött${deal.last_checked ? ` · ${formatHuDate(parseISODate(deal.last_checked))}` : ''}`
      : deal.confidence === 'needs-check'
        ? 'Ellenőrizendő'
        : 'Nem ellenőrzött';

  const priorityButtons = [1, 2, 3]
    .map(
      (value) => `
        <button
          class="priority-btn ${priority >= value ? 'active' : ''}"
          data-dialog-priority="${value}"
          type="button"
          aria-label="${priorityLabel(value as Priority)}"
          title="${priorityLabel(value as Priority)}"
        >★</button>
      `
    )
    .join('');

  const bookingLink = deal.booking_url
    ? `<a class="btn btn-solid" href="${escapeHtml(deal.booking_url)}" target="_blank" rel="noopener" data-link-preview="${escapeHtml(deal.booking_url)}" data-link-label="Jegyvásárlás / foglalás">Jegyvásárlás / foglalás</a>`
    : '';

  const sources = sourcesMarkup(deal);

  dialogEl.dataset.dealId = deal.id;
  history.replaceState(null, '', `?deal=${encodeURIComponent(deal.id)}`);
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

    <div class="dialog-priority">
      <div>
        <span>Prioritás</span>
        <p>Csak ebben a böngészőben tárolódik.</p>
      </div>
      <div class="priority-buttons">
        ${priorityButtons}
        ${watched ? `<button class="priority-clear" data-dialog-priority="0" type="button">Törlés</button>` : ''}
      </div>
    </div>

    <div class="dialog-grid">
      ${priceCells}
      <div><span>Bizonyosság</span><strong>${confidenceLabel}</strong></div>
      ${
        deal.booking_opens
          ? `<div><span>Foglalás nyílik</span><strong>${formatHuDate(parseISODate(deal.booking_opens))}</strong></div>`
          : ''
      }
    </div>
    ${
      deal.price_note
        ? `<p class="dialog-price-note">${escapeHtml(deal.price_note)}</p>`
        : ''
    }
    ${
      deal.booking_note
        ? `<p class="dialog-booking-note"><strong>Jegyvásárlás:</strong> ${escapeHtml(deal.booking_note)}</p>`
        : ''
    }
    ${
      deal.notes
        ? `<p class="dialog-notes">${escapeHtml(deal.notes)}</p>`
        : ''
    }

    <div class="dialog-sources">
      <h3>Források <span>${deal.sources.length}</span></h3>
      ${sources}
    </div>

    <div class="dialog-actions">
      <button class="btn btn-solid" data-dialog-action="ics" type="button" ${deal.effective ? '' : 'disabled'}>Naptárba emlékeztetővel</button>
      ${bookingLink}
      <button class="btn btn-ghost" data-dialog-action="share" type="button">Megosztás</button>
      <a class="btn btn-ghost" href="${reportIssueUrl(deal)}" target="_blank" rel="noopener">Hibát jelentek</a>
    </div>
    ${
      deal.effective
        ? '<p class="dialog-hint">A naptárbejegyzés 14 nappal előtte, 7 nappal előtte, 1 nappal előtte és aznap emlékeztet.</p>'
        : ''
    }
  `;

  dialogEl.showModal();
}

function icsDate(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function icsDateTime(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function alarmLines(summary: string): string[] {
  const description = escapeIcs(`Big-deal radar: ${summary}`);
  return ['-P14D', '-P7D', '-P1D', 'PT0S'].flatMap((trigger) => [
    'BEGIN:VALARM',
    `TRIGGER:${trigger}`,
    'ACTION:DISPLAY',
    `DESCRIPTION:${description}`,
    'END:VALARM',
  ]);
}

function eventLines(
  deal: EnrichedDeal,
  override?: { start: Date; end: Date }
): string[] {
  const start = override?.start ?? deal.effective?.start;
  if (!start) return [];
  const end = override?.end ?? deal.effective?.end ?? start;

  const lines = [
    'BEGIN:VEVENT',
    `UID:${deal.id}@big-deal-radar`,
    `DTSTAMP:${icsDateTime(new Date())}`,
    `DTSTART;VALUE=DATE:${icsDate(start)}`,
    `DTEND;VALUE=DATE:${icsDate(addDays(end, 1))}`,
    `SUMMARY:${escapeIcs(deal.title)}`,
    `DESCRIPTION:${escapeIcs(
      `${deal.deal}${deal.booking_note ? `\n\nJegyvásárlás: ${deal.booking_note}` : ''}`
    )}`,
    `LOCATION:${escapeIcs(deal.location)}`,
    ...(deal.source_url ? [`URL:${deal.source_url}`] : []),
    ...alarmLines(deal.title),
    'END:VEVENT',
  ];

  if (deal.booking_opens && !override) {
    const bookingDate = parseISODate(deal.booking_opens);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${deal.id}-booking@big-deal-radar`,
      `DTSTAMP:${icsDateTime(new Date())}`,
      `DTSTART;VALUE=DATE:${icsDate(bookingDate)}`,
      `DTEND;VALUE=DATE:${icsDate(addDays(bookingDate, 1))}`,
      `SUMMARY:${escapeIcs(`Foglalás nyílik: ${deal.title}`)}`,
      `DESCRIPTION:${escapeIcs(deal.booking_note ?? deal.deal)}`,
      ...alarmLines(`Foglalás nyílik: ${deal.title}`),
      'END:VEVENT'
    );
  }

  return lines;
}

function downloadBlob(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadIcs(id: string): void {
  const deal = enriched.find((item) => item.id === id);
  if (!deal) return;

  if (!deal.effective) {
    showToast('Ehhez a dealhez nincs pontos dátum – nézd a „Mikor” mezőt.');
    return;
  }

  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Big-deal radar//HU',
    'CALSCALE:GREGORIAN',
    ...eventLines(deal),
    'END:VCALENDAR',
  ].join('\r\n');

  downloadBlob(content, `${deal.id}.ics`);
  showToast(
    'Naptárbejegyzés letöltve – 14 nappal előtte, 7 nappal előtte, 1 nappal előtte és aznap emlékeztet.'
  );
}

function downloadWatchlistIcs(): void {
  const watched = enriched
    .filter((deal) => isWatched(deal.id) && deal.effective)
    .sort((a, b) => {
      const priorityDiff = priorityOf(b.id) - priorityOf(a.id);
      if (priorityDiff !== 0) return priorityDiff;
      return (a.days ?? Number.MAX_SAFE_INTEGER) - (b.days ?? Number.MAX_SAFE_INTEGER);
    });

  if (watched.length === 0) {
    showToast('A saját listán nincs dátumos deal, amit naptárba tehetnék.');
    return;
  }

  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Big-deal radar//HU',
    'CALSCALE:GREGORIAN',
    ...watched.flatMap((deal) => eventLines(deal)),
    'END:VCALENDAR',
  ].join('\r\n');

  downloadBlob(content, 'big-deal-radar-sajat-lista.ics');
  showToast(
    `${watched.length} követett deal hozzáadva a naptárhoz, emlékeztetőkkel.`
  );
}

function downloadUpcomingIcs(): void {
  const deals = upcomingDeals().filter((deal) => deal.effective);

  if (deals.length === 0) {
    showToast('Nincs dátumos esemény a következő 7 napban.');
    return;
  }

  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Big-deal radar//HU',
    'CALSCALE:GREGORIAN',
    ...deals.flatMap((deal) => eventLines(deal)),
    'END:VCALENDAR',
  ].join('\r\n');

  downloadBlob(content, 'big-deal-radar-kovetkezo-7-nap.ics');
  showToast(
    `${deals.length} esemény hozzáadva a naptárhoz, emlékeztetőkkel.`
  );
}

function downloadMonthIcs(year: number, month: number): void {
  const deals = enriched.filter(matchesFilters);
  const events: string[] = [];

  for (const deal of deals) {
    for (const range of datesForDealInMonth(deal, year, month)) {
      events.push(...eventLines(deal, range));
    }
  }

  if (events.length === 0) {
    showToast('Ebben a hónapban nincs dátumos deal a jelenlegi szűrésben.');
    return;
  }

  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Big-deal radar//HU',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  const monthName = new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(year, month, 1));

  downloadBlob(
    content,
    `big-deal-radar-${year}-${String(month + 1).padStart(2, '0')}.ics`
  );
  showToast(`${monthName} naptárba letöltve.`);
}

const linkTooltip = document.createElement('div');
linkTooltip.className = 'link-tooltip';
linkTooltip.id = 'link-tooltip';
linkTooltip.setAttribute('role', 'tooltip');
linkTooltip.setAttribute('aria-label', 'Link előnézet');
document.body.appendChild(linkTooltip);

let linkTooltipTimer: number | undefined;
let activeLink: HTMLElement | null = null;

function showLinkTooltip(link: HTMLElement): void {
  const url = link.dataset.linkPreview;
  if (!url) return;

  const label = link.dataset.linkLabel ?? 'Link';
  activeLink = link;
  linkTooltip.innerHTML = `<strong>${escapeHtml(label)}</strong><span>${escapeHtml(url)}</span>`;

  const width = Math.min(380, window.innerWidth - 24);
  const rect = link.getBoundingClientRect();
  const left = Math.min(
    Math.max(12, rect.left),
    window.innerWidth - width - 12
  );
  const top = Math.min(rect.bottom + 10, window.innerHeight - 90);

  linkTooltip.style.width = `${width}px`;
  linkTooltip.style.left = `${left}px`;
  linkTooltip.style.top = `${top}px`;
  linkTooltip.classList.add('show');
}

function hideLinkTooltip(): void {
  window.clearTimeout(linkTooltipTimer);
  linkTooltip.classList.remove('show');
  activeLink = null;
}

function scheduleLinkTooltip(link: HTMLElement, delay = 3000): void {
  window.clearTimeout(linkTooltipTimer);
  linkTooltip.classList.remove('show');
  linkTooltipTimer = window.setTimeout(() => showLinkTooltip(link), delay);
}

document.addEventListener('mouseover', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>(
    '[data-link-preview]'
  );
  if (!target || activeLink === target) return;
  scheduleLinkTooltip(target, 3000);
});

document.addEventListener('mouseout', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>(
    '[data-link-preview]'
  );
  if (!target) return;
  const related = event.relatedTarget as Node | null;
  if (related && target.contains(related)) return;
  hideLinkTooltip();
});

document.addEventListener('focusin', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>(
    '[data-link-preview]'
  );
  if (!target) return;
  scheduleLinkTooltip(target, 0);
});

document.addEventListener('focusout', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>(
    '[data-link-preview]'
  );
  if (!target) return;
  hideLinkTooltip();
});

window.addEventListener('scroll', hideLinkTooltip, { passive: true });
window.addEventListener('resize', hideLinkTooltip);

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

  if (action === 'cal-prev' || action === 'cal-next' || action === 'cal-today') {
    const year = state.calendarMonth.getFullYear();
    const month = state.calendarMonth.getMonth();
    if (action === 'cal-prev') {
      state.calendarMonth = new Date(year, month - 1, 1);
    } else if (action === 'cal-next') {
      state.calendarMonth = new Date(year, month + 1, 1);
    } else {
      state.calendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    renderResults();
    return;
  }

  if (action === 'ics-month') {
    downloadMonthIcs(
      state.calendarMonth.getFullYear(),
      state.calendarMonth.getMonth()
    );
    return;
  }

  if (action === 'ics-upcoming') {
    downloadUpcomingIcs();
    return;
  }

  if (action === 'calendar-deal') {
    const id = target.closest<HTMLElement>('[data-action="calendar-deal"]')
      ?.dataset.id;
    if (id) openDialog(id);
    return;
  }

  if (action === 'jump-flat') {
    state.type = 'flat';
    state.category = 'all';
    state.location = 'all';
    state.query = '';
    state.sort = 'next';
    state.visible = 24;
    state.watchlistOnly = false;
    state.focus = 'all';
    state.time = 'all';
    state.budget = 'all';

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

  if (action === 'toggle-watchlist') {
    state.watchlistOnly = !state.watchlistOnly;
    state.visible = 24;

    if (state.watchlistOnly) {
      state.focus = 'all';
      state.time = 'all';
      state.budget = 'all';
      state.type = 'all';
      state.category = 'all';
      state.location = 'all';
      state.query = '';
      state.sort = 'next';

      const search = document.querySelector<HTMLInputElement>('#search');
      const location = document.querySelector<HTMLSelectElement>('#location-filter');
      const sort = document.querySelector<HTMLSelectElement>('#sort-filter');
      if (search) search.value = '';
      if (location) location.value = 'all';
      if (sort) sort.value = 'next';
      updateFilterButtons();
    }

    updateWatchCount();
    renderResults();
    document.querySelector('#results')?.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  if (action === 'ics-all') {
    downloadWatchlistIcs();
    return;
  }

  const card = target.closest<HTMLElement>('.deal-card');
  if (!card?.dataset.id) return;

  if (action === 'watch') toggleWatch(card.dataset.id);
  if (action === 'details') openDialog(card.dataset.id);
  if (action === 'ics') downloadIcs(card.dataset.id);
}

appRoot.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;

  const viewButton = target.closest<HTMLButtonElement>('[data-view]');
  if (viewButton) {
    state.view = viewButton.dataset.view as ViewMode;
    updateFilterButtons();
    renderResults();
    return;
  }

  const timeButton = target.closest<HTMLButtonElement>('[data-time]');
  if (timeButton) {
    state.time = timeButton.dataset.time as TimeFilter;
    updateFilterButtons();
    renderResults();
    return;
  }

  const budgetButton = target.closest<HTMLButtonElement>('[data-budget]');
  if (budgetButton) {
    state.budget = budgetButton.dataset.budget as BudgetFilter;
    updateFilterButtons();
    renderResults();
    return;
  }

  const focusButton = target.closest<HTMLButtonElement>('[data-focus]');
  if (focusButton) {
    state.focus = focusButton.dataset.focus as Focus;
    state.type = 'all';
    state.category = 'all';
    state.location = 'all';
    state.query = '';
    state.watchlistOnly = false;
    state.time = 'all';
    state.budget = 'all';
    state.visible = 24;

    const search = document.querySelector<HTMLInputElement>('#search');
    const location = document.querySelector<HTMLSelectElement>('#location-filter');
    if (search) search.value = '';
    if (location) location.value = 'all';

    updateFilterButtons();
    renderResults();
    return;
  }

  const typeButton = target.closest<HTMLButtonElement>('[data-filter-type]');
  if (typeButton) {
    state.focus = 'all';
    state.type = typeButton.dataset.filterType as 'all' | DealType;
    state.visible = 24;
    updateFilterButtons();
    renderResults();
    return;
  }

  const categoryButton = target.closest<HTMLButtonElement>('[data-filter-category]');
  if (categoryButton) {
    state.focus = 'all';
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

  const priorityTarget = target.closest<HTMLElement>('[data-dialog-priority]');
  if (priorityTarget) {
    const dealId = dialogEl.dataset.dealId;
    if (dealId) {
      const priority = Number(priorityTarget.dataset.dialogPriority) as Priority;
      dialogEl.close();
      setWatchPriority(dealId, priority);
      showToast(
        priority === 0
          ? 'Követés törölve.'
          : `Prioritás beállítva: ${priorityLabel(priority)}.`
      );
      openDialog(dealId);
    }
    return;
  }

  const action = target.closest<HTMLElement>('[data-dialog-action]')?.dataset
    .dialogAction;

  if (action === 'close' || target === dialogEl) {
    dialogEl.close();
    return;
  }

  if (action === 'share') {
    const dealId = dialogEl.dataset.dealId;
    const deal = dealId ? enriched.find((item) => item.id === dealId) : null;
    if (!deal) return;

    const url = dealPageUrl(deal.id);
    void (async () => {
      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      if (navigator.share && isMobile) {
        try {
          await navigator.share({ title: deal.title, text: deal.deal, url });
          return;
        } catch {
          // A felhasználó bezárta a megosztást; essünk vissza a linkmásolásra.
        }
      }

      const copied = await copyText(url);
      showToast(
        copied
          ? 'Link másolva a vágólapra.'
          : 'A linket nem sikerült vágólapra tenni – nyisd meg a deal oldalát.'
      );
      if (!copied) {
        window.open(url, '_blank', 'noopener');
      }
    })();
    return;
  }

  if (action === 'ics') {
    const dealId = dialogEl.dataset.dealId;
    if (dealId) downloadIcs(dealId);
  }
});

dialogEl.addEventListener('close', () => {
  if (new URLSearchParams(window.location.search).has('deal')) {
    const url = new URL(window.location.href);
    url.searchParams.delete('deal');
    history.replaceState(null, '', url);
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

function openDealFromQuery(): void {
  const id = new URLSearchParams(window.location.search).get('deal');
  if (!id) return;
  if (enriched.some((deal) => deal.id === id)) {
    openDialog(id);
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
  openDealFromQuery();
}

void init();

if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => {
      // A service worker hibája ne befolyásolja az oldal működését.
    });
  });
}
