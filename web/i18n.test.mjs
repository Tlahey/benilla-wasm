// Run with: node web/i18n.test.mjs
//
// The browser-only i18n service is exercised with stubbed DOM/fetch globals:
// the base catalog is en_GB, translations must have exactly its keys, and a
// missing key rejects `ready` (the page's deliberate startup crash).
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const code = readFileSync(new URL('./i18n.js', import.meta.url), 'utf8');
const base = JSON.parse(readFileSync(new URL('./i18n/en_GB.json', import.meta.url), 'utf8'));
const fr = JSON.parse(readFileSync(new URL('./i18n/fr_FR.json', import.meta.url), 'utf8'));
const ru = JSON.parse(readFileSync(new URL('./i18n/ru_RU.json', import.meta.url), 'utf8'));

function assertComplete(catalog) {
  assert.deepEqual(Object.keys(catalog).sort(), Object.keys(base).sort());
}

assertComplete(fr);
assertComplete(ru);

async function boot(locale, files) {
  globalThis.localStorage = { getItem: () => locale };
  globalThis.document = { baseURI: 'http://example.test/', documentElement: {} };
  globalThis.fetch = async url => {
    const name = url.split('/').pop();
    return name in files
      ? { ok: true, status: 200, json: async () => files[name] }
      : { ok: false, status: 404, json: async () => ({}) };
  };
  delete globalThis.BENILLA_I18N;
  new Function(code)();
  await globalThis.BENILLA_I18N.ready;
  return globalThis.BENILLA_I18N;
}

const frI18n = await boot('frFR', { 'en_GB.json': base, 'fr_FR.json': fr });
assert.equal(frI18n.file, 'fr_FR');
assert.equal(frI18n.text('login.create_account'), 'Créer un compte');
assert.equal(frI18n.text('mobile.jump'), 'Sauter');
assert.equal(
  frI18n.text('pending_files', { count: 3 }),
  'Fichiers en cours de chargement : 3'
);

try {
  const missing = { ...fr };
  delete missing['login.password_invalid'];
  await boot('frFR', { 'en_GB.json': base, 'fr_FR.json': missing });
  assert.fail('a translation missing a base key must reject');
} catch (error) {
  assert.match(error.message, /missing 1 key\(s\): login\.password_invalid/);
}

try {
  await boot('frFR', {
    'en_GB.json': base,
    'fr_FR.json': { ...fr, 'login.unknown': 'bonjour' },
  });
  assert.fail('a translation with an unknown key must reject');
} catch (error) {
  assert.match(error.message, /has 1 unknown key\(s\): login\.unknown/);
}

const ruI18n = await boot('ruRU', { 'en_GB.json': base, 'ru_RU.json': ru });
assert.equal(ruI18n.file, 'ru_RU');
assert.equal(ruI18n.text('client_loading'), 'Загрузка клиента…');

console.log('i18n service: ok');
