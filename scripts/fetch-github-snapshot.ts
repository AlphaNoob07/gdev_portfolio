import fs from 'node:fs/promises';
import path from 'node:path';
import {
  filterAndSortRepos,
  normalizeEvents,
  type GitHubShowcasePayload,
  type RawGitHubRepo,
} from '../src/lib/github.ts';

const ROOT_DIR = process.cwd();
const PROFILE_PATH = path.join(ROOT_DIR, 'src', 'content', 'profile.yaml');
const SNAPSHOT_PATH = path.join(ROOT_DIR, 'src', 'data', 'github-snapshot.json');

async function readProfileSettings(): Promise<{
  username: string;
  curatedRepos: string[];
}> {
  const raw = await fs.readFile(PROFILE_PATH, 'utf-8');
  const userMatch = raw.match(/^githubUsername:\s*"?([^"\n]+)"?\s*$/m);
  const username = userMatch?.[1]?.trim() || 'AlphaNoob07';

  const curatedSection = raw.match(/curatedRepos:\s*\n((?:\s+-\s+.+\n?)*)/);
  const curatedRepos: string[] = [];
  if (curatedSection?.[1]) {
    for (const line of curatedSection[1].split('\n')) {
      const m = line.match(/^\s*-\s*"?([^"\n]+)"?\s*$/);
      if (m?.[1]) curatedRepos.push(m[1].trim());
    }
  }

  return { username, curatedRepos };
}

async function main(): Promise<void> {
  const { username, curatedRepos } = await readProfileSettings();
  const token = process.env.GITHUB_TOKEN?.trim();

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'gdev-portfolio-snapshot',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const signal = AbortSignal.timeout(10000);
  const reposRes = await fetch(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?type=owner&sort=updated&per_page=100`,
    { headers, signal }
  );

  if (!reposRes.ok) {
    throw new Error(`GitHub repos API returned ${reposRes.status}`);
  }

  const rawRepos = (await reposRes.json()) as RawGitHubRepo[];
  const repos = filterAndSortRepos(rawRepos, curatedRepos, false);

  const eventsRes = await fetch(
    `https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=15`,
    { headers, signal }
  ).catch(() => null);

  const activity =
    eventsRes && eventsRes.ok
      ? normalizeEvents(
          ((await eventsRes.json()) as Parameters<typeof normalizeEvents>[0]) ?? []
        )
      : [];

  const payload: GitHubShowcasePayload = {
    username,
    profileUrl: `https://github.com/${username}`,
    source: 'snapshot',
    fetchedAt: new Date().toISOString(),
    repos,
    activity,
    contributions: null,
  };

  await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await fs.writeFile(SNAPSHOT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');

  console.log(
    `Saved GitHub snapshot for ${username}: ${repos.length} public repos, ${activity.length} events.`
  );
}

main().catch((err) => {
  console.error('Failed to refresh GitHub snapshot:', err.message || err);
  process.exit(1);
});
