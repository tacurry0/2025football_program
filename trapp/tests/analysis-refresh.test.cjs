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
  const requests = [];
  const storage = new Map();
  const cache = {
    match: async key => storage.get(key),
    put: async (key, value) => storage.set(key, value),
    keys: async () => [...storage.keys()].map(url => ({ url })),
    delete: async key => storage.delete(key)
  };
  const record = () => JSON.stringify({ version });
  const files = () => Object.fromEntries(keys.map(key => [key, createHash('sha256').update(record()).digest('hex')]));
  const fetch = async (url, options) => {
    requests.push([url, options.cache]);
    if (url.startsWith('https://raw.githubusercontent.com/')) throw new Error('raw endpoint unavailable');
    if (url.includes('/generated/update.json?')) return new Response(JSON.stringify({ season: '2026_2027', revision: String(version), files: files(), clubs: {} }));
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
  version = 2; corrupt = true;
  await assert.rejects(api.check(true));
  assert.equal(api.metadata.revision, '1');
  assert.equal((await (await api.fetch('./data/generated/niigata/2026_2027/0.json')).json()).version, 1);
  corrupt = false;
  const retry = await api.check(true);
  assert.equal(retry.changed, true);
  assert.equal((await (await api.fetch('./data/generated/niigata/2026_2027/0.json')).json()).version, 2);
});
