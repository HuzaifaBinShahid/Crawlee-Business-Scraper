/**
 * End-to-end tests using mocked API responses.
 * The Vite dev server proxies /api to a backend, but here we intercept all /api
 * requests with Playwright's route.fulfill() to provide deterministic responses.
 */

import { test, expect } from '@playwright/test';

/**
 * In-memory mock backend. Tests can mutate these to change responses mid-test.
 */
function createMockState() {
  return {
    status: { status: 'idle', jobId: null },
    logs: { stdout: [], stderr: [], status: 'idle' },
    progress: {
      counters: { found: 0, saved: 0, skipped: 0, duplicates: 0, failed: 0 },
      currentTask: null,
      status: 'idle',
    },
    queue: { isRunning: false, isQueueRunning: false, currentJobId: null, pending: [], pendingCount: 0 },
    history: [],
    presets: [],
    settings: { minDelay: 2000, maxDelay: 5000, navTimeout: 90, maxRetries: 0, proxies: [] },
    data: [],
    categories: ['Health & Emergency', 'Gyms & Fitness', 'Food & Beverage'],
    cities: { PK: ['Karachi', 'Lahore', 'Islamabad'], SA: ['Riyadh', 'Jeddah'] },
    citiesFull: {
      PK: [{ name: 'Karachi', code: 'KHI' }, { name: 'Lahore', code: 'LHE' }, { name: 'Islamabad', code: 'ISB' }],
      SA: [{ name: 'Riyadh', code: 'RUH' }, { name: 'Jeddah', code: 'JED' }],
    },
    countries: [
      { code: 'UK', name: 'United Kingdom', scraper: 'grocery' },
      { code: 'FR', name: 'France',         scraper: 'grocery' },
      { code: 'PK', name: 'Pakistan',       scraper: 'nationwide' },
      { code: 'SA', name: 'Saudi Arabia',   scraper: 'nationwide' },
    ],
  };
}

async function installMocks(page, state) {
  // Match only URLs whose pathname starts with /api/ (avoid matching /src/api/client.js)
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname.replace(/^\/api/, '');
    const method = route.request().method();
    let postData = null;
    try { postData = route.request().postDataJSON(); } catch (_) { }

    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    // Routes
    if (p === '/health') return json({ ok: true });
    if (p === '/run/status') return json(state.status);
    if (p === '/run/logs') return json(state.logs);
    if (p === '/run/progress') return json(state.progress);
    if (p === '/queue/status') return json(state.queue);
    if (p === '/history') {
      if (method === 'DELETE') { state.history = []; return json({ cleared: true }); }
      return json(state.history);
    }
    if (p === '/settings') {
      if (method === 'PUT') { state.settings = { ...state.settings, ...postData }; return json(state.settings); }
      return json(state.settings);
    }
    if (p === '/presets') {
      if (method === 'POST') {
        const { name, config } = postData;
        const existing = state.presets.findIndex((x) => x.name === name);
        const entry = { name, config, updatedAt: Date.now() };
        if (existing >= 0) state.presets[existing] = entry;
        else state.presets.push(entry);
        return json(entry);
      }
      return json(state.presets);
    }
    if (p.startsWith('/presets/')) {
      const name = decodeURIComponent(p.slice('/presets/'.length));
      state.presets = state.presets.filter((x) => x.name !== name);
      return json({ deleted: true });
    }
    if (p === '/data') return json({ data: state.data, metadata: {} });
    if (p === '/stats') return json({});
    if (p === '/quality') return json({ total: state.data.length, completeness: 80, missing: {}, duplicates: 0, incomplete: 0 });
    if (p === '/categories') return json(state.categories);
    // Cities — /cities?country=XX returns names; /cities/:cc/full returns full {name,code} entries
    {
      const fullMatch = p.match(/^\/cities\/([^/]+)\/full$/);
      if (fullMatch) {
        const cc = fullMatch[1].toUpperCase();
        return json(state.citiesFull[cc] || []);
      }
      const cityRm = p.match(/^\/cities\/([^/]+)\/([^/]+)$/);
      if (cityRm && method === 'DELETE') {
        const cc = cityRm[1].toUpperCase();
        const target = decodeURIComponent(cityRm[2]).toLowerCase();
        state.citiesFull[cc] = (state.citiesFull[cc] || []).filter((c) => c.name.toLowerCase() !== target);
        state.cities[cc] = (state.citiesFull[cc] || []).map((c) => c.name);
        return json({ removed: target, cities: state.citiesFull[cc] });
      }
      if (p === '/cities' && method === 'POST') {
        const { country, cities } = postData || {};
        const cc = String(country || '').toUpperCase();
        const cleaned = (cities || []).map((c) => typeof c === 'string'
          ? { name: c.trim(), code: '' }
          : { name: String(c.name || '').trim(), code: String(c.code || '').toUpperCase() })
          .filter((c) => c.name);
        state.citiesFull[cc] = cleaned;
        state.cities[cc] = cleaned.map((c) => c.name);
        return json({ country: cc, cities: cleaned });
      }
      if (p.startsWith('/cities')) {
        const country = url.searchParams.get('country');
        return json(state.cities[country] || []);
      }
    }
    // Countries registry
    if (p === '/countries') {
      if (method === 'POST') {
        const { code, name, scraper } = postData || {};
        const cc = String(code || '').toUpperCase().trim();
        const scraperType = scraper === 'grocery' ? 'grocery' : 'nationwide';
        const entry = { code: cc, name: String(name || '').trim(), scraper: scraperType };
        const idx = state.countries.findIndex((c) => c.code === cc);
        if (idx >= 0) state.countries[idx] = entry; else state.countries.push(entry);
        return json(entry);
      }
      return json(state.countries);
    }
    if (p.startsWith('/countries/')) {
      const cc = decodeURIComponent(p.slice('/countries/'.length)).toUpperCase();
      state.countries = state.countries.filter((c) => c.code !== cc);
      return json({ deleted: cc });
    }
    if (p === '/run') {
      state.status = { status: 'running', jobId: 'mock-1' };
      state.progress.status = 'running';
      state.progress.currentTask = { country: 'PK', city: 'Karachi', category: 'Gyms & Fitness' };
      return json({ jobId: 'mock-1' });
    }
    if (p === '/run/stop') {
      state.status = { status: 'idle', jobId: null };
      state.progress.status = 'idle';
      state.progress.currentTask = null;
      return json({ stopped: true });
    }
    if (p === '/run/pause') { state.status.status = 'paused'; return json({ paused: true }); }
    if (p === '/run/resume') { state.status.status = 'running'; return json({ resumed: true }); }
    if (p === '/queue') {
      const count = (postData?.jobs || []).length;
      state.status = { status: 'running', jobId: 'queue-1' };
      return json({ queued: count, jobIds: ['queue-1'] });
    }
    if (p === '/failed') return json(state.allFailed || []);
    if (p.startsWith('/failed/')) return json([]);
    if (p.startsWith('/retry/')) return json({ jobId: 'retry-1', retrying: true });
    if (p.startsWith('/resume/')) return json({ jobId: 'resume-1', resumed: true, fromJobId: p.split('/')[2] });

    return json({ error: 'not mocked: ' + p }, 404);
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Tabs navigation', () => {
  test('all 5 tabs are present and clickable', async ({ page }) => {
    const state = createMockState();
    await installMocks(page, state);
    await page.goto('/');

    await expect(page.getByTestId('tab-run')).toBeVisible();
    await expect(page.getByTestId('tab-data')).toBeVisible();
    await expect(page.getByTestId('tab-stats')).toBeVisible();
    await expect(page.getByTestId('tab-history')).toBeVisible();
    await expect(page.getByTestId('tab-settings')).toBeVisible();

    await page.getByTestId('tab-settings').click();
    await expect(page.getByTestId('settings-form')).toBeVisible();

    await page.getByTestId('tab-history').click();
    await expect(page.locator('h1', { hasText: 'Run History' })).toBeVisible();

    await page.getByTestId('tab-run').click();
    await expect(page.getByTestId('run-btn')).toBeVisible();
  });
});

test.describe('Run controls', () => {
  test('Run → Pause → Resume → Stop flow', async ({ page }) => {
    const state = createMockState();
    await installMocks(page, state);
    await page.goto('/');

    // Enable sample mode so no warning modal appears
    await page.getByText('Sample run (10 records)').click();
    await page.getByTestId('run-btn').click();
    await expect(page.getByTestId('pause-btn')).toBeVisible();
    await expect(page.getByTestId('stop-btn')).toBeVisible();

    await page.getByTestId('pause-btn').click();
    await expect(page.getByTestId('resume-btn')).toBeVisible();

    await page.getByTestId('resume-btn').click();
    await expect(page.getByTestId('pause-btn')).toBeVisible();

    await page.getByTestId('stop-btn').click();
    await expect(page.getByTestId('run-btn')).toBeVisible();
  });

  test('Progress panel shows when running (PK nationwide)', async ({ page }) => {
    const state = createMockState();
    // Set counters so panel shows live
    state.progress.counters = { found: 12, saved: 10, skipped: 2, duplicates: 1, failed: 0 };
    await installMocks(page, state);
    await page.goto('/');

    // Switch to PK so progress panel renders in side layout
    await page.getByTestId('run-country-select').click();
    await page.getByRole('option', { name: /Pakistan/ }).click();
    // Enable sample so no warning modal appears
    await page.getByText('Sample run (10 records)').click();
    await page.getByTestId('run-btn').click();

    // Wait for progress panel to appear
    await expect(page.getByTestId('progress-counters')).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('counter-saved')).toContainText('10');
    await expect(page.getByTestId('counter-found')).toContainText('12');
  });
});

test.describe('Warning modal for large runs', () => {
  test('shows warning when run estimate > 4 hours', async ({ page }) => {
    const state = createMockState();
    await installMocks(page, state);
    await page.goto('/');

    // Switch to PK (nationwide, full mode with all categories × all cities)
    await page.getByTestId('run-country-select').click();
    await page.getByRole('option', { name: /Pakistan/ }).click();
    // Sample must be unchecked (default)
    await page.getByTestId('run-btn').click();

    await expect(page.getByTestId('warning-modal')).toBeVisible();
    await expect(page.getByText(/Estimated duration/)).toBeVisible();

    // Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('warning-modal')).not.toBeVisible();

    // Open again and confirm
    await page.getByTestId('run-btn').click();
    await expect(page.getByTestId('warning-modal')).toBeVisible();
    await page.getByTestId('warning-confirm').click();

    await expect(page.getByTestId('pause-btn')).toBeVisible();
  });

  test('sample mode skips warning', async ({ page }) => {
    const state = createMockState();
    await installMocks(page, state);
    await page.goto('/');

    await page.getByTestId('run-country-select').click();
    await page.getByRole('option', { name: /Pakistan/ }).click();
    await page.getByText('Sample run (10 records)').click();
    await page.getByTestId('run-btn').click();

    // No warning should appear
    await expect(page.getByTestId('warning-modal')).not.toBeVisible();
    await expect(page.getByTestId('pause-btn')).toBeVisible();
  });
});

test.describe('Settings', () => {
  test('save settings persists values', async ({ page }) => {
    const state = createMockState();
    await installMocks(page, state);
    await page.goto('/');
    await page.getByTestId('tab-settings').click();

    await page.getByTestId('input-min-delay').fill('1500');
    await page.getByTestId('input-max-delay').fill('4000');
    await page.getByTestId('save-settings').click();

    await expect(page.getByText('Saved')).toBeVisible();
    // Check mock state updated
    expect(state.settings.minDelay).toBe(1500);
    expect(state.settings.maxDelay).toBe(4000);
  });
});

test.describe('Presets', () => {
  test('save and use a preset', async ({ page }) => {
    const state = createMockState();
    await installMocks(page, state);
    await page.goto('/');

    // Open save preset form
    await page.getByTestId('open-save-preset').click();
    await page.getByTestId('preset-name-input').fill('my-preset');
    await page.getByTestId('save-preset-btn').click();

    expect(state.presets.length).toBe(1);
    expect(state.presets[0].name).toBe('my-preset');

    // Reload page so preset dropdown appears
    await page.reload();
    await expect(page.getByTestId('preset-select')).toBeVisible();
  });
});

test.describe('Data tab', () => {
  test('renders legacy records with object-shaped address without crashing', async ({ page }) => {
    const state = createMockState();
    // Mix of new (flat) and legacy (object) record shapes
    state.data = [
      { external_id: 'PK-KHI-001', name: 'Alpha Gym', phone: '+923001', city: 'Karachi', country_code: 'PK', category_raw: 'Gyms & Fitness', address: '1 Main St', website: '', rating: 4.5, review_count: 100 },
      // Legacy record with address as object (from GroceryStore-script)
      { uniqueId: 'UK-LON-001', businessName: 'Legacy Co', address: { street: '10 Baker St', city: 'London', zipCode: 'NW1', state: 'England', country: 'UK' }, contact: { phone: '+44', website: 'https://ex.com' }, category: 'Doctors' },
    ];
    await installMocks(page, state);
    await page.goto('/');
    await page.getByTestId('tab-data').click();

    // Both rows should render, legacy address shown as joined string
    await expect(page.getByText('Alpha Gym')).toBeVisible();
    await expect(page.getByText('Legacy Co')).toBeVisible();
    await expect(page.getByText(/10 Baker St/)).toBeVisible();
  });

  test('search/filter/sort UI elements are present', async ({ page }) => {
    const state = createMockState();
    state.data = [
      { external_id: 'PK-KHI-001', name: 'Alpha Gym', phone: '+923001', city: 'Karachi', country_code: 'PK', category_raw: 'Gyms & Fitness', address: '1 Main St', website: '', rating: 4.5, review_count: 100 },
      { external_id: 'PK-LHE-002', name: 'Beta Gym', phone: '+923002', city: 'Lahore', country_code: 'PK', category_raw: 'Gyms & Fitness', address: '2 Main St', website: '', rating: 3.5, review_count: 50 },
    ];
    await installMocks(page, state);
    await page.goto('/');
    await page.getByTestId('tab-data').click();

    await expect(page.getByTestId('data-search')).toBeVisible();
    await expect(page.getByTestId('country-filter')).toBeVisible();
    await expect(page.getByTestId('filter-all')).toBeVisible();
    await expect(page.getByTestId('filter-duplicates')).toBeVisible();
    await expect(page.getByTestId('filter-incomplete')).toBeVisible();

    // Rows should render
    await expect(page.getByText('Alpha Gym')).toBeVisible();
    await expect(page.getByText('Beta Gym')).toBeVisible();

    // Click Name header to sort
    await page.getByTestId('sort-name').click();
    // Both rows should still be visible
    await expect(page.getByText('Alpha Gym')).toBeVisible();

    // Select a country (CountrySelect is a custom button dropdown, not a native <select>)
    await page.getByTestId('country-filter').click();
    await page.getByRole('option', { name: /Pakistan/ }).click();
    await expect(page.getByTestId('download-csv')).toBeVisible();
    await expect(page.getByTestId('download-json')).toBeVisible();
    await expect(page.getByTestId('download-ndjson')).toBeVisible();
  });

  test('CountrySelect shows flag and full country name', async ({ page }) => {
    const state = createMockState();
    state.data = [
      { external_id: 'PK-KHI-001', name: 'Alpha', country_code: 'PK', category_raw: 'Gyms & Fitness', address: '1 Main' },
    ];
    await installMocks(page, state);
    await page.goto('/');
    await page.getByTestId('tab-data').click();

    // Default "All countries" shows globe + label
    const filter = page.getByTestId('country-filter');
    await expect(filter).toContainText('All countries');

    // Open dropdown and pick France
    await filter.click();
    await expect(page.getByRole('option', { name: /United Kingdom/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /France/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /Pakistan/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /Saudi Arabia/ })).toBeVisible();

    await page.getByRole('option', { name: /France/ }).click();
    await expect(filter).toContainText('France');
  });

  test('category filter matches both flat (category_raw) and nested (category) schemas', async ({ page }) => {
    const state = createMockState();
    // Mix: two nationwide flat records + one GroceryStore legacy record sharing the same category
    state.data = [
      { external_id: 'PK-KHI-001', name: 'Alpha Gym', country_code: 'PK', category_raw: 'Gyms & Fitness', address: '1 Main' },
      { external_id: 'PK-LHE-002', name: 'Beta Gym', country_code: 'PK', category_raw: 'Gyms & Fitness', address: '2 Main' },
      { external_id: 'FR-PAR-003', name: 'Cafe Zero', country_code: 'FR', category_raw: 'Food & Beverage', address: '3 Main' },
      // Legacy GroceryStore record — category is a flat string in r.category, no r.category_raw
      { uniqueId: 'FR-PAR-004', businessName: 'Debloc Paris', category: 'Repair Shops', address: { street: '48 Bd Gouvion', city: 'Paris', country: 'FR' }, contact: { phone: '+33' } },
    ];
    // Categories offered in the dropdown must include both so we can pick either
    state.categories = ['Gyms & Fitness', 'Food & Beverage', 'Repair Shops'];
    await installMocks(page, state);
    await page.goto('/');
    await page.getByTestId('tab-data').click();

    // All 4 rows visible initially
    await expect(page.getByText('Alpha Gym')).toBeVisible();
    await expect(page.getByText('Beta Gym')).toBeVisible();
    await expect(page.getByText('Cafe Zero')).toBeVisible();
    await expect(page.getByText('Debloc Paris')).toBeVisible();

    // Filter by a nationwide/flat category (CategorySelect is a custom button dropdown)
    await page.getByTestId('category-filter').click();
    await page.getByRole('option', { name: /Gyms & Fitness/ }).click();
    await expect(page.getByText('Alpha Gym')).toBeVisible();
    await expect(page.getByText('Beta Gym')).toBeVisible();
    await expect(page.getByText('Cafe Zero')).not.toBeVisible();
    await expect(page.getByText('Debloc Paris')).not.toBeVisible();

    // Filter by a legacy-only category (only in GroceryStore r.category field)
    await page.getByTestId('category-filter').click();
    await page.getByRole('option', { name: /^Repair Shops$/ }).click();
    await expect(page.getByText('Debloc Paris')).toBeVisible();
    await expect(page.getByText('Alpha Gym')).not.toBeVisible();
    await expect(page.getByText('Beta Gym')).not.toBeVisible();

    // Reset via "All categories"
    await page.getByTestId('category-filter').click();
    await page.getByRole('option', { name: /All categories/ }).click();
    await expect(page.getByText('Alpha Gym')).toBeVisible();
    await expect(page.getByText('Debloc Paris')).toBeVisible();
  });
});

test.describe('History tab', () => {
  test('shows history rows and retry button for failed jobs', async ({ page }) => {
    const state = createMockState();
    state.history = [
      {
        jobId: 'h1', country: 'PK', city: 'Karachi', category: 'Gyms & Fitness',
        status: 'completed', startTime: Date.now() - 60000, endTime: Date.now(),
        counters: { found: 20, saved: 18, skipped: 1, duplicates: 0, failed: 1 },
      },
      {
        jobId: 'h2', country: 'SA', city: 'Riyadh', category: 'all',
        status: 'failed', startTime: Date.now() - 120000, endTime: Date.now() - 60000,
        counters: { found: 5, saved: 2, skipped: 0, duplicates: 0, failed: 3 },
        error: 'Some error',
      },
    ];
    // installMocks first so specific routes below take precedence
    await installMocks(page, state);
    // Mock /failed/:id to return entries for h1 and h2
    await page.route('**/api/failed/h1', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ url: 'x', name: 'X' }]) }));
    await page.route('**/api/failed/h2', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ url: 'x' }, { url: 'y' }, { url: 'z' }]) }));
    await page.goto('/');
    await page.getByTestId('tab-history').click();

    await expect(page.getByTestId('history-table')).toBeVisible();
    await expect(page.locator('[data-testid="history-row"]')).toHaveCount(2);
    // Retry buttons
    await expect(page.locator('[data-testid="retry-btn"]').first()).toBeVisible();
  });

  test('empty history shows placeholder', async ({ page }) => {
    const state = createMockState();
    await installMocks(page, state);
    await page.goto('/');
    await page.getByTestId('tab-history').click();
    await expect(page.getByText('No runs yet.')).toBeVisible();
  });

  test('Stopped status renders as amber pill (distinct from Failed)', async ({ page }) => {
    const state = createMockState();
    state.history = [
      {
        jobId: 'h-stopped', country: 'PK', city: 'Karachi', category: 'all',
        status: 'stopped', startTime: Date.now() - 60000, endTime: Date.now() - 30000,
        counters: { found: 8, saved: 8, skipped: 0, duplicates: 0, failed: 0 },
        error: 'Stopped by user',
      },
    ];
    await installMocks(page, state);
    await page.goto('/');
    await page.getByTestId('tab-history').click();

    // The Stopped row should render and show the Saved count (not zero)
    await expect(page.getByTestId('history-row')).toHaveCount(1);
    await expect(page.getByText('Stopped')).toBeVisible();
    // "Saved" cell in the row has the preserved counter; look for an exact "8" cell
    await expect(page.getByRole('cell', { name: '8', exact: true })).toBeVisible();
    // Resume button should appear for a stopped run so the user can continue
    await expect(page.getByTestId('resume-btn')).toBeVisible();
  });
});

test.describe('Theme toggle', () => {
  test('switches between light and dark and persists to localStorage', async ({ page }) => {
    const state = createMockState();
    await installMocks(page, state);
    await page.goto('/');
    // Start from a known state: force light
    await page.evaluate(() => localStorage.setItem('theme', 'light'));
    await page.reload();

    const toggle = page.getByTestId('theme-toggle');
    await expect(toggle).toBeVisible();
    const initialAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(initialAttr).toBe('light');

    // Flip
    await toggle.click();
    await page.waitForTimeout(150);
    const flipped = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(flipped).toBe('dark');

    // Verify localStorage persists
    const stored = await page.evaluate(() => localStorage.getItem('theme'));
    expect(stored).toBe('dark');

    // Reload: should keep the flipped state
    await page.reload();
    const afterReload = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(afterReload).toBe('dark');
  });
});

test.describe('NumberInput', () => {
  test('+/− buttons adjust value and respect min/max', async ({ page }) => {
    const state = createMockState();
    await installMocks(page, state);
    await page.goto('/');

    await page.getByTestId('tab-settings').click();
    const input = page.getByTestId('input-max-retries');

    // Current value should be 0 (default)
    await expect(input).toHaveValue('0');

    // Find the buttons inside the same wrapper as the input
    const wrapper = input.locator('..');
    const minusBtn = wrapper.getByRole('button', { name: 'Decrease' });
    const plusBtn = wrapper.getByRole('button', { name: 'Increase' });

    // At min (0), decrease should be disabled
    await expect(minusBtn).toBeDisabled();

    // Increase to 1
    await plusBtn.click();
    await expect(input).toHaveValue('1');

    // Increase to 5 (max)
    await plusBtn.click();
    await plusBtn.click();
    await plusBtn.click();
    await plusBtn.click();
    await expect(input).toHaveValue('5');

    // At max (5), increase should now be disabled
    await expect(plusBtn).toBeDisabled();

    // Decrease should work
    await minusBtn.click();
    await expect(input).toHaveValue('4');
  });
});

test.describe('Concurrency input (#5)', () => {
  test('visible only for non-nationwide (UK/FR) countries in Advanced panel', async ({ page }) => {
    const state = createMockState();
    await installMocks(page, state);
    await page.goto('/');

    // Default country is UK (non-nationwide) — expand Advanced
    await page.getByTestId('toggle-advanced').click();
    await expect(page.getByTestId('concurrency-input')).toBeVisible();

    // Switch to PK (nationwide) — concurrency input should disappear
    await page.getByTestId('run-country-select').click();
    await page.getByRole('option', { name: /Pakistan/ }).click();
    await page.getByTestId('toggle-advanced').click().catch(() => {}); // re-open if it collapsed
    await expect(page.getByTestId('concurrency-input')).not.toBeVisible();

    // Back to UK — should reappear
    await page.getByTestId('run-country-select').click();
    await page.getByRole('option', { name: /United Kingdom/ }).click();
    await page.getByTestId('toggle-advanced').click().catch(() => {});
    await expect(page.getByTestId('concurrency-input')).toBeVisible();
  });
});

test.describe('Failed records filter (#16)', () => {
  test('Failed chip shows aggregated failures with retry-all button', async ({ page }) => {
    const state = createMockState();
    state.allFailed = [
      { jobId: '11', country: 'PK', city: 'Karachi', category: 'Gyms & Fitness', name: 'Broken Gym', url: 'https://example.com/a', error: 'timeout', at: 1000 },
      { jobId: '11', country: 'PK', city: 'Karachi', category: 'Gyms & Fitness', name: 'Other Biz',  url: 'https://example.com/b', error: '404',     at: 1100 },
      { jobId: '12', country: 'FR', city: 'Paris',   category: 'Repair Shops',   name: 'Cafe X',    url: 'https://example.com/c', error: 'timeout', at: 1200 },
    ];
    await installMocks(page, state);
    await page.goto('/');
    await page.getByTestId('tab-data').click();

    await page.getByTestId('filter-failed').click();
    await expect(page.getByTestId('failed-records-view')).toBeVisible();
    await expect(page.getByText('3 failed records across 2 jobs')).toBeVisible();
    await expect(page.getByText('Broken Gym')).toBeVisible();
    await expect(page.getByText('Cafe X')).toBeVisible();

    // Two retry buttons (one per grouped job)
    await expect(page.locator('[data-testid="failed-retry-btn"]')).toHaveCount(2);
  });

  test('empty state renders when there are no failures', async ({ page }) => {
    const state = createMockState();
    state.allFailed = [];
    await installMocks(page, state);
    await page.goto('/');
    await page.getByTestId('tab-data').click();
    await page.getByTestId('filter-failed').click();
    await expect(page.getByText(/No failed records yet/)).toBeVisible();
  });
});

test.describe('Resume interrupted run (#17)', () => {
  test('Resume button appears on interrupted/failed rows and triggers /api/resume', async ({ page }) => {
    const state = createMockState();
    state.history = [
      {
        jobId: 'h-interrupt', country: 'PK', city: 'Lahore', category: 'all',
        status: 'interrupted', startTime: Date.now() - 120000, endTime: Date.now() - 60000,
        counters: { found: 5, saved: 3, skipped: 0, duplicates: 0, failed: 0 },
        error: 'Backend was restarted while this job was running.',
      },
      {
        jobId: 'h-done', country: 'FR', city: 'Paris', category: 'Repair Shops',
        status: 'completed', startTime: Date.now() - 300000, endTime: Date.now() - 240000,
        counters: { found: 3, saved: 3, skipped: 0, duplicates: 0, failed: 0 },
      },
    ];
    await installMocks(page, state);
    await page.goto('/');
    await page.getByTestId('tab-history').click();

    // Only the interrupted row should have a Resume button (completed row shouldn't)
    await expect(page.locator('[data-testid="resume-btn"]')).toHaveCount(1);
    await page.locator('[data-testid="resume-btn"]').first().click();
    await expect(page.getByText(/Resume started as job #resume-1/)).toBeVisible();
  });
});

test.describe('Countries & Cities admin', () => {
  test('Settings tab shows all seeded countries', async ({ page }) => {
    const state = createMockState();
    await installMocks(page, state);
    await page.goto('/');
    await page.getByTestId('tab-settings').click();

    await expect(page.getByTestId('countries-list')).toBeVisible();
    await expect(page.getByTestId('delete-country-UK')).toBeVisible();
    await expect(page.getByTestId('delete-country-FR')).toBeVisible();
    await expect(page.getByTestId('delete-country-PK')).toBeVisible();
    await expect(page.getByTestId('delete-country-SA')).toBeVisible();
  });

  test('admin can add a new country and it appears in the Run dropdown', async ({ page }) => {
    const state = createMockState();
    await installMocks(page, state);
    await page.goto('/');

    // Add Germany via Settings
    await page.getByTestId('tab-settings').click();
    await page.getByTestId('new-country-code').fill('DE');
    await page.getByTestId('new-country-name').fill('Germany');
    await page.getByTestId('add-country-btn').click();
    await expect(page.getByTestId('delete-country-DE')).toBeVisible();

    // Switch to Run tab — Germany should appear in the country dropdown
    await page.getByTestId('tab-run').click();
    await page.getByTestId('run-country-select').click();
    await expect(page.getByRole('option', { name: /Germany/ })).toBeVisible();
  });

  test('admin can add cities for a new nationwide country', async ({ page }) => {
    const state = createMockState();
    await installMocks(page, state);
    await page.goto('/');

    await page.getByTestId('tab-settings').click();
    // Add Germany
    await page.getByTestId('new-country-code').fill('DE');
    await page.getByTestId('new-country-name').fill('Germany');
    await page.getByTestId('add-country-btn').click();

    // Open Manage cities for DE
    await page.getByTestId('manage-cities-DE').click();
    await page.getByTestId('new-city-name-DE').fill('Berlin');
    await page.getByTestId('new-city-code-DE').fill('BER');
    await page.getByTestId('add-city-btn-DE').click();

    // City should appear in mock state
    await expect.poll(() => state.citiesFull.DE?.length || 0).toBe(1);
    expect(state.citiesFull.DE[0]).toMatchObject({ name: 'Berlin', code: 'BER' });
  });

  test('removing a country drops it from the dropdown', async ({ page }) => {
    const state = createMockState();
    await installMocks(page, state);
    await page.goto('/');

    page.on('dialog', (d) => d.accept());

    await page.getByTestId('tab-settings').click();
    await page.getByTestId('delete-country-SA').click();
    await expect(page.getByTestId('delete-country-SA')).toHaveCount(0);

    // The Run-tab dropdown should no longer offer Saudi Arabia
    await page.getByTestId('tab-run').click();
    await page.getByTestId('run-country-select').click();
    await expect(page.getByRole('option', { name: /Saudi Arabia/ })).toHaveCount(0);
  });
});
