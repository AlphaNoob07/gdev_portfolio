import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { rateLimits } from '../db/schema';
import { getDb } from './db';

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterSeconds: number;
}

const memoryBuckets = new Map<string, { windowStartMs: number; count: number }>();

export function extractClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown';
}

export function hashIp(
  ip: string,
  salt = process.env.IP_HASH_SALT || 'dev-salt-change-me'
): string {
  return crypto.createHmac('sha256', salt).update(ip).digest('hex');
}

export function resetMemoryRateLimits(): void {
  memoryBuckets.clear();
}

export async function checkRateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
  nowMs?: number;
}): Promise<RateLimitResult> {
  const { key, limit, windowMs, nowMs = Date.now() } = options;
  const db = getDb();

  if (!db) {
    const existing = memoryBuckets.get(key);
    if (!existing || nowMs - existing.windowStartMs >= windowMs) {
      memoryBuckets.set(key, { windowStartMs: nowMs, count: 1 });
      return {
        allowed: true,
        count: 1,
        remaining: Math.max(0, limit - 1),
        retryAfterSeconds: Math.ceil(windowMs / 1000),
      };
    }

    const nextCount = existing.count + 1;
    existing.count = nextCount;
    const resetMs = Math.max(1000, existing.windowStartMs + windowMs - nowMs);
    return {
      allowed: nextCount <= limit,
      count: nextCount,
      remaining: Math.max(0, limit - nextCount),
      retryAfterSeconds: Math.ceil(resetMs / 1000),
    };
  }

  const rows = await db
    .select()
    .from(rateLimits)
    .where(eq(rateLimits.key, key))
    .limit(1);

  const row = rows[0];
  const nowDate = new Date(nowMs);

  if (!row || nowMs - row.windowStart.getTime() >= windowMs) {
    await db
      .insert(rateLimits)
      .values({
        key,
        windowStart: nowDate,
        count: 1,
        updatedAt: nowDate,
      })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          windowStart: nowDate,
          count: 1,
          updatedAt: nowDate,
        },
      });

    return {
      allowed: true,
      count: 1,
      remaining: Math.max(0, limit - 1),
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  const nextCount = row.count + 1;
  await db
    .update(rateLimits)
    .set({
      count: nextCount,
      updatedAt: nowDate,
    })
    .where(eq(rateLimits.key, key));

  const resetMs = Math.max(1000, row.windowStart.getTime() + windowMs - nowMs);
  return {
    allowed: nextCount <= limit,
    count: nextCount,
    remaining: Math.max(0, limit - nextCount),
    retryAfterSeconds: Math.ceil(resetMs / 1000),
  };
}
