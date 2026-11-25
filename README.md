# Swapon Islam — Portfolio (`gdev_portfolio`)

VisionOS-inspired **Liquid Glass** portfolio built with **Astro**, **TypeScript**, and **Vercel**.

## Features
- **Static-first public pages** served via Vercel CDN with `astro:assets` AVIF/WebP image optimization, dark/light Liquid Glass themes, `prefers-reduced-motion` / `prefers-reduced-transparency` fallbacks, and View Transitions.
- **Content Collections (`src/content.config.ts`)**: Zod-validated single source of truth for profile, experience timeline, 17 verified projects (with `/projects/[slug]` case studies and Lightbox), Technology Universe SVG constellation, skills, blog posts, testimonials, certifications, and availability.
- **GitHub Showcase (`/api/github`)**: Server-side public repository (`private: false` only), event feed, and GraphQL contribution calendar with CDN caching and a build-time fallback snapshot (`src/data/github-snapshot.json`).
- **Contact Pipeline (`/api/contact`)**: Zod validation, control-character stripping, honeypot + minimum fill-time check, Cloudflare Turnstile verification, salted IP-hash rate limiting (`5/hr`, `20/day`), Neon idempotency deduplication, and Resend delivery to `gdev.swapon@gmail.com`.
- **Voice & AI Assistant (`/api/chat`)**: Server-side `@google/genai` streaming assistant grounded strictly in build-time portfolio content, with browser voice input/output, per-IP (`20/hr`) + Neon global daily caps, and deterministic FAQ fallback.
- **Analytics, Admin & CMS**: Cookieless Umami Cloud tracking + `/api/stats`, GitHub OAuth admin dashboard (`/admin`) locked to `ADMIN_GITHUB_USER_ID`, daily snapshot + 12-month cleanup cron (`/api/cron/snapshot`), and Keystatic CMS (`/keystatic`).
- **Printable A4 Resume (`/resume`)**: Renders directly from content collections and exports to [Swapon-Islam-Resume.pdf](public/resume/Swapon-Islam-Resume.pdf) via Playwright.

## Local Development

```bash
npm install
npm run dev
```

## Scripts

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Start local Astro dev server (`http://localhost:4321`) |
| `npm run check` | Run `astro check` type and template diagnostics |
| `npm run build` | Build static pages and Vercel serverless bundle |
| `npm run test:e2e` | Run Playwright multi-viewport E2E, a11y, SEO, and perf suite |
| `npm run resume` | Generate `public/resume/Swapon-Islam-Resume.pdf` from `/resume` |
| `npm run snapshot:github` | Refresh `src/data/github-snapshot.json` from public GitHub API |
| `npm run import:linkedin -- <dir>` | Dry-run LinkedIn export CSV importer (`--write` to save) |
| `npm run db:push` | Push Drizzle schema (`src/db/schema.ts`) to Neon Postgres |

## Deployment & Cutover
See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full account setup, environment variable configuration, `onrender.com` 301 redirect instructions, and production verification checks.
