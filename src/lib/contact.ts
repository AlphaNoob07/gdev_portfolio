import { escapeHtml } from './validate';

export interface TurnstileVerificationResult {
  ok: boolean;
  error?: string;
}

export interface EmailSendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function verifyTurnstileToken(
  token: string | undefined,
  remoteIp: string,
  secret = process.env.TURNSTILE_SECRET
): Promise<TurnstileVerificationResult> {
  const trimmedSecret = secret?.trim();
  if (!trimmedSecret) {
    return { ok: true };
  }

  const trimmedToken = token?.trim();
  if (!trimmedToken) {
    return { ok: false, error: 'Missing Turnstile verification token.' };
  }

  try {
    const form = new URLSearchParams();
    form.set('secret', trimmedSecret);
    form.set('response', trimmedToken);
    if (remoteIp && remoteIp !== 'unknown') {
      form.set('remoteip', remoteIp);
    }

    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) {
      return { ok: false, error: 'Turnstile verification service error.' };
    }

    const json = (await res.json()) as {
      success?: boolean;
      'error-codes'?: string[];
    };

    if (!json.success) {
      return { ok: false, error: 'Turnstile verification failed.' };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: 'Turnstile verification unavailable.' };
  }
}

export function buildContactEmail(input: {
  name: string;
  email: string;
  subject?: string;
  message: string;
}): { subject: string; text: string; html: string } {
  const cleanSubject = input.subject?.trim()
    ? `[Portfolio] ${input.subject.trim()}`
    : `[Portfolio] New message from ${input.name}`;

  const text = [
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    ...(input.subject?.trim() ? [`Subject: ${input.subject.trim()}`] : []),
    '',
    'Message:',
    input.message,
  ].join('\n');

  const escapedName = escapeHtml(input.name);
  const escapedEmail = escapeHtml(input.email);
  const escapedSubject = input.subject?.trim()
    ? escapeHtml(input.subject.trim())
    : '';
  const escapedMessage = escapeHtml(input.message).replace(/\n/g, '<br />');

  const html = `
<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #0f172a; padding: 20px;">
    <h2 style="margin: 0 0 12px;">New Portfolio Inquiry</h2>
    <p style="margin: 4px 0;"><strong>Name:</strong> ${escapedName}</p>
    <p style="margin: 4px 0;"><strong>Email:</strong> ${escapedEmail}</p>
    ${escapedSubject ? `<p style="margin: 4px 0;"><strong>Subject:</strong> ${escapedSubject}</p>` : ''}
    <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 16px 0;" />
    <p style="margin: 0;">${escapedMessage}</p>
  </body>
</html>
  `.trim();

  return { subject: cleanSubject, text, html };
}

export async function sendResendEmail(params: {
  apiKey: string;
  to: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
}): Promise<EmailSendResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Portfolio Contact <onboarding@resend.dev>',
        to: [params.to],
        reply_to: params.replyTo,
        subject: params.subject,
        text: params.text,
        html: params.html,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        ok: false,
        error: `Resend API error ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ''}`,
      };
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Resend request failed',
    };
  }
}
