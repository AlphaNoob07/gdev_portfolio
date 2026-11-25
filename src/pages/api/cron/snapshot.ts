import type { APIRoute } from 'astro';
import { lt } from 'drizzle-orm';
import { analyticsSnapshots, contactSubmissions } from '../../../db/schema';
import { getDb } from '../../../lib/db';
import { fetchUmamiSummaryRange } from '../../../lib/umami';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const db = getDb();
  if (!db) {
    return new Response(
      JSON.stringify({ ok: false, error: 'DATABASE_URL not configured' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }

  // Yesterday in UTC
  const now = new Date();
  const endUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const startUtc = endUtc - 24 * 60 * 60 * 1000;
  const dayStr = new Date(startUtc).toISOString().slice(0, 10);

  let snapshotSaved = false;
  let snapshotError: string | undefined;

  const apiKey = process.env.UMAMI_API_KEY?.trim();
  const websiteId = process.env.UMAMI_WEBSITE_ID?.trim();
  const apiBase = (
    process.env.UMAMI_API_BASE?.trim() || 'https://api.umami.is/v1'
  ).replace(/\/+$/, '');

  if (apiKey && websiteId) {
    try {
      const summary = await fetchUmamiSummaryRange(
        { apiBase, apiKey, websiteId },
        startUtc,
        endUtc - 1
      );

      await db
        .insert(analyticsSnapshots)
        .values({
          day: dayStr,
          visits: summary.visits,
          uniques: summary.uniques,
          pageviews: summary.pageviews,
          bounces: summary.bounces,
          totalTime: summary.totalTime,
        })
        .onConflictDoUpdate({
          target: analyticsSnapshots.day,
          set: {
            visits: summary.visits,
            uniques: summary.uniques,
            pageviews: summary.pageviews,
            bounces: summary.bounces,
            totalTime: summary.totalTime,
          },
        });

      snapshotSaved = true;
    } catch (err) {
      snapshotError = err instanceof Error ? err.message : 'Umami fetch failed';
    }
  } else {
    snapshotError = 'Umami credentials not configured';
  }

  // Prune contact submissions older than 12 months
  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const deletedRows = await db
    .delete(contactSubmissions)
    .where(lt(contactSubmissions.createdAt, cutoff))
    .returning({ id: contactSubmissions.id });

  return new Response(
    JSON.stringify({
      ok: true,
      day: dayStr,
      snapshotSaved,
      ...(snapshotError ? { snapshotError } : {}),
      prunedSubmissions: deletedRows.length,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }
  );
};
