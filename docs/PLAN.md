# Portfolio Rebuild Plan: visionOS-Inspired "Liquid Glass" Site (Astro + Vercel)

## Context
- **Why:** The current site (`gdev_portfolio`) is a one-page static HTML site on Render. It has:
  - no contact backend, analytics, admin, GitHub integration, or AI;
  - out-of-date content ("5+ years"; employer list stops at 2025);
  - an external typing-SVG dependency (`herokuapp`) in the hero.
- **Goal:** A premium, production-ready portfolio built on real, verified information.

### What Exists Today
- `index.html` holds all the markup plus an inline `<script>`.
- `Source/style.css` has 474 lines.
- `Source/javascripts.js` is dead code: `index.html` never loads it.
- `assets/img/profile_pic.png` (1.5 MB, needs optimizing).
- `assets/img/Luna_anim_V5.glb` (4.7 MB, not used yet).
- `Source/Resume Of MD Swapon Islam.pdf` — outdated and has issues: email typo `"gmail,com"`, skill percentages, home address, and no current role.

---

## Decisions Already Made

| Topic | Decision |
| :--- | :--- |
| **Existing 6 projects** (`Stellar VR Explorer`, `AR Museum Guide`, `Quantum Warriors`, `AR Home Designer`, `BioLab VR`, `Rhythm Dimension`) | Real. Keep them. Details and media to be supplied. |
| **Tulip Tech work** (XREAL F1/Football/Rugby XR, PitchVision CV, Android XR demos, Glimmer UI) | Feature generically: no client or product names, no internal details or code, and only screenshots the user approves. |
| **Stack / hosting** | Astro on Vercel (free Hobby tier). |
| **Contact-form destination** | `gdev.swapon@gmail.com` |
| **AI assistant** | Google Gemini API (user's key), server-side only. |
| **Privacy** | Email + form only. No phone and no street address on the site or the new resume. Location shows as `Dhaka, Bangladesh`. |
| **Domain** | `*.vercel.app` for now. The old `onrender.com` URL redirects to it. A custom domain can be added later. |
| **Language** | English at launch, with a structure ready for i18n. Bangla comes later. |

**Sources:** The resume PDF, the GitHub API, and the profile README (`AlphaNoob07/AlphaNoob07`). LinkedIn blocks automated access (`HTTP 999`), so LinkedIn data comes from the user's own LinkedIn data export (see *Content Needed*).

---

## Verified Profile (Content Source of Truth)

### Experience (from Resume & GitHub)
| Period | Role | Company |
| :--- | :--- | :--- |
| `? – present` | *(to confirm: title and start date)* | **Tulip Tech** (GitHub profile lists `tulip-tech.com`) |
| `Dec 2024 – present?` | AR/VR Developer [Programmer]: AR anatomy and surgical simulation, gynecology training sim for doctors and nurses | **VirtuCareBD.AI** (sister concern of LABAID Cancer Hospital) |
| `Mar 2024 – Mar 2025` | AR/VR Developer | **Dreamerz Lab Limited** |
| `Jan 2021 – Oct 2023` | Senior Unity Game Developer | **Techno Magic Pvt. Ltd.** |
| `Feb 2016 – Dec 2021` | Unity Game Developer | **Techno Magic Pvt. Ltd.** |
| `Jan 2015 – Feb 2016` | Software Developer & Teacher (trainee): Lua/Corona SDK, Phaser, Unity, Arduino | **CAFFEBD** |

### Education
- **BA (Hons) English**, European University of Bangladesh (`2020–2023`)
- **HSC**, Pollabi Degree College (`2017–2018`)

### Skills (Supported by Sources, No Percentages Anywhere)
- **Resume:** C#, Blueprint, JavaScript, Node.js, Lua, Verse, Unity, Unreal, UEFN, Phaser, Solar2D, HTML5/CSS, AR/VR.
- **GitHub README:** C++, Python, XREAL SDK, AR Foundation, MRTK, Oculus SDK, ARKit, ARCore, Photon PUN 2, Mirror, Netcode, Kinect/Azure Kinect, Vuforia, Wikitude, Immersal, Quest/Vive/HoloLens.
- **Tulip work (generic):** OpenXR, Android XR, computer vision, ONNX / Unity Inference Engine, MediaPipe.

### Projects
- The 6 existing projects (`Stellar VR Explorer`, `AR Museum Guide`, `Quantum Warriors`, `AR Home Designer`, `BioLab VR`, `Rhythm Dimension`).
- **GitHub README:** Teen Patti Multiplayer (Photon PUN 2), Kinect "Red Light, Green Light", AI AR Fitting Room, UE5 VR/AR Booth.
- **Repos:** `AR-Shooter`, `Example-AR-Image-Tracking`.
- **VirtuCare:** Gynecology AR sim and AR anatomy apps.
- **Tulip Tech (generic):** XR sports viewing on AR glasses, AI football tactical analysis (CV), Android XR prototypes.

**Rule:** No invented text. Any field without a source stays empty, and the UI hides it. Case-study sections (challenges, solutions, outcomes) are written only from notes the user provides, then reviewed by the user.

---

## Architecture
- **Stack:** Astro (latest stable, TypeScript) with `@astrojs/vercel`.
- All public pages are prerendered static and served from Vercel's CDN.
- APIs and admin pages render on demand as Vercel Functions.
- Styling is plain CSS with design tokens, continuing the current hand-written CSS approach (no Tailwind).
- Public pages use small vanilla-TS islands and no UI framework. React loads only inside the Keystatic admin.

### Services (All Free Tier; Gemini Billed to User's Key)
| Need | Service | Notes |
| :--- | :--- | :--- |
| **Hosting** | Vercel Hobby | Every branch gets a preview URL. One daily cron (Hobby limit). |
| **Database** | Neon Postgres (via Vercel Marketplace) + Drizzle ORM | Contact submissions, rate-limit counters, chat usage counter, daily analytics snapshots. |
| **Email** | Resend | Sends from `onboarding@resend.dev` to the Resend account owner (`gdev.swapon@gmail.com`). Switch to a custom domain later. |
| **Spam** | Cloudflare Turnstile + honeypot field + minimum fill time | Server-verified protection. |
| **Analytics** | Umami Cloud (cookieless, no consent banner needed) | Server-side API key. Daily cron saves totals to Neon so all-time numbers survive the retention window. |
| **AI** | Google Gemini (`@google/genai`) | Model set via `GEMINI_MODEL` env var (current Flash-tier model, confirmed in Google's docs at implementation time). |
| **Admin auth** | Auth.js (`auth-astro`) with GitHub OAuth | Sign-in allowed only for the numeric GitHub user ID of `AlphaNoob07`. |
| **Content editing** | Keystatic at `/keystatic` | `local` mode in dev, `github` mode in prod. Covers blog, projects, testimonials, certifications, and availability. |

### Planned Layout
```text
src/content/              # single source of truth (Markdown/YAML, zod-validated)
  profile.yaml            # name, headline, intro, links, email, location
  experience/*.md
  projects/*.mdx
  blog/*.mdx
  skills.yaml             # categories -> skills -> related project slugs
  testimonials/*.yaml     # requires source: linkedin | written-permission
  certifications/*.yaml
  availability.yaml       # status defaults to "hidden"
src/content.config.ts     # schemas; build fails on invalid content
src/styles/               # tokens.css, glass.css, base.css, print.css
src/components/           # GlassPanel, NavBar, ThemeToggle, Hero, SkillUniverse,
                          # Timeline, ProjectCard, ProjectFilters, XRShowcase,
                          # GitHubShowcase, StatsPanel, AvailabilityBadge,
                          # ContactForm, Assistant, Lightbox
src/layouts/              # Base (SEO, OG, JSON-LD Person), CaseStudy, Post
src/pages/                # index, projects/[slug], blog/[slug], resume,
                          # admin/* (on-demand, auth), api/{contact,chat,stats,github},
                          # api/admin/*, api/cron/snapshot
src/lib/                  # db, ratelimit, umami, github, knowledge, auth, validate
src/middleware.ts         # /admin + /api/admin guard, security headers
scripts/build-resume-pdf.ts # Playwright prints /resume to public/resume/*.pdf
```

---

## Design System (Original, visionOS-Inspired)
- **Tokens:** `:root` holds the dark theme (graphite `#0b0c10`, deep black, blue/violet accents). `[data-theme=light]` holds the light theme (white/silver, blue accent).
- **Glass surface:** translucent fill; 1px hairline border; inset top highlight (`::before` specular gradient); layered ambient and key shadows; `28px` radius on panels, pill shapes on controls.
- **Blur budget:** `backdrop-filter: blur(20px) saturate(160%)` (plus `-webkit-` prefix for Safari) only on the nav, cards, assistant sheet, and modals; smaller radius on mobile; `@supports` fallback to a solid translucent fill; `prefers-reduced-transparency` switches to opaque surfaces.
- **Background:** One fixed, slow, transform-only gradient "environment" refracted by glass. Pauses under `prefers-reduced-motion`. Replaces the current emoji particle system.
- **Type:** Inter Variable (self-hosted via `@fontsource-variable/inter`) with `system-ui` fallback and fluid `clamp()` sizing.
- **Theme:** Follows system by default; toggle saves to `localStorage` (wrapped in `try/catch`); inline head script prevents FOUC.
- **Motion:** Astro View Transitions between pages; `IntersectionObserver` reveals; spring-like easing curve; pointer parallax of `4°` or less on hero panes only; subtle pointer "spotlight" on glass cards instead of a custom cursor.
- **Contrast:** WCAG AA checked on glass in both themes.

---

## Site Sections
1. **Floating Nav (glass pill):** Home, About, Skills, Experience, Projects, XR, Blog, Contact, and theme toggle. Smooth scroll, active section tracked by `IntersectionObserver`, mobile menu as a glass bottom sheet. Blog link hides until a post exists.
2. **Hero:** Headline `"Building Experiences Beyond the Screen."`, intro line `"XR Developer | Unity & Unreal Engine | Spatial Computing | AI Integration | Game Development"`, optimized portrait, Explore Projects & Contact Me buttons, LinkedIn & GitHub links, availability badge (hidden until set), 2–3 layered glass panes with depth parallax. Removes `herokuapp` typing SVG.
3. **About:** Journey, philosophy, XR, games, and AI from verified facts (user approves copy).
4. **Technology Universe:** SVG constellation with five category hubs (`Engines`, `Programming`, `XR & Spatial`, `Game Dev`, `AI & Emerging`) and skill nodes. Links computed at build time from `tech[]` in projects. Hover/focus highlights links and opens a glass side panel listing related projects. Keyboard accessible with semantic grouped-list fallback.
5. **Experience Timeline:** Vertical glass timeline with company, title, period, responsibilities, tech, and related project links.
6. **Featured Projects:** Filter chips (`XR`, `Unity`, `Unreal`, `Medical`, `AI`, `Games`). Cards show poster image; desktop hover plays muted looping preview video (`preload="none"`). Case-study pages (`/projects/[slug]`) include Overview, Objectives, Role, Tech, Challenges, Solutions, Outcomes, media gallery with lightbox, and links (empty sections omitted).
7. **XR & Innovation:** Capability panes for AR, VR, MR, Android XR / AR glasses, spatial computing, AI + XR, motion tracking (Kinect), and real-time medical simulation. Lazy `<model-viewer>` for `Luna_anim_V5.glb` loads on click (if approved).
8. **GitHub Showcase:** Server-side API route with cache + build-time JSON fallback.
9. **Recommendations & Milestones:** Testimonials and certifications (render only when verified entries exist).
10. **Blog:** MDX posts edited in Keystatic with reading time and tags (hidden while empty).
11. **Availability + Contact:** Status (hidden by default) + engagement types (`freelance`, `contract`, `consulting`, `XR collaboration`, `full-time`) + contact form.
12. **Footer:** Live visitor-stats glass widget, links, copyright.

---

## Functional Features
- **Contact (`/api/contact`):** inline validation, UUID idempotency key, loading spinner, zod validation, honeypot & min-time checks, Turnstile, salted IP hash rate limit (`5/hr`, `20/day`), Neon deduplication & persistence, Resend email to `gdev.swapon@gmail.com`, 12-month cron cleanup.
- **Analytics (Umami Cloud + `/api/stats`):** pageviews + custom events (`project_view`, `case_study_open`, `section_view`, `cv_download`, `contact_submit`, `assistant_open`); cached totals (5 min) & active visitors (60s); `"Stats unavailable"` on failure.
- **Admin Dashboard (`/admin`):** middleware-guarded, GitHub OAuth restricted to `AlphaNoob07`, `401` on `/api/admin/*` without session + origin check on POST, `noindex` / `X-Robots-Tag`, excluded from sitemap.
- **GitHub (`/api/github`):** `GITHUB_TOKEN`, REST public repos (`private:false`, forks hidden by default), public events, GraphQL `contributionsCollection`, curated repos first, `s-maxage=3600, stale-while-revalidate=86400`, build-time fallback snapshot.
- **AI Assistant (`/api/chat`, Gemini):** build-time `lib/knowledge.ts`, strict grounded system instruction, streaming responses, 500-char input limit, 8-turn history, `20 msg/hr/IP`, global daily Neon cap, deterministic FAQ chip fallback, `aria-live` glass sheet.
- **Resume (`/resume` & PDF):** A4 print stylesheet; `npm run resume` (Playwright) writes `public/resume/Swapon-Islam-Resume.pdf`. No percentages, phone, or street address; email typo fixed.
- **SEO, Security & Performance:** Meta tags, OG image, JSON-LD (`Person`, `CreativeWork`), `@astrojs/sitemap`, `robots.txt`, `vercel.json` headers (CSP, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`), AVIF/WebP via `astro:assets`, Lighthouse mobile targets: Performance >= 90, Accessibility 100, SEO 100.

---

## Content & Accounts Needed From User
- LinkedIn data export (Profile, Positions, Education, Certifications, Recommendations).
- Tulip Tech title & start date; whether VirtuCareBD is still current.
- Headline experience phrasing confirmation (`Jan 2015`, ~11 years).
- Per-project details, media, and links (6 existing + new projects).
- Approved screenshots for Tulip Tech and VirtuCare.
- Approval & authorship confirmation for `Luna_anim_V5.glb`.
- Availability status and engagement types.
- Accounts to set up: Vercel, Neon (via Vercel), Resend (`gdev.swapon@gmail.com`), Cloudflare Turnstile, Umami Cloud, Google AI Studio (Gemini key), GitHub OAuth App + Keystatic GitHub App.

---

## Execution Milestones (Branch: `redesign/liquid-glass`)

| # | Milestone | Checkpoint |
| :--- | :--- | :--- |
| **M0** | Scaffold Astro in the repo. Move profile image, GLB, and resume into `src/assets` / `public`. Add `.env.example`, Vercel project and preview. | Preview URL works |
| **M1** | Content collections and schemas, filled with verified profile data, plus importers for LinkedIn export CSVs. | User reviews all content |
| **M2** | Design tokens, glass components, theme toggle, nav, background, base layout, and SEO. | User approves look and feel on preview |
| **M3** | Home sections: hero, about, Technology Universe, timeline, project grid and filters, XR showcase, availability, contact UI. | Review |
| **M4** | Case-study pages, media pipeline, and lightbox using user media. | Review |
| **M5** | GitHub showcase: API route, cache, fallback snapshot. | — |
| **M6** | Umami tracking, `/api/stats`, public widget, Neon, admin auth and dashboard, daily snapshot cron, Keystatic. | Admin login test |
| **M7** | Contact pipeline: Resend, Turnstile, rate limiting, deduplication. | A real email arrives |
| **M8** | Gemini assistant: knowledge pack, streaming, limits, fallback. | Q&A accuracy review |
| **M9** | `/resume` and generated PDF. | User approves resume |
| **M10** | Performance, accessibility, and SEO pass; remove dead `Source/javascripts.js` and old CSS. | Lighthouse report |
| **M11** | Full test pass, merge to `main`, production deploy, 301 redirect from `onrender.com`, update GitHub README link (with permission). | Production check |

---

## Verification Checklist
- **Build gates:** `npm run build` and `astro check` pass with no warnings.
- **E2E (Playwright: Chromium, Firefox, WebKit at `375/768/1280/1920px`):** nav & active section, theme toggle persistence & system default, reduced-motion, contact validation/states, `/admin` redirect & `401` on `/api/admin/*`, zero console errors.
- **Contact:** real email + Neon row, idempotency deduplication, `429` on 6th submit/hr, `400` on bad Turnstile token.
- **Analytics:** 2 devices = 2 uniques, refresh doesn't increment, `/api/stats` matches Umami, broken key shows `"Stats unavailable"`.
- **GitHub:** `private:false` only; bad token serves fallback snapshot.
- **Admin:** non-admin GitHub rejected, `AlphaNoob07` allowed, message read/archive works.
- **AI Assistant:** 5 example questions match content, off-profile (`Rust`) -> `"I don't have that information"`, unset key -> FAQ fallback, rate limit triggers.
- **Quality:** Lighthouse mobile & axe audit, real Safari/Chrome/Firefox/phone check, `curl -I` security headers.
- **Cutover:** `onrender.com` 301 redirect, sitemap & `robots.txt` served, all old site essentials preserved.
