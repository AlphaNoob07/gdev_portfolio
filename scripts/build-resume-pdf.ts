import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT_DIR = process.cwd();
const OUTPUT_PDF = path.join(
  ROOT_DIR,
  'public',
  'resume',
  'Swapon-Islam-Resume.pdf'
);

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
};

async function findStaticRoot(): Promise<string> {
  const candidates = [
    path.join(ROOT_DIR, '.vercel', 'output', 'static'),
    path.join(ROOT_DIR, 'dist', 'client'),
    path.join(ROOT_DIR, 'dist'),
  ];
  for (const dir of candidates) {
    try {
      await fs.access(path.join(dir, 'resume', 'index.html'));
      return dir;
    } catch {
      // Try next candidate
    }
  }
  throw new Error(
    'Built /resume page not found. Run `npm run build` before `npm run resume`.'
  );
}

function startStaticServer(staticRoot: string): Promise<{
  server: http.Server;
  baseUrl: string;
}> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const reqPath = decodeURIComponent((req.url || '/').split('?')[0]);
        let filePath = path.join(
          staticRoot,
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
        if (!resolved.startsWith(path.resolve(staticRoot))) {
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
        reject(new Error('Could not bind local server'));
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
    const systemChrome =
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    return chromium.launch({
      headless: true,
      executablePath: systemChrome,
    });
  }
}

async function main(): Promise<void> {
  const staticRoot = await findStaticRoot();
  const { server, baseUrl } = await startStaticServer(staticRoot);
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/resume/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: 'print' });

    await fs.mkdir(path.dirname(OUTPUT_PDF), { recursive: true });
    await page.pdf({
      path: OUTPUT_PDF,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '12mm',
        right: '14mm',
        bottom: '12mm',
        left: '14mm',
      },
    });

    const stats = await fs.stat(OUTPUT_PDF);
    console.log(
      `Generated ${path.relative(ROOT_DIR, OUTPUT_PDF)} (${Math.round(stats.size / 1024)} KB)`
    );
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('Resume PDF generation failed:', err);
  process.exit(1);
});
