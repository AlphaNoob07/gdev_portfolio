import type { APIRoute } from 'astro';
import { createOAuthStateCookie, isAuthConfigured } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, url, redirect }) => {
  if (!isAuthConfigured()) {
    return redirect('/admin/signin?error=not_configured', 302);
  }

  const clientId = process.env.AUTH_GITHUB_ID!.trim();
  const isSecure = url.protocol === 'https:';
  const state = createOAuthStateCookie(cookies, isSecure);
  const callbackUrl = new URL('/api/auth/callback/github', url.origin).toString();

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('scope', 'read:user');
  authUrl.searchParams.set('state', state);

  return redirect(authUrl.toString(), 302);
};
