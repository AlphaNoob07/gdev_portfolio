export interface PublicStatsResult {
  ok: true;
  launchDate: string;
  totals: {
    visits: number;
    uniques: number;
    pageviews: number;
  };
  activeNow: number;
}

export interface PublicStatsError {
  ok: false;
  error: 'Stats unavailable';
}

export type PublicStatsResponse = PublicStatsResult | PublicStatsError;

export interface MetricRow {
  x: string;
  y: number;
}

export interface PageviewPoint {
  x: string;
  y: number;
}

export interface AdminAnalyticsData {
  ok: true;
  rangeDays: 30 | 90;
  totals: {
    visits: number;
    uniques: number;
    pageviews: number;
  };
  activeNow: number;
  series: PageviewPoint[];
  referrers: MetricRow[];
  countries: MetricRow[];
  pages: MetricRow[];
  events: MetricRow[];
}

const SUMMARY_TTL_MS = 5 * 60 * 1000;
const ACTIVE_TTL_MS = 60 * 1000;

let cachedTotals: {
  key: string;
  expiresAt: number;
  value: { visits: number; uniques: number; pageviews: number };
} | null = null;

let cachedActive: {
  key: string;
  expiresAt: number;
  value: number;
} | null = null;

function extractMetricValue(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (
    raw &&
    typeof raw === 'object' &&
    'value' in raw &&
    typeof (raw as { value?: unknown }).value === 'number'
  ) {
    return (raw as { value: number }).value;
  }
  return null;
}

function getUmamiConfig(): {
  apiBase: string;
  apiKey: string;
  websiteId: string;
  launchDate: string;
} | null {
  const apiKey = process.env.UMAMI_API_KEY?.trim();
  const websiteId = process.env.UMAMI_WEBSITE_ID?.trim();
  if (!apiKey || !websiteId) return null;

  const apiBase = (
    process.env.UMAMI_API_BASE?.trim() || 'https://api.umami.is/v1'
  ).replace(/\/+$/, '');
  const launchDate = process.env.SITE_LAUNCH_DATE?.trim() || '2026-11-25';

  return { apiBase, apiKey, websiteId, launchDate };
}

async function umamiFetch<T>(
  path: string,
  config: { apiBase: string; apiKey: string }
): Promise<T> {
  const res = await fetch(`${config.apiBase}${path}`, {
    headers: {
      'x-umami-api-key': config.apiKey,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`Umami API ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchUmamiActive(config: {
  apiBase: string;
  apiKey: string;
  websiteId: string;
}): Promise<number> {
  const cacheKey = `${config.apiBase}:${config.websiteId}`;
  if (cachedActive && cachedActive.key === cacheKey && cachedActive.expiresAt > Date.now()) {
    return cachedActive.value;
  }

  const raw = await umamiFetch<unknown>(
    `/websites/${encodeURIComponent(config.websiteId)}/active`,
    config
  );

  let active = 0;
  if (typeof raw === 'number') {
    active = raw;
  } else if (Array.isArray(raw) && raw[0] && typeof raw[0] === 'object') {
    const val = (raw[0] as { x?: unknown; visitors?: unknown }).visitors ?? (raw[0] as { x?: unknown }).x;
    active = typeof val === 'number' ? val : 0;
  } else if (raw && typeof raw === 'object' && 'visitors' in raw) {
    const val = (raw as { visitors?: unknown }).visitors;
    active = typeof val === 'number' ? val : 0;
  }

  cachedActive = {
    key: cacheKey,
    expiresAt: Date.now() + ACTIVE_TTL_MS,
    value: active,
  };
  return active;
}

export async function fetchUmamiSummaryRange(
  config: { apiBase: string; apiKey: string; websiteId: string },
  startAtMs: number,
  endAtMs: number
): Promise<{ visits: number; uniques: number; pageviews: number; bounces: number; totalTime: number }> {
  const raw = await umamiFetch<Record<string, unknown>>(
    `/websites/${encodeURIComponent(config.websiteId)}/stats?startAt=${startAtMs}&endAt=${endAtMs}`,
    config
  );

  const pageviews = extractMetricValue(raw.pageviews);
  const uniques = extractMetricValue(raw.visitors);
  const visits = extractMetricValue(raw.visits) ?? uniques;
  const bounces = extractMetricValue(raw.bounces) ?? 0;
  const totalTime = extractMetricValue(raw.totaltime) ?? 0;

  if (pageviews === null || uniques === null || visits === null) {
    throw new Error('Unexpected Umami stats payload');
  }

  return { visits, uniques, pageviews, bounces, totalTime };
}

export async function getPublicStats(): Promise<PublicStatsResponse> {
  const config = getUmamiConfig();
  if (!config) {
    return { ok: false, error: 'Stats unavailable' };
  }

  try {
    const endAt = Date.now();
    const startAt = Date.parse(`${config.launchDate}T00:00:00.000Z`) || 0;
    const cacheKey = `${config.apiBase}:${config.websiteId}:${config.launchDate}`;

    let totals: { visits: number; uniques: number; pageviews: number };
    if (cachedTotals && cachedTotals.key === cacheKey && cachedTotals.expiresAt > Date.now()) {
      totals = cachedTotals.value;
    } else {
      const summary = await fetchUmamiSummaryRange(config, startAt, endAt);
      totals = {
        visits: summary.visits,
        uniques: summary.uniques,
        pageviews: summary.pageviews,
      };
      cachedTotals = {
        key: cacheKey,
        expiresAt: Date.now() + SUMMARY_TTL_MS,
        value: totals,
      };
    }

    const activeNow = await fetchUmamiActive(config);

    return {
      ok: true,
      launchDate: config.launchDate,
      totals,
      activeNow,
    };
  } catch {
    return { ok: false, error: 'Stats unavailable' };
  }
}

export async function getAdminAnalytics(
  rangeDays: 30 | 90 = 30
): Promise<AdminAnalyticsData | PublicStatsError> {
  const config = getUmamiConfig();
  if (!config) {
    return { ok: false, error: 'Stats unavailable' };
  }

  const endAt = Date.now();
  const startAt = endAt - rangeDays * 24 * 60 * 60 * 1000;
  const qs = `startAt=${startAt}&endAt=${endAt}`;
  const base = `/websites/${encodeURIComponent(config.websiteId)}`;

  try {
    const [summary, activeNow, pageviewsRaw, referrers, countries, pages, events] =
      await Promise.all([
        fetchUmamiSummaryRange(config, startAt, endAt),
        fetchUmamiActive(config),
        umamiFetch<{ pageviews?: PageviewPoint[] }>(
          `${base}/pageviews?${qs}&unit=day&timezone=UTC`,
          config
        ).catch(() => ({ pageviews: [] })),
        umamiFetch<MetricRow[]>(
          `${base}/metrics?${qs}&type=referrer&limit=8`,
          config
        ).catch(() => []),
        umamiFetch<MetricRow[]>(
          `${base}/metrics?${qs}&type=country&limit=8`,
          config
        ).catch(() => []),
        umamiFetch<MetricRow[]>(
          `${base}/metrics?${qs}&type=path&limit=8`,
          config
        ).catch(() => []),
        umamiFetch<MetricRow[]>(
          `${base}/metrics?${qs}&type=event&limit=8`,
          config
        ).catch(() => []),
      ]);

    return {
      ok: true,
      rangeDays,
      totals: {
        visits: summary.visits,
        uniques: summary.uniques,
        pageviews: summary.pageviews,
      },
      activeNow,
      series: Array.isArray(pageviewsRaw.pageviews) ? pageviewsRaw.pageviews : [],
      referrers: Array.isArray(referrers) ? referrers : [],
      countries: Array.isArray(countries) ? countries : [],
      pages: Array.isArray(pages) ? pages : [],
      events: Array.isArray(events) ? events : [],
    };
  } catch {
    return { ok: false, error: 'Stats unavailable' };
  }
}
