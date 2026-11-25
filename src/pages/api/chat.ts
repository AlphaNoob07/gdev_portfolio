import { GoogleGenAI, type Interactions } from '@google/genai';
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'zod/v4';
import { chatUsageDaily } from '../../db/schema';
import { getDb } from '../../lib/db';
import { answerFromFallback, buildKnowledgePack } from '../../lib/knowledge';
import { checkRateLimit, extractClientIp, hashIp } from '../../lib/ratelimit';
import { stripControlChars } from '../../lib/validate';

export const prerender = false;

const HOUR_MS = 60 * 60 * 1000;
const memoryDailyUsage = new Map<string, number>();

const ChatTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z
    .string()
    .transform((v) => stripControlChars(v, true))
    .pipe(z.string().min(1).max(1500)),
});

const ChatRequestSchema = z.object({
  message: z
    .string()
    .transform((v) => stripControlChars(v, true))
    .pipe(
      z
        .string()
        .min(1, 'Please enter a question.')
        .max(500, 'Question must be 500 characters or fewer.')
    ),
  history: z.array(ChatTurnSchema).max(20).optional().default([]),
});

async function consumeDailyGlobalQuota(): Promise<boolean> {
  const capRaw = Number(process.env.CHAT_DAILY_CAP || '250');
  const dailyCap = Number.isFinite(capRaw) && capRaw > 0 ? capRaw : 250;
  const today = new Date().toISOString().slice(0, 10);

  const db = getDb();
  if (!db) {
    const current = memoryDailyUsage.get(today) ?? 0;
    if (current >= dailyCap) return false;
    memoryDailyUsage.set(today, current + 1);
    return true;
  }

  const rows = await db
    .select()
    .from(chatUsageDaily)
    .where(eq(chatUsageDaily.day, today))
    .limit(1);

  const row = rows[0];
  if (!row) {
    await db
      .insert(chatUsageDaily)
      .values({ day: today, count: 1, updatedAt: new Date() })
      .onConflictDoNothing();
    return true;
  }

  if (row.count >= dailyCap) {
    return false;
  }

  await db
    .update(chatUsageDaily)
    .set({ count: row.count + 1, updatedAt: new Date() })
    .where(eq(chatUsageDaily.day, today));

  return true;
}

function fallbackResponse(answer: string): Response {
  return new Response(answer, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Assistant-Mode': 'fallback',
    },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON request body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const parsed = ChatRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || 'Invalid chat request.';
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const clientIp = extractClientIp(request);
  const ipHash = hashIp(clientIp);
  const hourly = await checkRateLimit({
    key: `chat:hr:${ipHash}`,
    limit: 20,
    windowMs: HOUR_MS,
  });

  if (!hourly.allowed) {
    return new Response(
      JSON.stringify({
        error:
          'Hourly assistant message limit reached (20/hr). Please try again later or use the contact form.',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Retry-After': String(hourly.retryAfterSeconds),
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  const pack = await buildKnowledgePack();
  const { message, history } = parsed.data;
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return fallbackResponse(answerFromFallback(message, pack));
  }

  const withinDailyCap = await consumeDailyGlobalQuota().catch(() => true);
  if (!withinDailyCap) {
    return fallbackResponse(answerFromFallback(message, pack));
  }

  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';
  const recentHistory = history.slice(-8);

  const steps: Interactions.Step[] = [
    ...recentHistory.map((turn) => ({
      type:
        turn.role === 'user'
          ? ('user_input' as const)
          : ('model_output' as const),
      content: [{ type: 'text' as const, text: turn.text }],
    })),
    {
      type: 'user_input' as const,
      content: [{ type: 'text' as const, text: message }],
    },
  ];

  try {
    const ai = new GoogleGenAI({ apiKey });
    const interactionStream = await ai.interactions.create({
      model,
      store: false,
      system_instruction: pack.systemInstruction,
      input: steps,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        let emitted = false;
        try {
          for await (const event of interactionStream) {
            if (
              event.event_type === 'step.delta' &&
              event.delta?.type === 'text'
            ) {
              const chunk = event.delta.text ?? '';
              if (chunk) {
                emitted = true;
                controller.enqueue(encoder.encode(chunk));
              }
            }
          }
          if (!emitted) {
            controller.enqueue(
              encoder.encode(answerFromFallback(message, pack))
            );
          }
        } catch {
          if (!emitted) {
            controller.enqueue(
              encoder.encode(answerFromFallback(message, pack))
            );
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Assistant-Mode': 'live',
      },
    });
  } catch {
    return fallbackResponse(answerFromFallback(message, pack));
  }
};
