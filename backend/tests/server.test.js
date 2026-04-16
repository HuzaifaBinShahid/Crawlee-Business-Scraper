/**
 * Backend unit tests using Node's built-in test runner.
 * Run: node --test tests/server.test.js
 *
 * NODE_ENV=test prevents the server from listening on a real port.
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';

const { app, recordCountry, recordSearchHaystack } = await import('../server.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

let server;
let baseUrl;

function req(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: '127.0.0.1',
      port: server.address().port,
      path: pathname,
      method,
      headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
    };
    const r = http.request(opts, (res) => {
      let buf = '';
      res.on('data', (c) => buf += c);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(buf); } catch (_) { parsed = buf; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.on('listening', r));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server.close();
});

beforeEach(() => {
  // Reset history/presets/settings to defaults between tests
  fs.writeFileSync(path.join(DATA_DIR, 'history.json'), '[]', 'utf-8');
  fs.writeFileSync(path.join(DATA_DIR, 'presets.json'), '[]', 'utf-8');
  fs.writeFileSync(path.join(DATA_DIR, 'settings.json'), JSON.stringify({
    minDelay: 2000, maxDelay: 5000, navTimeout: 90, maxRetries: 0, proxies: [],
  }), 'utf-8');
});

describe('Health & basic endpoints', () => {
  test('GET /api/health returns ok', async () => {
    const res = await req('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  test('GET /api/categories returns nationwide categories for PK', async () => {
    const res = await req('GET', '/api/categories?country=PK');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.includes('Gyms & Fitness'));
  });

  test('GET /api/cities returns cities for PK', async () => {
    const res = await req('GET', '/api/cities?country=PK');
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('Karachi'));
    assert.ok(res.body.includes('Lahore'));
  });

  test('GET /api/cities returns empty array for unknown country', async () => {
    const res = await req('GET', '/api/cities?country=XX');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });
});

describe('Run endpoints (validation)', () => {
  test('POST /api/run without country returns 400', async () => {
    const res = await req('POST', '/api/run', {});
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  test('POST /api/run with invalid country returns 400', async () => {
    const res = await req('POST', '/api/run', { country: 'ZZ' });
    assert.equal(res.status, 400);
  });

  test('POST /api/run/stop with no active process returns 409', async () => {
    const res = await req('POST', '/api/run/stop');
    assert.equal(res.status, 409);
  });

  test('POST /api/run/pause with no active process returns 409', async () => {
    const res = await req('POST', '/api/run/pause');
    assert.equal(res.status, 409);
  });

  test('POST /api/run/resume with no active process returns 409', async () => {
    const res = await req('POST', '/api/run/resume');
    assert.equal(res.status, 409);
  });

  test('GET /api/run/status returns idle initially', async () => {
    const res = await req('GET', '/api/run/status');
    assert.equal(res.status, 200);
    assert.ok(['idle', 'completed', 'failed'].includes(res.body.status));
  });

  test('GET /api/run/progress returns counters shape', async () => {
    const res = await req('GET', '/api/run/progress');
    assert.equal(res.status, 200);
    assert.ok(res.body.counters);
    assert.equal(typeof res.body.counters.found, 'number');
    assert.equal(typeof res.body.counters.saved, 'number');
    assert.equal(typeof res.body.counters.skipped, 'number');
    assert.equal(typeof res.body.counters.duplicates, 'number');
    assert.equal(typeof res.body.counters.failed, 'number');
  });

  test('GET /api/run/logs returns stdout/stderr arrays', async () => {
    const res = await req('GET', '/api/run/logs');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.stdout));
    assert.ok(Array.isArray(res.body.stderr));
  });
});

describe('Queue', () => {
  test('POST /api/queue without jobs returns 400', async () => {
    const res = await req('POST', '/api/queue', {});
    assert.equal(res.status, 400);
  });

  test('POST /api/queue with empty jobs returns 400', async () => {
    const res = await req('POST', '/api/queue', { jobs: [] });
    assert.equal(res.status, 400);
  });

  test('GET /api/queue/status returns shape', async () => {
    const res = await req('GET', '/api/queue/status');
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.isRunning, 'boolean');
    assert.ok(Array.isArray(res.body.pending));
  });
});

describe('Settings', () => {
  test('GET /api/settings returns defaults', async () => {
    const res = await req('GET', '/api/settings');
    assert.equal(res.status, 200);
    assert.equal(res.body.minDelay, 2000);
    assert.equal(res.body.maxDelay, 5000);
  });

  test('PUT /api/settings updates values', async () => {
    const res = await req('PUT', '/api/settings', { minDelay: 1000, maxDelay: 3000 });
    assert.equal(res.status, 200);
    assert.equal(res.body.minDelay, 1000);
    assert.equal(res.body.maxDelay, 3000);

    // Verify persisted
    const res2 = await req('GET', '/api/settings');
    assert.equal(res2.body.minDelay, 1000);
  });
});

describe('Presets', () => {
  test('GET /api/presets returns empty array initially', async () => {
    const res = await req('GET', '/api/presets');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  test('POST /api/presets without name returns 400', async () => {
    const res = await req('POST', '/api/presets', { config: { country: 'PK' } });
    assert.equal(res.status, 400);
  });

  test('POST /api/presets saves a preset', async () => {
    const res = await req('POST', '/api/presets', { name: 'test-preset', config: { country: 'PK', sample: true } });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'test-preset');

    const list = await req('GET', '/api/presets');
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].name, 'test-preset');
    assert.equal(list.body[0].config.country, 'PK');
  });

  test('POST /api/presets updates existing preset with same name', async () => {
    await req('POST', '/api/presets', { name: 'p1', config: { country: 'PK' } });
    await req('POST', '/api/presets', { name: 'p1', config: { country: 'SA' } });
    const list = await req('GET', '/api/presets');
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].config.country, 'SA');
  });

  test('DELETE /api/presets/:name removes preset', async () => {
    await req('POST', '/api/presets', { name: 'to-delete', config: { country: 'PK' } });
    const del = await req('DELETE', '/api/presets/to-delete');
    assert.equal(del.status, 200);
    const list = await req('GET', '/api/presets');
    assert.equal(list.body.length, 0);
  });
});

describe('History', () => {
  test('GET /api/history returns empty array initially', async () => {
    const res = await req('GET', '/api/history');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  test('DELETE /api/history clears history', async () => {
    // Simulate a history entry by writing to file
    fs.writeFileSync(path.join(DATA_DIR, 'history.json'),
      JSON.stringify([{ jobId: '1', country: 'PK', status: 'completed' }]), 'utf-8');
    const before = await req('GET', '/api/history');
    assert.equal(before.body.length, 1);
    const del = await req('DELETE', '/api/history');
    assert.equal(del.status, 200);
    const after = await req('GET', '/api/history');
    assert.deepEqual(after.body, []);
  });
});

describe('Download', () => {
  test('GET /api/download without country returns 400', async () => {
    const res = await req('GET', '/api/download');
    assert.equal(res.status, 400);
  });

  test('GET /api/download with invalid format returns 400', async () => {
    const res = await req('GET', '/api/download?country=PK&format=xml');
    assert.equal(res.status, 400);
  });

  test('GET /api/download for non-existent country returns 404', async () => {
    const res = await req('GET', '/api/download?country=ZZ&format=csv');
    assert.equal(res.status, 404);
  });
});

describe('Data Quality', () => {
  test('GET /api/quality returns shape even with no data', async () => {
    const res = await req('GET', '/api/quality');
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.total, 'number');
    assert.equal(typeof res.body.completeness, 'number');
  });
});

describe('Failed records', () => {
  test('GET /api/failed/unknown returns empty array', async () => {
    const res = await req('GET', '/api/failed/unknown-job');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  test('POST /api/retry/unknown returns 404', async () => {
    const res = await req('POST', '/api/retry/unknown-job');
    assert.equal(res.status, 404);
  });
});

describe('Data', () => {
  test('GET /api/data returns shape', async () => {
    const res = await req('GET', '/api/data');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(typeof res.body.metadata, 'object');
  });

  test('GET /api/data?filter=duplicates returns array', async () => {
    const res = await req('GET', '/api/data?filter=duplicates');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });

  test('GET /api/data?search=foo returns array', async () => {
    const res = await req('GET', '/api/data?search=foo');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });
});

describe('recordCountry helper — handles both record schemas', () => {
  test('nationwide flat record with country_code', () => {
    assert.equal(recordCountry({ country_code: 'PK', name: 'X' }), 'PK');
  });
  test('nationwide flat record with country (no country_code)', () => {
    assert.equal(recordCountry({ country: 'SA', name: 'X' }), 'SA');
  });
  test('GroceryStore-script nested record with address.country', () => {
    assert.equal(recordCountry({ businessName: 'X', address: { country: 'FR' } }), 'FR');
  });
  test('GroceryStore-script nested record UK', () => {
    assert.equal(recordCountry({ businessName: 'X', address: { country: 'UK' } }), 'UK');
  });
  test('lowercase input normalized to uppercase', () => {
    assert.equal(recordCountry({ country_code: 'fr' }), 'FR');
  });
  test('missing country returns empty string', () => {
    assert.equal(recordCountry({ name: 'X' }), '');
  });
  test('null record returns empty string', () => {
    assert.equal(recordCountry(null), '');
  });
});

describe('recordSearchHaystack — covers flat + nested record text', () => {
  test('flat nationwide record includes name/phone/city/address', () => {
    const hay = recordSearchHaystack({
      name: 'Ali Gym', phone: '+923001', city: 'Karachi', address: '1 Main St', category_raw: 'Gyms',
    });
    assert.ok(hay.includes('ali gym'));
    assert.ok(hay.includes('+923001'));
    assert.ok(hay.includes('karachi'));
  });
  test('nested GroceryStore record picks up nested contact/address', () => {
    const hay = recordSearchHaystack({
      businessName: 'Debloc Paris',
      address: { street: '48 Bd Gouvion', city: 'Paris', zipCode: '75017' },
      contact: { phone: '+33145', website: 'https://debloc.fr' },
      category: 'Repair Shops',
    });
    assert.ok(hay.includes('debloc paris'));
    assert.ok(hay.includes('+33145'));
    assert.ok(hay.includes('paris'));
    assert.ok(hay.includes('https://debloc.fr'));
    assert.ok(hay.includes('repair shops'));
  });
});
