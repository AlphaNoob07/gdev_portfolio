import { z } from 'zod/v4';

export function stripControlChars(
  value: string,
  preserveNewlines = false
): string {
  const withoutControls = preserveNewlines
    ? value.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '')
    : value.replace(/[\x00-\x1F\x7F]/g, ' ');
  return withoutControls.replace(/\r\n/g, '\n').trim();
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isFillTimeValid(
  renderedAt: number,
  now = Date.now(),
  minMs = 2500
): boolean {
  if (!Number.isFinite(renderedAt) || renderedAt <= 0) return false;
  const elapsed = now - renderedAt;
  return elapsed >= minMs && elapsed <= 7 * 24 * 60 * 60 * 1000;
}

export const ContactPayloadSchema = z.object({
  name: z
    .string()
    .transform((v) => stripControlChars(v, false))
    .pipe(
      z
        .string()
        .min(2, 'Name must be at least 2 characters.')
        .max(120, 'Name must be 120 characters or fewer.')
    ),
  email: z
    .string()
    .transform((v) => stripControlChars(v, false).toLowerCase())
    .pipe(
      z
        .email('Please provide a valid email address.')
        .max(160, 'Email must be 160 characters or fewer.')
    ),
  subject: z
    .string()
    .optional()
    .default('')
    .transform((v) => stripControlChars(v, false))
    .pipe(z.string().max(160, 'Subject must be 160 characters or fewer.')),
  message: z
    .string()
    .transform((v) => stripControlChars(v, true))
    .pipe(
      z
        .string()
        .min(10, 'Message must be at least 10 characters.')
        .max(2000, 'Message must be 2000 characters or fewer.')
    ),
  website: z.string().optional().default(''),
  renderedAt: z.number(),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, 'Missing idempotency key.')
    .max(128, 'Invalid idempotency key.'),
  turnstileToken: z.string().optional().default(''),
});

export type ValidContactPayload = z.infer<typeof ContactPayloadSchema>;
