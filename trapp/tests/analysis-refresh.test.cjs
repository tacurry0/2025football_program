const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash, webcrypto } = require('node:crypto');

test('manual analysis refresh uses the published fallback, validates files and preserves a good snapshot on failure', async () => {
  const keys = ['niigata', 'kumamoto'].flatMap(club =>
    Array.from({ length: 7 }, (_, index) => `generated/${club}/2026_2027/${index}.json`));
  let version = 1;
  let corrupt = false;
  let rawUnavailable = true;
  const requests = [];
  const storage = new Map();
  const cache = {
    match: async key => storage.get(key),
    put: async (key, value) => storage.set(key, value),
    keys: async () => [...storage.keys()].map(url => ({ url })),
    delete: async key => storage.delete(key)
  };
  const record = (sourceVersion = version) => JSON.stringify({ version: sourceVersion });
  const files = (sourceVersion = version) => Object.fromEntries(keys.map(key => [key, createHash('sha256').update(record(sourceVersion)).digest('hex')]));
  const fetch = async (url, options) => {
    requests.push([url, options.cache]);
    const raw = url.startsWith('https://raw.githubusercontent.com/');
    if (raw && rawUnavailable) throw new Error('raw endpoint unavailable');
    const sourceVersion = raw ? 1 : version;
    if (url.includes('/generated/update.json?')) return new Response(JSON.stringify({
      season: '2026_2027', revision: String(sourceVersion), files: files(sourceVersion), clubs: {},
      checkedAt: new Date(Date.UTC(2026, 8, 28, sourceVersion)).toISOString()
    }));
    if (raw) return new Response(record(sourceVersion));
    return new Response(corrupt && url.includes('/0.json?') ? '{}' : record());
  };
  const context = vm.createContext({
    window: {}, document: { baseURI: 'https://example.com/trapp/' },
    caches: { open: async () => cache }, fetch, crypto: webcrypto,
    AbortSignal, Response, TextDecoder, Uint8Array, URL, Date, Math, Map, Set
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../analysis-data.js'), 'utf8'), context);
  const api = context.window.TrappAnalysisData;
  const first = await api.check(true);
  assert.equal(first.changed, true);
  assert.equal(first.manifest.revision, '1');
  assert.equal((await (await api.fetch('./data/generated/niigata/2026_2027/0.json')).json()).version, 1);
  assert(requests.some(([url, cacheMode]) => url.startsWith('https://example.com/trapp/data/') && cacheMode === 'no-store'));
  const beforeManual = requests.filter(([url]) => url.includes('/0.json?')).length;
  const sameRevision = await api.check(true);
  assert.equal(sameRevision.changed, false);
  assert.equal(sameRevision.refreshed, true);
  assert(requests.filter(([url]) => url.includes('/0.json?')).length > beforeManual);
  version = 2; rawUnavailable = false; corrupt = true;
  await assert.rejects(api.check(true));
  assert.equal(api.metadata.revision, '1');
  assert.equal((await (await api.fetch('./data/generated/niigata/2026_2027/0.json')).json()).version, 1);
  corrupt = false;
  const retry = await api.check(true);
  assert.equal(retry.changed, true);
  assert.equal(retry.manifest.checkedAt, '2026-09-28T02:00:00.000Z');
  assert(requests.some(([url]) => url.startsWith('https://raw.githubusercontent.com/') && url.includes('/0.json?')));
  assert.equal((await (await api.fetch('./data/generated/niigata/2026_2027/0.json')).json()).version, 2);
});
