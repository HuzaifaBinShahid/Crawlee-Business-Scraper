/**
 * Smoke test: scrape gyms in Lahore, verify ≥100 records and no fatal errors.
 *
 * Spawns the real scraper, captures stdout/stderr, and after the run reads the
 * client NDJSON to count how many new records were added.
 *
 * Usage: node scripts/testLahoreGyms.js [--target=100] [--no-headless]
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const args = process.argv.slice(2).reduce((acc, a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) acc[m[1]] = m[2] ?? true;
  return acc;
}, {});

const TARGET = parseInt(args.target || '100', 10);
const HEADLESS = args.headless !== 'false' && args['no-headless'] === undefined;

const ndjsonPath = path.join(projectRoot, 'data', 'output', 'businesses_PK_client_full.ndjson');
const jsonPath = path.join(projectRoot, 'data', 'output', 'businesses_PK_client_full.json');

async function countRecords(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  if (filePath.endsWith('.ndjson')) {
    let n = 0;
    const rl = readline.createInterface({ input: fs.createReadStream(filePath, 'utf-8'), crlfDelay: Infinity });
    for await (const line of rl) if (line.trim()) n++;
    return n;
  }
  // .json
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (Array.isArray(parsed)) return parsed.length;
    if (parsed.data && Array.isArray(parsed.data)) return parsed.data.length;
    if (typeof parsed.totalRecords === 'number') return parsed.totalRecords;
  } catch (e) {}
  return 0;
}

function fmtDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

async function main() {
  console.log('='.repeat(70));
  console.log('SMOKE TEST: Gyms in Lahore');
  console.log('='.repeat(70));
  console.log(`Target:   ≥ ${TARGET} new records`);
  console.log(`Headless: ${HEADLESS}`);
  console.log(`Project:  ${projectRoot}`);
  console.log('');

  const baselineNdjson = await countRecords(ndjsonPath);
  const baselineJson = await countRecords(jsonPath);
  const baseline = Math.max(baselineNdjson, baselineJson);
  console.log(`Pre-run record count: ${baseline}`);
  console.log('');

  const cliArgs = [
    '--max-old-space-size=2048',
    'src/main.js',
    '--country=PK',
    '--category=Gyms & Fitness',
    '--city=Lahore',
  ];
  if (!HEADLESS) cliArgs.push('--no-headless');

  console.log(`Launching: node ${cliArgs.join(' ')}`);
  console.log('-'.repeat(70));

  const start = Date.now();
  const child = spawn('node', cliArgs, { cwd: projectRoot, shell: false });

  let stderrBuf = '';
  const fatalPatterns = [
    /object has been collected to prevent unbounded heap growth/i,
    /Target page, context or browser has been closed/i,
  ];
  let fatalDetected = null;

  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    const text = chunk.toString();
    for (const pat of fatalPatterns) if (pat.test(text) && !fatalDetected) fatalDetected = pat.toString();
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
    stderrBuf += chunk.toString();
    for (const pat of fatalPatterns) if (pat.test(stderrBuf) && !fatalDetected) fatalDetected = pat.toString();
  });

  const exitCode = await new Promise((resolve) => child.on('close', resolve));
  const elapsed = Date.now() - start;

  console.log('');
  console.log('-'.repeat(70));
  console.log(`Exit code:    ${exitCode}`);
  console.log(`Elapsed:      ${fmtDuration(elapsed)}`);

  const afterNdjson = await countRecords(ndjsonPath);
  const afterJson = await countRecords(jsonPath);
  const after = Math.max(afterNdjson, afterJson);
  const newRecords = after - baseline;

  console.log(`Records pre:  ${baseline}`);
  console.log(`Records post: ${after}`);
  console.log(`New records:  ${newRecords}`);
  if (fatalDetected) console.log(`Fatal error detected in output: ${fatalDetected}`);
  console.log('');

  const passed = exitCode === 0 && newRecords >= TARGET && !fatalDetected;
  console.log('='.repeat(70));
  console.log(passed ? `✅ PASS — added ${newRecords} new records (target ${TARGET})` : `❌ FAIL`);
  if (!passed) {
    if (exitCode !== 0) console.log(`   reason: non-zero exit code ${exitCode}`);
    if (newRecords < TARGET) console.log(`   reason: only ${newRecords} new records, needed ${TARGET}`);
    if (fatalDetected) console.log(`   reason: fatal error: ${fatalDetected}`);
  }
  console.log('='.repeat(70));

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error('Test harness crashed:', err);
  process.exit(2);
});
