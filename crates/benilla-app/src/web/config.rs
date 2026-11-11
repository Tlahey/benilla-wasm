//! Deployment endpoints resolved by full.html from editable web/config.js.
use wasm_bindgen::prelude::*;

#[wasm_bindgen(inline_js = r#"
export function hideBootstrapStatus() {
    const status = document.getElementById('benilla-bootstrap-status');
    if (status) status.hidden = true;
}
export function openAccountsPage(url) {
    if (!url) return false;
    return window.open(url, '_blank', 'noopener,noreferrer') !== null;
}
export function openLocalAddonsPage() {
    const width = Math.min(900, window.screen.availWidth || 900);
    const height = Math.min(760, window.screen.availHeight || 760);
    const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
    const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
    const popup = window.open(
        '/addons.html',
        'benilla-local-addons',
        `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    if (!popup) return false;
    popup.focus();
    return true;
}
"#)]
extern "C" {
    #[wasm_bindgen(js_name = hideBootstrapStatus)]
    pub(crate) fn hide_bootstrap_status();
    #[wasm_bindgen(js_name = openAccountsPage)]
    pub(crate) fn open_accounts_page(url: &str) -> bool;
    #[wasm_bindgen(js_name = openLocalAddonsPage)]
    pub(crate) fn open_local_addons_page() -> bool;
}

pub(crate) fn active_locale() -> String {
    endpoint("locale")
}
/// Browser-owned text, by key, from the JSON i18n service (`web/i18n.js`).
///
/// The base is `web/i18n/en_GB.json`; every other locale file must carry exactly
/// the base keys, and the service rejects the page (throws) when one does not.
/// `BENILLA_I18N.text` throws on a key the base itself lacks, which is the crash
/// the strict check exists for — a key added to Rust without a JSON entry errors
/// at the call, not by silently falling back to English.
pub(crate) fn text(key: &str) -> String {
    let dictionary = js_sys::Reflect::get(&js_sys::global(), &"BENILLA_I18N".into())
        .expect("reading BENILLA_I18N");
    let function =
        js_sys::Reflect::get(&dictionary, &"text".into()).expect("reading BENILLA_I18N.text");
    use wasm_bindgen::JsCast;
    function
        .unchecked_into::<js_sys::Function>()
        .call1(&dictionary, &key.into())
        .expect("formatting i18n text")
        .as_string()
        .expect("i18n text returns a string")
}
/// Alias kept for the loading screen; the JSON service is what answers now.
pub(crate) fn startup_text(key: &str) -> String {
    text(key)
}
/// The account-creation page the login screen's button opens, or `None` when the page
/// was built without one (old config.js) — the button is only spawned when this answers.
///
/// The stack owns the page (`vanilla/accounts`: `/`, `POST /api/accounts`); the browser
/// gets the URL from `BENILLA_ENDPOINTS.accounts`, which `web/index.html` derives from
/// `BENILLA_CONFIG.accounts`/the page host, and which `deploy/entrypoint.py` overrides from
/// `BENILLA_ACCOUNTS_URL`.
pub(crate) fn accounts_url() -> Option<String> {
    let endpoints = js_sys::Reflect::get(&js_sys::global(), &"BENILLA_ENDPOINTS".into()).ok()?;
    js_sys::Reflect::get(&endpoints, &"accounts".into())
        .ok()?
        .as_string()
        .filter(|url| !url.is_empty())
}

pub(crate) fn endpoint(key: &str) -> String {
    let endpoints = js_sys::Reflect::get(&js_sys::global(), &"BENILLA_ENDPOINTS".into())
        .expect("reading BENILLA_ENDPOINTS");
    js_sys::Reflect::get(&endpoints, &key.into())
        .expect("reading browser gateway endpoint")
        .as_string()
        .unwrap_or_else(|| {
            panic!("missing BENILLA_ENDPOINTS.{key}; load web/config.js through full.html")
        })
}
