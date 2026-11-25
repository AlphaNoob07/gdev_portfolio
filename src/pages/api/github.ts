import type { APIRoute } from 'astro';
import { getProfile } from '../../lib/content';
import { fetchGitHubShowcase } from '../../lib/github';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const profile = await getProfile();
  const includeForks = url.searchParams.get('includeForks') === 'true';
  const token = process.env.GITHUB_TOKEN;

  const payload = await fetchGitHubShowcase({
    username: profile.githubUsername,
    curatedRepos: profile.curatedRepos,
    token,
    includeForks,
    timeoutMs: 6000,
  });

  const cacheControl =
    payload.source === 'live'
      ? 'public, s-maxage=3600, stale-while-revalidate=86400'
      : 'public, s-maxage=300, stale-while-revalidate=3600';

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
      'X-GitHub-Source': payload.source,
    },
  });
};
