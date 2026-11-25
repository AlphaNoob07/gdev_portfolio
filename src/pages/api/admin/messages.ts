import type { APIRoute } from 'astro';
import { desc, eq } from 'drizzle-orm';
import { z } from 'astro/zod';
import { contactSubmissions } from '../../../db/schema';
import { getDb } from '../../../lib/db';

export const prerender = false;

const ActionSchema = z.object({
  id: z.number().int().positive(),
  action: z.enum(['mark_read', 'mark_unread', 'archive', 'delete']),
});

export const GET: APIRoute = async () => {
  const db = getDb();
  if (!db) {
    return new Response(
      JSON.stringify({ configured: false, messages: [] }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }

  const rows = await db
    .select()
    .from(contactSubmissions)
    .orderBy(desc(contactSubmissions.createdAt))
    .limit(100);

  return new Response(
    JSON.stringify({ configured: true, messages: rows }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }
  );
};

export const POST: APIRoute = async ({ request }) => {
  const db = getDb();
  if (!db) {
    return new Response(
      JSON.stringify({ error: 'Database is not configured.' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid action payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const { id, action } = parsed.data;

  if (action === 'delete') {
    await db.delete(contactSubmissions).where(eq(contactSubmissions.id, id));
  } else {
    const nextStatus =
      action === 'mark_read'
        ? 'read'
        : action === 'mark_unread'
          ? 'unread'
          : 'archived';
    await db
      .update(contactSubmissions)
      .set({ status: nextStatus })
      .where(eq(contactSubmissions.id, id));
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
