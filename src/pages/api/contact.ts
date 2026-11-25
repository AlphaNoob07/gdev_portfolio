import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { contactSubmissions } from '../../db/schema';
import {
  buildContactEmail,
  sendResendEmail,
  verifyTurnstileToken,
} from '../../lib/contact';
import { getDb } from '../../lib/db';
import {
  checkRateLimit,
  extractClientIp,
  hashIp,
} from '../../lib/ratelimit';
import { ContactPayloadSchema, isFillTimeValid } from '../../lib/validate';

export const prerender = false;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const memoryIdempotencyKeys = new Set<string>();

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body.' }, 400);
  }

  const parsed = ContactPayloadSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return jsonResponse(
      {
        error: firstIssue?.message || 'Please check your form inputs.',
      },
      400
    );
  }

  const data = parsed.data;

  // Silent honeypot drop
  if (data.website.trim().length > 0) {
    return jsonResponse({ ok: true, message: 'Message received.' }, 200);
  }

  // Minimum fill-time check
  if (!isFillTimeValid(data.renderedAt)) {
    return jsonResponse(
      { error: 'Please wait a moment before submitting the form.' },
      400
    );
  }

  const clientIp = extractClientIp(request);

  // Cloudflare Turnstile verification (enforced when TURNSTILE_SECRET is set)
  const turnstile = await verifyTurnstileToken(data.turnstileToken, clientIp);
  if (!turnstile.ok) {
    return jsonResponse(
      { error: turnstile.error || 'Spam check failed. Please try again.' },
      400
    );
  }

  // Rate limits by salted IP hash (5/hr, 20/day)
  const ipHash = hashIp(clientIp);
  const hourly = await checkRateLimit({
    key: `contact:hr:${ipHash}`,
    limit: 5,
    windowMs: HOUR_MS,
  });
  if (!hourly.allowed) {
    return jsonResponse(
      {
        error:
          'Too many contact submissions this hour. Please try again later or email gdev.swapon@gmail.com.',
      },
      429,
      { 'Retry-After': String(hourly.retryAfterSeconds) }
    );
  }

  const daily = await checkRateLimit({
    key: `contact:day:${ipHash}`,
    limit: 20,
    windowMs: DAY_MS,
  });
  if (!daily.allowed) {
    return jsonResponse(
      {
        error:
          'Daily contact submission limit reached. Please try again tomorrow or email gdev.swapon@gmail.com.',
      },
      429,
      { 'Retry-After': String(daily.retryAfterSeconds) }
    );
  }

  const db = getDb();

  // Deduplicate on idempotencyKey
  if (db) {
    const existing = await db
      .select({ id: contactSubmissions.id })
      .from(contactSubmissions)
      .where(eq(contactSubmissions.idempotencyKey, data.idempotencyKey))
      .limit(1);

    if (existing.length > 0) {
      return jsonResponse(
        {
          ok: true,
          deduplicated: true,
          message: 'Your message was already received. Thank you!',
        },
        200
      );
    }
  } else if (memoryIdempotencyKeys.has(data.idempotencyKey)) {
    return jsonResponse(
      {
        ok: true,
        deduplicated: true,
        message: 'Your message was already received. Thank you!',
      },
      200
    );
  }

  let insertedId: number | null = null;
  if (db) {
    try {
      const inserted = await db
        .insert(contactSubmissions)
        .values({
          idempotencyKey: data.idempotencyKey,
          name: data.name,
          email: data.email,
          subject: data.subject || null,
          message: data.message,
          ipHash,
          deliveryStatus: 'pending',
          status: 'unread',
        })
        .returning({ id: contactSubmissions.id });

      insertedId = inserted[0]?.id ?? null;
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === '23505') {
        return jsonResponse(
          {
            ok: true,
            deduplicated: true,
            message: 'Your message was already received. Thank you!',
          },
          200
        );
      }
      throw err;
    }
  } else {
    memoryIdempotencyKeys.add(data.idempotencyKey);
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  const recipient = process.env.CONTACT_TO?.trim() || 'gdev.swapon@gmail.com';

  if (!resendKey) {
    if (db && insertedId !== null) {
      await db
        .update(contactSubmissions)
        .set({ deliveryStatus: 'unconfigured' })
        .where(eq(contactSubmissions.id, insertedId));
    }
    return jsonResponse(
      {
        error:
          'Email delivery is not configured yet. Please email gdev.swapon@gmail.com directly.',
      },
      503
    );
  }

  const emailContent = buildContactEmail({
    name: data.name,
    email: data.email,
    subject: data.subject,
    message: data.message,
  });

  const sendResult = await sendResendEmail({
    apiKey: resendKey,
    to: recipient,
    replyTo: data.email,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
  });

  if (!sendResult.ok) {
    if (db && insertedId !== null) {
      await db
        .update(contactSubmissions)
        .set({ deliveryStatus: 'failed' })
        .where(eq(contactSubmissions.id, insertedId));
    }
    return jsonResponse(
      {
        error:
          'Could not deliver email right now. Please try again or email gdev.swapon@gmail.com.',
      },
      502
    );
  }

  if (db && insertedId !== null) {
    await db
      .update(contactSubmissions)
      .set({
        deliveryStatus: 'sent',
        resendId: sendResult.id ?? null,
      })
      .where(eq(contactSubmissions.id, insertedId));
  }

  return jsonResponse(
    {
      ok: true,
      message: 'Message sent! Thank you for reaching out.',
    },
    200
  );
};
