import fs from 'node:fs/promises';
import path from 'node:path';

interface CsvRow {
  [key: string]: string;
}

const ROOT_DIR = process.cwd();
const CONTENT_DIR = path.join(ROOT_DIR, 'src', 'content');

/**
 * RFC-4180 compliant CSV parser supporting quoted fields, escaped quotes (""),
 * embedded commas, multiline values, and optional UTF-8 BOM.
 */
export function parseCsv(rawText: string): CsvRow[] {
  const text = rawText.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          currentField += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i += 1;
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        records.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else if (ch === '\n') {
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        records.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += ch;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      records.push(currentRow);
    }
  }

  if (records.length < 2) return [];

  const headers = records[0];
  return records.slice(1).map((row) => {
    const obj: CsvRow = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx] ?? '';
    });
    return obj;
  });
}

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'entry';
}

function yamlString(value: string): string {
  return JSON.stringify(value.replace(/\r\n/g, '\n').trim());
}

function normalizeUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function readCsvIfExists(
  exportDir: string,
  candidates: string[]
): Promise<{ fileName: string; rows: CsvRow[] } | null> {
  for (const name of candidates) {
    const fullPath = path.join(exportDir, name);
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      return { fileName: name, rows: parseCsv(content) };
    } catch {
      // Try next candidate
    }
  }
  return null;
}

async function loadExistingExperienceSignatures(): Promise<Set<string>> {
  const expDir = path.join(CONTENT_DIR, 'experience');
  const signatures = new Set<string>();
  const files = await fs.readdir(expDir).catch(() => [] as string[]);

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const raw = await fs.readFile(path.join(expDir, file), 'utf-8');
    const companyMatch = raw.match(/^company:\s*"?(.+?)"?\s*$/m);
    const roleMatch = raw.match(/^role:\s*"?(.+?)"?\s*$/m);
    if (companyMatch && roleMatch) {
      signatures.add(
        `${companyMatch[1].toLowerCase().trim()}::${roleMatch[1].toLowerCase().trim()}`
      );
    }
  }
  return signatures;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const writeMode = args.includes('--write');
  const dirArg = args.find((arg: string) => !arg.startsWith('-'));

  if (!dirArg) {
    console.error(
      'Usage: npm run import:linkedin -- <linkedin-export-dir> [--write]'
    );
    process.exit(1);
  }

  const exportDir = path.resolve(ROOT_DIR, dirArg);
  const stat = await fs.stat(exportDir).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    console.error(`Directory not found: ${exportDir}`);
    process.exit(1);
  }

  console.log(
    `LinkedIn Export Importer (${writeMode ? 'WRITE MODE' : 'DRY RUN'})`
  );
  console.log(`Source: ${exportDir}\n`);

  // 1. Profile.csv (diff report only; never imports phone/address or overwrites email)
  const profileCsv = await readCsvIfExists(exportDir, ['Profile.csv']);
  if (profileCsv && profileCsv.rows.length > 0) {
    const row = profileCsv.rows[0];
    const fullName = [row['First Name'], row['Last Name']]
      .filter(Boolean)
      .join(' ');
    console.log(`[Profile.csv] Found profile row:`);
    if (fullName) console.log(`  - Name: ${fullName}`);
    if (row['Headline']) console.log(`  - Headline: ${row['Headline']}`);
    if (row['Geo Location']) console.log(`  - Location: ${row['Geo Location']}`);
    if (row['Summary']) {
      console.log(`  - Summary (${row['Summary'].length} chars) available for review.`);
    }
    console.log(
      '  Note: profile.yaml is not overwritten automatically (phone/address excluded by policy).\n'
    );
  }

  // 2. Positions.csv
  const positionsCsv = await readCsvIfExists(exportDir, ['Positions.csv']);
  if (positionsCsv) {
    const existing = await loadExistingExperienceSignatures();
    let newCount = 0;
    let skippedCount = 0;
    let orderCursor = 100;

    for (const row of positionsCsv.rows) {
      const company = row['Company Name'] || '';
      const title = row['Title'] || '';
      if (!company || !title) continue;

      const sig = `${company.toLowerCase()}::${title.toLowerCase()}`;
      if (existing.has(sig)) {
        skippedCount += 1;
        continue;
      }

      newCount += 1;
      const startedOn = row['Started On'] || 'TBD';
      const finishedOn = row['Finished On'] || '';
      const current = finishedOn.length === 0;
      const period = current ? `${startedOn} – Present` : `${startedOn} – ${finishedOn}`;
      const location = row['Location'] || 'Dhaka, Bangladesh';
      const descriptionLines = (row['Description'] || '')
        .split(/\r?\n/)
        .map((line) => line.replace(/^[-•*]\s*/, '').trim())
        .filter(Boolean);

      const fileName = `linkedin-${slugify(`${company}-${title}`)}.md`;
      const targetPath = path.join(CONTENT_DIR, 'experience', fileName);

      if (writeMode) {
        const responsibilitiesYaml =
          descriptionLines.length > 0
            ? descriptionLines.map((line) => `  - ${yamlString(line)}`).join('\n')
            : '  - "Imported from LinkedIn (review responsibilities)"';

        const md = [
          '---',
          `order: ${orderCursor}`,
          `company: ${yamlString(company)}`,
          `role: ${yamlString(title)}`,
          `period: ${yamlString(period)}`,
          `startDate: ${yamlString(startedOn)}`,
          ...(finishedOn ? [`endDate: ${yamlString(finishedOn)}`] : []),
          `current: ${current}`,
          'needsConfirmation: true',
          `location: ${yamlString(location)}`,
          'responsibilities:',
          responsibilitiesYaml,
          'tech:',
          '  - "AR/VR"',
          'relatedProjects: []',
          '---',
          '',
        ].join('\n');

        await fs.writeFile(targetPath, md, 'utf-8');
        orderCursor += 1;
      }

      console.log(
        `  + Position: ${title} @ ${company} (${period}) -> ${fileName}`
      );
    }

    console.log(
      `[Positions.csv] ${positionsCsv.rows.length} rows (${newCount} new, ${skippedCount} matched existing).\n`
    );
  }

  // 3. Education.csv (diff summary)
  const educationCsv = await readCsvIfExists(exportDir, ['Education.csv']);
  if (educationCsv) {
    console.log(`[Education.csv] ${educationCsv.rows.length} row(s):`);
    for (const row of educationCsv.rows) {
      const school = row['School Name'] || 'Unknown School';
      const degree = row['Degree Name'] || '';
      const start = row['Start Date'] || '';
      const end = row['End Date'] || '';
      console.log(`  - ${degree || 'Program'} @ ${school} (${start}–${end})`);
    }
    console.log(
      '  Note: Review against education[] in src/content/profile.yaml.\n'
    );
  }

  // 4. Certifications.csv
  const certsCsv = await readCsvIfExists(exportDir, ['Certifications.csv']);
  if (certsCsv) {
    let written = 0;
    for (const row of certsCsv.rows) {
      const name = row['Name'] || '';
      const authority = row['Authority'] || '';
      if (!name || !authority) continue;

      const fileName = `${slugify(`${authority}-${name}`)}.yaml`;
      const targetPath = path.join(CONTENT_DIR, 'certifications', fileName);
      const validUrl = normalizeUrl(row['Url']);

      if (writeMode) {
        const lines = [
          `name: ${yamlString(name)}`,
          `authority: ${yamlString(authority)}`,
          ...(row['License Number']
            ? [`licenseNumber: ${yamlString(row['License Number'])}`]
            : []),
          ...(row['Started On']
            ? [`issuedAt: ${yamlString(row['Started On'])}`]
            : []),
          ...(row['Finished On']
            ? [`expiresAt: ${yamlString(row['Finished On'])}`]
            : []),
          ...(validUrl ? [`url: ${yamlString(validUrl)}`] : []),
          'source: "linkedin"',
          '',
        ];
        await fs.writeFile(targetPath, lines.join('\n'), 'utf-8');
      }
      written += 1;
      console.log(`  + Certification: ${name} (${authority}) -> ${fileName}`);
    }
    console.log(`[Certifications.csv] ${written} certification(s) processed.\n`);
  }

  // 5. Recommendations_Received.csv
  const recsCsv = await readCsvIfExists(exportDir, [
    'Recommendations_Received.csv',
    'Recommendations Received.csv',
  ]);
  if (recsCsv) {
    let visibleCount = 0;
    let skippedHidden = 0;

    for (const row of recsCsv.rows) {
      const status = (row['Status'] || '').trim().toUpperCase();
      if (status && status !== 'VISIBLE') {
        skippedHidden += 1;
        continue;
      }

      const author = [row['First Name'], row['Last Name']]
        .filter(Boolean)
        .join(' ')
        .trim();
      const quote = (row['Text'] || '').trim();
      if (!author || !quote) continue;

      const fileName = `${slugify(author)}.yaml`;
      const targetPath = path.join(CONTENT_DIR, 'testimonials', fileName);

      if (writeMode) {
        const lines = [
          `author: ${yamlString(author)}`,
          ...(row['Job Title'] ? [`role: ${yamlString(row['Job Title'])}`] : []),
          ...(row['Company'] ? [`company: ${yamlString(row['Company'])}`] : []),
          ...(row['Creation Date']
            ? [`date: ${yamlString(row['Creation Date'])}`]
            : []),
          `quote: ${yamlString(quote)}`,
          'source: "linkedin"',
          '',
        ];
        await fs.writeFile(targetPath, lines.join('\n'), 'utf-8');
      }

      visibleCount += 1;
      console.log(`  + Recommendation: ${author} -> ${fileName}`);
    }
    console.log(
      `[${recsCsv.fileName}] ${visibleCount} visible recommendation(s) processed (${skippedHidden} non-visible skipped).\n`
    );
  }

  if (!writeMode) {
    console.log('Dry run complete. Re-run with --write to save generated files.');
  } else {
    console.log('Write complete. Run `npm run check && npm run build` to validate.');
  }
}

main().catch((err) => {
  console.error('Importer failed:', err);
  process.exit(1);
});
