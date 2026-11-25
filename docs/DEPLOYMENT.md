# Deployment & Production Cutover Guide

This guide covers setting up all free-tier services, configuring environment variables in Vercel, verifying a Preview deployment on `redesign/liquid-glass`, and cutting over from Render (`*.onrender.com`) to Vercel (`*.vercel.app`).

---

## 1. Accounts & Environment Variables

Set these in **Vercel → Project Settings → Environment Variables** (never commit secrets into git; see `.env.example` for the full list).

### A. Hosting (Vercel Hobby)
1. Sign in to Vercel with GitHub and import `AlphaNoob07/gdev_portfolio`.
2. Framework preset: **Astro** (build command `npm run build`, output `.vercel/output`).
3. Set `SITE_URL` to your Vercel production URL (e.g. `https://gdev-portfolio.vercel.app`) for canonical tags and `sitemap-index.xml`.

### B. Database (Neon Postgres via Vercel Marketplace)
1. In your Vercel project, go to **Storage → Create Database → Neon Postgres**.
2. Connect it to Production and Preview environments (auto-populates `DATABASE_URL`).
3. Pull env vars locally or export `DATABASE_URL` and push the schema:
   ```bash
   npm run db:push
   ```

### C. Contact Email (Resend)
1. Create a Resend account using **`tm.swapon@gmail.com`** (required for `onboarding@resend.dev` delivery until a custom domain is verified).
2. Create an API key and set:
   - `RESEND_API_KEY=<your-resend-key>`
   - `CONTACT_TO=tm.swapon@gmail.com`

### D. Spam Protection (Cloudflare Turnstile)
1. In Cloudflare Dashboard → **Turnstile → Add Widget**.
2. Add your `*.vercel.app` domain (and `localhost` for local testing), choose **Managed**.
3. Set:
   - `TURNSTILE_SITE_KEY=<site-key>`
   - `PUBLIC_TURNSTILE_SITE_KEY=<site-key>`
   - `TURNSTILE_SECRET=<secret-key>`

### E. Analytics (Umami Cloud)
1. Create a free Umami Cloud website (`https://cloud.umami.is`) for your `*.vercel.app` domain.
2. Create an API key in Umami Cloud Settings.
3. Set:
   - `PUBLIC_UMAMI_WEBSITE_ID=<website-id>`
   - `UMAMI_WEBSITE_ID=<website-id>`
   - `UMAMI_API_KEY=<api-key>`
   - `SITE_LAUNCH_DATE=2026-11-25` (or your cutover date `YYYY-MM-DD`)

### F. Voice & AI Assistant (Google Gemini)
1. Create an API key in Google AI Studio (`https://aistudio.google.com/apikey`).
2. Set:
   - `GEMINI_API_KEY=<gemini-api-key>`
   - `GEMINI_MODEL=gemini-3.5-flash-lite`
   - `CHAT_DAILY_CAP=250`

### G. GitHub Showcase, Admin OAuth & Keystatic CMS
1. **GitHub Token (`GITHUB_TOKEN`)**: Create a fine-grained/classic **no-scope** token for public REST & GraphQL `contributionsCollection` reads.
2. **GitHub OAuth App (Admin `/admin`)**:
   - GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
   - Homepage URL: `https://<your-site>.vercel.app`
   - Authorization callback URL: `https://<your-site>.vercel.app/api/auth/callback/github`
   - Lookup your numeric GitHub user ID: `https://api.github.com/users/AlphaNoob07` (`"id"` field).
   - Set `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `ADMIN_GITHUB_USER_ID`, and `AUTH_SECRET` (generate with `openssl rand -hex 32`).
3. **Keystatic GitHub App (`/keystatic`)**:
   - Visit `https://<your-site>.vercel.app/keystatic` after deployment to follow Keystatic's GitHub App setup prompt, then set `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, and `KEYSTATIC_SECRET`.

### H. Security & Cron Secrets
Generate random 64-char hex secrets locally:
```bash
openssl rand -hex 32   # IP_HASH_SALT
openssl rand -hex 32   # CRON_SECRET
```
Set both `IP_HASH_SALT` and `CRON_SECRET` in Vercel (Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically to `/api/cron/snapshot` at `0 2 * * *` UTC).

---

## 2. Production Cutover Checklist

1. **Merge & Deploy**:
   - Verify the Preview URL on `redesign/liquid-glass` first.
   - Merge `redesign/liquid-glass` into `main` and push so Vercel deploys Production.
2. **Verify Endpoints & Security Headers**:
   ```bash
   curl -I https://<your-site>.vercel.app/
   curl -I https://<your-site>.vercel.app/admin
   curl -i https://<your-site>.vercel.app/api/admin/messages
   curl -I https://<your-site>.vercel.app/robots.txt
   curl -I https://<your-site>.vercel.app/sitemap-index.xml
   ```
   Confirm:
   - `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` are present on `/`.
   - `/admin` returns `302` redirect to `/admin/signin`.
   - `/api/admin/messages` returns `401`.
3. **301 Redirect from Render (`*.onrender.com`)**:
   - In your Render Dashboard → Static Site (`gdev_portfolio`) → **Redirects/Rewrites**, add:
     - **Source:** `/*`
     - **Destination:** `https://<your-site>.vercel.app/:splat`
     - **Action:** `Redirect` (`301`)
   - Verify: `curl -I https://<your-render-app>.onrender.com/` returns `301` pointing to `https://<your-site>.vercel.app/`.
4. **Update GitHub Profile README**:
   - Update the portfolio link in `AlphaNoob07/AlphaNoob07/README.md` to point to `https://<your-site>.vercel.app/`.
