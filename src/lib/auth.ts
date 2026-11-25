import crypto from 'node:crypto';
import type { AstroCookies } from 'astro';

export const SESSION_COOKIE_NAME = 'gdev_admin_session';
export const STATE_COOKIE_NAME = 'gdev_oauth_state';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AdminUser {
  id: string;
  login: string;
  name?: string;
  avatarUrl?: string;
  exp: number;
}

function sign(payloadB64: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');
}

export function isAllowedAdminUser(
  githubId: string | number | undefined,
  allowedId = process.env.ADMIN_GITHUB_USER_ID
): boolean {
  if (githubId === undefined || githubId === null || !allowedId) return false;
  const normalizedInput = String(githubId).trim();
  const normalizedAllowed = String(allowedId).trim();
  if (!/^\d+$/.test(normalizedInput) || !/^\d+$/.test(normalizedAllowed)) {
    return false;
  }
  return normalizedInput === normalizedAllowed;
}

export function createSessionToken(
  user: Omit<AdminUser, 'exp'>,
  secret = process.env.AUTH_SECRET
): string {
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET must be at least 16 characters');
  }
  const payload: AdminUser = {
    ...user,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString(
    'base64url'
  );
  const sig = sign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret = process.env.AUTH_SECRET
): AdminUser | null {
  if (!token || !secret) return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;

  const payloadB64 = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!payloadB64 || !sig) return null;

  const expectedSig = sign(payloadB64, secret);
  const sigBuf = Buffer.from(sig, 'utf-8');
  const expectedBuf = Buffer.from(expectedSig, 'utf-8');
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf-8')
    ) as AdminUser;
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp <= Date.now()) {
      return null;
    }
    if (!parsed.id || !parsed.login) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getAdminSession(cookies: AstroCookies): AdminUser | null {
  const token = cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = verifySessionToken(token);
  if (!user) return null;
  if (!isAllowedAdminUser(user.id)) return null;
  return user;
}

export function setAdminSessionCookie(
  cookies: AstroCookies,
  user: Omit<AdminUser, 'exp'>,
  isSecure: boolean
): void {
  const token = createSessionToken(user);
  cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearAdminSessionCookie(cookies: AstroCookies): void {
  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}

export function createOAuthStateCookie(
  cookies: AstroCookies,
  isSecure: boolean
): string {
  const state = crypto.randomBytes(24).toString('base64url');
  cookies.set(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    path: '/',
    maxAge: 600,
  });
  return state;
}

export function consumeOAuthState(
  cookies: AstroCookies,
  receivedState: string | null
): boolean {
  const expected = cookies.get(STATE_COOKIE_NAME)?.value;
  cookies.delete(STATE_COOKIE_NAME, { path: '/' });
  if (!expected || !receivedState) return false;
  const a = Buffer.from(expected, 'utf-8');
  const b = Buffer.from(receivedState, 'utf-8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.AUTH_SECRET?.trim() &&
      process.env.AUTH_GITHUB_ID?.trim() &&
      process.env.AUTH_GITHUB_SECRET?.trim() &&
      process.env.ADMIN_GITHUB_USER_ID?.trim()
  );
}
