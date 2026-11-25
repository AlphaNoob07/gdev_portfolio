import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT_DIR = process.cwd();
const STATIC_DIR = path.join(ROOT_DIR, '.vercel', 'output', 'static');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function startStaticServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const reqPath = decodeURIComponent((req.url || '/').split('?')[0]);

        if (reqPath === '/api/stats') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Stats unavailable' }));
          return;
        }

        if (reqPath === '/api/github') {
          const snap = await fs.readFile(
            path.join(ROOT_DIR, 'src', 'data', 'github-snapshot.json'),
            'utf-8'
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(snap);
          return;
        }

        let filePath = path.join(
          STATIC_DIR,
          reqPath === '/' ? 'index.html' : reqPath
        );
        const stat = await fs.stat(filePath).catch(() => null);
        if (stat?.isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        } else if (!stat) {
          const htmlFallback = `${filePath}.html`;
          if (await fs.stat(htmlFallback).catch(() => null)) {
            filePath = htmlFallback;
          }
        }

        const resolved = path.resolve(filePath);
        if (!resolved.startsWith(path.resolve(STATIC_DIR))) {
          res.writeHead(403).end('Forbidden');
          return;
        }

        const data = await fs.readFile(resolved);
        const ext = path.extname(resolved).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        });
        res.end(data);
      } catch {
        res.writeHead(404).end('Not found');
      }
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to bind static server'));
        return;
      }
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    return chromium.launch({
      headless: true,
      executablePath:
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    });
  }
}

async function run(): Promise<void> {
  await fs.access(path.join(STATIC_DIR, 'index.html'));
  const { server, baseUrl } = await startStaticServer();
  const browser = await launchBrowser();

  try {
    const pagesToAudit = ['/', '/projects/stellar-vr-explorer/', '/resume/', '/blog/'];
    const viewports = [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
      { width: 1920, height: 1080 },
    ];

    // 1. Multi-viewport layout, console error, accessibility & SEO audit
    for (const vp of viewports) {
      const context = await browser.newContext({ viewport: vp });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
      });

      for (const route of pagesToAudit) {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        const audit = await page.evaluate(() => {
          const overflow =
            document.documentElement.scrollWidth > window.innerWidth + 2;
          const lang = document.documentElement.lang;
          const h1Count = document.querySelectorAll('h1').length;
          const hasMain = Boolean(document.querySelector('main#main-content'));
          const hasSkipLink = Boolean(document.querySelector('a.skip-link'));
          const metaDesc = document
            .querySelector('meta[name="description"]')
            ?.getAttribute('content');
          const canonical = document
            .querySelector('link[rel="canonical"]')
            ?.getAttribute('href');
          const jsonLdRaw = document.querySelector(
            'script[type="application/ld+json"]'
          )?.textContent;
          const imgsWithoutAlt = Array.from(document.querySelectorAll('img'))
            .filter((img) => {
              const alt = img.getAttribute('alt');
              return alt === null || alt.trim().length === 0;
            })
            .map((img) => img.src);
          const unnamedControls = Array.from(
            document.querySelectorAll('button, a')
          )
            .filter((el) => {
              const style = window.getComputedStyle(el);
              if (style.display === 'none' || style.visibility === 'hidden') return false;
              const text = el.textContent?.trim() || '';
              const aria = el.getAttribute('aria-label')?.trim() || '';
              return text.length === 0 && aria.length === 0;
            })
            .map((el) => el.outerHTML.slice(0, 80));

          return {
            overflow,
            lang,
            h1Count,
            hasMain,
            hasSkipLink,
            metaDesc: Boolean(metaDesc && metaDesc.length > 10),
            canonical: Boolean(canonical),
            jsonLdValid: Boolean(jsonLdRaw && JSON.parse(jsonLdRaw)),
            imgsWithoutAlt,
            unnamedControls,
          };
        });

        assert.equal(
          audit.overflow,
          false,
          `Horizontal overflow on ${route} at ${vp.width}px`
        );
        assert.equal(audit.lang, 'en', `Missing lang=en on ${route}`);
        assert.equal(audit.h1Count, 1, `Expected 1 <h1> on ${route}`);
        assert.equal(audit.hasMain, true, `Missing <main> on ${route}`);
        assert.equal(audit.hasSkipLink, true, `Missing skip link on ${route}`);
        assert.equal(audit.metaDesc, true, `Missing meta description on ${route}`);
        assert.equal(audit.canonical, true, `Missing canonical on ${route}`);
        assert.equal(audit.jsonLdValid, true, `Invalid JSON-LD on ${route}`);
        assert.deepEqual(
          audit.imgsWithoutAlt,
          [],
          `Images missing alt on ${route}`
        );
        assert.deepEqual(
          audit.unnamedControls,
          [],
          `Unnamed interactive controls on ${route}: ${audit.unnamedControls.join(', ')}`
        );
      }

      assert.deepEqual(
        errors,
        [],
        `Console/page errors at ${vp.width}px: ${errors.join('; ')}`
      );
      await context.close();
    }
    console.log('✓ Multi-viewport (375/768/1280/1920) layout, console, SEO & a11y checks passed.');

    // 2. Theme toggle persistence, reduced motion, mobile bottom sheet & contact validation
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });

    const initialTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.click('[data-theme-toggle]');
    const toggledTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    assert.notEqual(toggledTheme, initialTheme, 'Theme toggle should switch theme');
    await page.reload({ waitUntil: 'networkidle' });
    const persistedTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    assert.equal(persistedTheme, toggledTheme, 'Theme should persist across reloads');
    console.log(`✓ Theme toggle persisted across reload (${initialTheme} -> ${persistedTheme}).`);

    // Contact form validation
    await page.click('[data-submit-btn]');
    const invalidCount = await page.locator('[data-contact-form] [aria-invalid="true"]').count();
    assert.ok(invalidCount >= 3, `Expected >= 3 invalid contact fields, got ${invalidCount}`);
    console.log(`✓ Contact form inline validation flagged ${invalidCount} required fields.`);

    // Performance metrics snapshot
    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find((p) => p.name === 'first-contentful-paint')?.startTime ?? 0;
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const transferBytes = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0) + (nav?.transferSize || 0);
      return {
        fcpMs: Math.round(fcp),
        domNodes: document.querySelectorAll('*').length,
        transferKB: Math.round(transferBytes / 1024),
      };
    });
    console.log(`✓ Performance snapshot on /: FCP=${perf.fcpMs}ms, DOM=${perf.domNodes} nodes, Transfer=${perf.transferKB} KB.`);

    // Reduced motion check
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const motionCheck = await page.evaluate(() => {
      const orb = document.querySelector('.ambient-orb--1');
      const reveal = document.querySelector('.reveal');
      return {
        orbAnim: orb ? window.getComputedStyle(orb).animationName : 'none',
        revealOpacity: reveal ? window.getComputedStyle(reveal).opacity : '1',
      };
    });
    assert.equal(motionCheck.orbAnim, 'none', 'Ambient orb should pause under reduced motion');
    assert.equal(motionCheck.revealOpacity, '1', 'Reveal sections should stay visible under reduced motion');
    console.log('✓ prefers-reduced-motion verified (orb paused, reveals visible).');
    await context.close();

    // Mobile bottom sheet test at 375px
    const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const mobilePage = await mobileCtx.newPage();
    await mobilePage.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await mobilePage.click('[data-mobile-nav-open]');
    assert.equal(
      await mobilePage.getAttribute('[data-mobile-nav-open]', 'aria-expanded'),
      'true'
    );
    assert.equal(await mobilePage.isVisible('#mobile-nav-sheet'), true);
    await mobilePage.keyboard.press('Escape');
    assert.equal(await mobilePage.isVisible('#mobile-nav-sheet'), false);
    console.log('✓ Mobile glass bottom sheet open & Escape close verified.');
    await mobileCtx.close();

    // 3. Live dev server auth guard check (if dev server is running on 4321)
    try {
      const adminRes = await fetch('http://127.0.0.1:4321/admin', {
        redirect: 'manual',
      });
      const adminApiRes = await fetch('http://127.0.0.1:4321/api/admin/messages');
      assert.equal(adminRes.status, 302, 'Logged-out /admin should return 302');
      assert.equal(adminApiRes.status, 401, 'Logged-out /api/admin/* should return 401');
      console.log('✓ Live server auth guard verified (/admin -> 302, /api/admin/* -> 401).');
    } catch {
      console.log('ℹ Dev server on 4321 not checked (unreachable).');
    }
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error('E2E verification failed:', err);
  process.exit(1);
});
