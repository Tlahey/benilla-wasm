// Browser-owned translations, loaded from JSON files under ./i18n/.
//
// The base translation is `en_GB.json`: every other locale file must carry
// exactly the same keys, and the whole service rejects (throws) when one does
// not. That strictness is deliberate — a missing key is a crash at startup, not
// a silent English fallback, so a half-translated locale can never ship.
//
// The client's locale codes stay enUS/frFR/ruRU (the gateway catalogue's
// spelling); the file mapping is enUS -> en_GB (base), frFR -> fr_FR,
// ruRU -> ru_RU. `enGB` is accepted as the same base.
(() => {
  const normalizeLocale = code => {
    if (code === 'ru' || code === 'ruRU') return 'ruRU';
    if (code === 'fr' || code === 'frFR') return 'frFR';
    return 'enUS';
  };
  let saved = 'enUS';
  try { saved = localStorage.getItem('benilla:state:v1:locale') || saved; }
  catch (_) { /* Storage restrictions must not prevent startup. */ }
  const locale = normalizeLocale(saved);
  const language = locale === 'ruRU' ? 'ru' : locale === 'frFR' ? 'fr' : 'en';
  document.documentElement.lang = language;
  const file = locale === 'ruRU' ? 'ru_RU' : locale === 'frFR' ? 'fr_FR' : 'en_GB';
  const messages = {};

  async function fetchMessages(url) {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`i18n: ${url} returned HTTP ${response.status}`);
    const json = await response.json();
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw new Error(`i18n: ${url} is not a JSON object`);
    }
    for (const [key, value] of Object.entries(json)) {
      if (typeof value !== 'string') throw new Error(`i18n: ${url} key "${key}" is not a string`);
    }
    return json;
  }

  const ready = (async () => {
    const baseUrl = new URL('./i18n/en_GB.json', document.baseURI).href;
    const base = await fetchMessages(baseUrl);
    if (file === 'en_GB') {
      Object.assign(messages, base);
      return messages;
    }
    const localeUrl = new URL(`./i18n/${file}.json`, document.baseURI).href;
    const translation = await fetchMessages(localeUrl);
    const missing = Object.keys(base).filter(key => !Object.hasOwn(translation, key));
    if (missing.length > 0) {
      throw new Error(`i18n: ${localeUrl} is missing ${missing.length} key(s): ${missing.join(', ')}`);
    }
    const unknown = Object.keys(translation).filter(key => !Object.hasOwn(base, key));
    if (unknown.length > 0) {
      throw new Error(`i18n: ${localeUrl} has ${unknown.length} unknown key(s): ${unknown.join(', ')}`);
    }
    Object.assign(messages, base, translation);
    return messages;
  })();

  globalThis.BENILLA_I18N = Object.freeze({
    locale,
    file,
    normalizeLocale,
    ready,
    text(key, values = {}) {
      const template = messages[key];
      if (typeof template !== 'string') throw new Error(`i18n: missing key "${key}"`);
      return template.replace(/\{([a-z_]+)\}/g, (token, name) =>
        Object.hasOwn(values, name) ? String(values[name]) : token);
    },
  });
})();
