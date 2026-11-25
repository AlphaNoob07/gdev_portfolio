import type { APIRoute } from 'astro';
import {
  consumeOAuthState,
  isAllowedAdminUser,
  isAuthConfigured,
  setAdminSessionCookie,
} from '../../../../lib/auth';

export const prerender = false;

interface GitHubUserResponse {
  id?: number;
  login?: string;
  name?: string | null;
  avatar_url?: string;
}

export const GET: APIRoute = async ({ cookies, url, redirect }) => {
  if (!isAuthConfigured()) {
    return redirect('/admin/signin?error=not_configured', 302);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !consumeOAuthState(cookies, state)) {
    return redirect('/admin/signin?error=oauth_failed', 302);
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.AUTH_GITHUB_ID!.trim(),
        client_secret: process.env.AUTH_GITHUB_SECRET!.trim(),
        code,
        redirect_uri: new URL('/api/auth/callback/github', url.origin).toString(),
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!tokenRes.ok) {
      return redirect('/admin/signin?error=oauth_failed', 302);
    }

    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      return redirect('/admin/signin?error=oauth_failed', 302);
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'gdev-portfolio-admin',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!userRes.ok) {
      return redirect('/admin/signin?error=oauth_failed', 302);
    }

    const ghUser = (await userRes.json()) as GitHubUserResponse;
    if (!ghUser.id || !ghUser.login || !isAllowedAdminUser(ghUser.id)) {
      return redirect('/admin/signin?error=forbidden', 302);
    }

    setAdminSessionCookie(
      cookies,
      {
        id: String(ghUser.id),
        login: ghUser.login,
        name: ghUser.name ?? undefined,
        avatarUrl: ghUser.avatar_url,
      },
      url.protocol === 'https:'
    );

    return redirect('/admin', 302);
  } catch {
    return redirect('/admin/signin?error=oauth_failed', 302);
  }
};
