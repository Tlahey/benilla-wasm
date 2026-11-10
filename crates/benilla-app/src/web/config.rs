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
"#)]
extern "C" {
    #[wasm_bindgen(js_name = hideBootstrapStatus)]
    pub(crate) fn hide_bootstrap_status();
    #[wasm_bindgen(js_name = openAccountsPage)]
    pub(crate) fn open_accounts_page(url: &str) -> bool;
}

pub(crate) fn active_locale() -> String {
    endpoint("locale")
}
/// Before the original UI VM exists, use the page's own en/ru startup dictionary.
pub(crate) fn startup_text(key: &str) -> String {
    let dictionary = js_sys::Reflect::get(&js_sys::global(), &"BENILLA_I18N".into())
        .expect("reading startup localization");
    let function = js_sys::Reflect::get(&dictionary, &"text".into())
        .expect("reading startup localization text");
    use wasm_bindgen::JsCast;
    function
        .unchecked_into::<js_sys::Function>()
        .call1(&dictionary, &key.into())
        .expect("formatting startup localization")
        .as_string()
        .expect("startup localization returns text")
}
/// Browser-owned chrome has no original GlobalStrings keys. Keep its trilingual
/// wording separate from installed game text and select before the VM exists.
pub(crate) fn text<'a>(english: &'a str, russian: &'a str, french: &'a str) -> &'a str {
    match active_locale().as_str() {
        "ruRU" => russian,
        "frFR" => french,
        _ => english,
    }
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
