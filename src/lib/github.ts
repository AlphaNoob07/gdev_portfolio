import snapshotJson from '../data/github-snapshot.json';

export interface GitHubRepo {
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  homepage: string | null;
  language: string | null;
  stars: number;
  forks: number;
  updatedAt: string;
  topics: string[];
  isFork: boolean;
  private: false;
  curated: boolean;
}

export interface GitHubActivity {
  id: string;
  type: string;
  repo: string;
  repoUrl: string;
  summary: string;
  createdAt: string;
}

export interface GitHubContributionDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface GitHubContributions {
  total: number;
  weeks: Array<{ days: GitHubContributionDay[] }>;
}

export interface GitHubShowcasePayload {
  username: string;
  profileUrl: string;
  source: 'live' | 'snapshot';
  fetchedAt: string;
  repos: GitHubRepo[];
  activity: GitHubActivity[];
  contributions: GitHubContributions | null;
}

export interface RawGitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage?: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  pushed_at?: string;
  updated_at: string;
  topics?: string[];
  fork: boolean;
  private: boolean;
}

interface RawGitHubEvent {
  id: string;
  type: string;
  repo?: { name?: string };
  created_at: string;
  payload?: {
    ref?: string;
    ref_type?: string;
    action?: string;
    size?: number;
  };
}

interface GraphQLContributionsResponse {
  data?: {
    user?: {
      contributionsCollection?: {
        contributionCalendar?: {
          totalContributions?: number;
          weeks?: Array<{
            contributionDays?: Array<{
              date: string;
              contributionCount: number;
              contributionLevel:
              | 'NONE'
              | 'FIRST_QUARTILE'
              | 'SECOND_QUARTILE'
              | 'THIRD_QUARTILE'
              | 'FOURTH_QUARTILE';
            }>;
          }>;
        };
      };
    };
  };
  errors?: Array<{ message: string }>;
}

const LEVEL_MAP: Record<string, 0 | 1 | 2 | 3 | 4> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

export function filterAndSortRepos(
  rawRepos: RawGitHubRepo[],
  curatedNames: string[],
  includeForks = false
): GitHubRepo[] {
  const curatedOrder = new Map<string, number>();
  curatedNames.forEach((name, idx) => {
    curatedOrder.set(name.trim().toLowerCase(), idx);
  });

  const normalized: GitHubRepo[] = rawRepos
    .filter((repo) => repo.private === false && (includeForks || !repo.fork))
    .map((repo) => {
      const lower = repo.name.toLowerCase();
      return {
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description ?? null,
        htmlUrl: repo.html_url,
        homepage: repo.homepage?.trim() ? repo.homepage.trim() : null,
        language: repo.language ?? null,
        stars: repo.stargazers_count ?? 0,
        forks: repo.forks_count ?? 0,
        updatedAt: repo.pushed_at || repo.updated_at,
        topics: Array.isArray(repo.topics) ? repo.topics : [],
        isFork: Boolean(repo.fork),
        private: false as const,
        curated: curatedOrder.has(lower),
      };
    });

  return normalized.sort((a, b) => {
    const aIdx = curatedOrder.get(a.name.toLowerCase());
    const bIdx = curatedOrder.get(b.name.toLowerCase());
    if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
    if (aIdx !== undefined) return -1;
    if (bIdx !== undefined) return 1;
    if (b.stars !== a.stars) return b.stars - a.stars;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
}

function formatEventSummary(event: RawGitHubEvent): string {
  const repo = event.repo?.name || 'repository';
  switch (event.type) {
    case 'PushEvent': {
      const count = event.payload?.size ?? 1;
      return `Pushed ${count} commit${count === 1 ? '' : 's'} to ${repo}`;
    }
    case 'CreateEvent':
      return `Created ${event.payload?.ref_type || 'item'} in ${repo}`;
    case 'PullRequestEvent':
      return `${event.payload?.action || 'Updated'} pull request in ${repo}`;
    case 'IssuesEvent':
      return `${event.payload?.action || 'Updated'} issue in ${repo}`;
    case 'ReleaseEvent':
      return `Published release in ${repo}`;
    case 'WatchEvent':
      return `Starred ${repo}`;
    case 'ForkEvent':
      return `Forked ${repo}`;
    default:
      return `${event.type.replace(/Event$/, '')} in ${repo}`;
  }
}

export function normalizeEvents(rawEvents: RawGitHubEvent[]): GitHubActivity[] {
  return rawEvents
    .filter((ev) => ev.repo?.name)
    .slice(0, 8)
    .map((ev) => {
      const repo = ev.repo?.name || '';
      return {
        id: ev.id,
        type: ev.type,
        repo,
        repoUrl: `https://github.com/${repo}`,
        summary: formatEventSummary(ev),
        createdAt: ev.created_at,
      };
    });
}

export function getGitHubSnapshot(
  curatedRepos: string[],
  includeForks = false
): GitHubShowcasePayload {
  const raw = snapshotJson as unknown as GitHubShowcasePayload;
  const curatedOrder = new Map<string, number>();
  curatedRepos.forEach((name, idx) => {
    curatedOrder.set(name.trim().toLowerCase(), idx);
  });

  const safeRepos = (raw.repos ?? [])
    .filter(
      (repo) =>
        repo.private === false && (includeForks || !repo.isFork)
    )
    .map((repo) => ({
      ...repo,
      private: false as const,
      curated: curatedOrder.has(repo.name.toLowerCase()),
    }))
    .sort((a, b) => {
      const aIdx = curatedOrder.get(a.name.toLowerCase());
      const bIdx = curatedOrder.get(b.name.toLowerCase());
      if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
      if (aIdx !== undefined) return -1;
      if (bIdx !== undefined) return 1;
      if (b.stars !== a.stars) return b.stars - a.stars;
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });

  return {
    username: raw.username || 'AlphaNoob07',
    profileUrl: raw.profileUrl || 'https://github.com/AlphaNoob07',
    source: 'snapshot',
    fetchedAt: raw.fetchedAt || new Date().toISOString(),
    repos: safeRepos,
    activity: Array.isArray(raw.activity) ? raw.activity : [],
    contributions: raw.contributions ?? null,
  };
}

async function fetchContributionsGraphQL(
  username: string,
  headers: Record<string, string>,
  signal: AbortSignal
): Promise<GitHubContributions | null> {
  const query = `
    query ($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                contributionLevel
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables: { login: username } }),
    signal,
  });

  if (!response.ok) return null;
  const json = (await response.json()) as GraphQLContributionsResponse;
  if (json.errors?.length) return null;

  const calendar = json.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar || !Array.isArray(calendar.weeks)) return null;

  return {
    total: calendar.totalContributions ?? 0,
    weeks: calendar.weeks.map((week) => ({
      days: (week.contributionDays ?? []).map((day) => ({
        date: day.date,
        count: day.contributionCount ?? 0,
        level: LEVEL_MAP[day.contributionLevel] ?? 0,
      })),
    })),
  };
}

export interface FetchGitHubOptions {
  username: string;
  curatedRepos: string[];
  token?: string;
  includeForks?: boolean;
  timeoutMs?: number;
}

export async function fetchGitHubShowcase(
  options: FetchGitHubOptions
): Promise<GitHubShowcasePayload> {
  const {
    username,
    curatedRepos,
    token,
    includeForks = false,
    timeoutMs = 5000,
  } = options;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'gdev-portfolio',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token?.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  try {
    const signal = AbortSignal.timeout(timeoutMs);
    const reposUrl = `https://api.github.com/users/${encodeURIComponent(
      username
    )}/repos?type=owner&sort=updated&per_page=100`;
    const eventsUrl = `https://api.github.com/users/${encodeURIComponent(
      username
    )}/events/public?per_page=15`;

    const [reposRes, eventsRes, contributions] = await Promise.all([
      fetch(reposUrl, { headers, signal }),
      fetch(eventsUrl, { headers, signal }).catch(() => null),
      token?.trim()
        ? fetchContributionsGraphQL(username, headers, signal).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (!reposRes.ok) {
      return getGitHubSnapshot(curatedRepos, includeForks);
    }

    const rawRepos = (await reposRes.json()) as RawGitHubRepo[];
    if (!Array.isArray(rawRepos)) {
      return getGitHubSnapshot(curatedRepos, includeForks);
    }

    let activity: GitHubActivity[] = [];
    if (eventsRes && eventsRes.ok) {
      const rawEvents = (await eventsRes.json()) as RawGitHubEvent[];
      if (Array.isArray(rawEvents)) {
        activity = normalizeEvents(rawEvents);
      }
    }

    const repos = filterAndSortRepos(rawRepos, curatedRepos, includeForks);

    return {
      username,
      profileUrl: `https://github.com/${username}`,
      source: 'live',
      fetchedAt: new Date().toISOString(),
      repos,
      activity,
      contributions,
    };
  } catch {
    return getGitHubSnapshot(curatedRepos, includeForks);
  }
}
