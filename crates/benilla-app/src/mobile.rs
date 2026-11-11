use bevy::prelude::*;
use wasm_bindgen::prelude::*;

use crate::char_select::ClientState;

#[wasm_bindgen(inline_js = r#"
export function benillaMobileSetMode(mode) {
    globalThis.BENILLA_MOBILE?.setMode(mode);
}
export function benillaMobileIsTouch() {
    return globalThis.BENILLA_MOBILE?.isTouch() ?? false;
}
export function benillaMobileLoginAccount() {
    return globalThis.BENILLA_MOBILE?.loginAccount() ?? "";
}
export function benillaMobileLoginPassword() {
    return globalThis.BENILLA_MOBILE?.loginPassword() ?? "";
}
export function benillaMobileLoginField() {
    return globalThis.BENILLA_MOBILE?.loginField() ?? 0;
}
export function benillaMobileTakeLoginSubmit() {
    return globalThis.BENILLA_MOBILE?.takeLoginSubmit() ?? false;
}
export function benillaMobileSyncLogin(account, password, enabled) {
    globalThis.BENILLA_MOBILE?.syncLogin(account, password, enabled);
}
"#)]
extern "C" {
    #[wasm_bindgen(js_name = benillaMobileSetMode)]
    fn set_mode(mode: &str);
    #[wasm_bindgen(js_name = benillaMobileIsTouch)]
    fn is_touch() -> bool;
    #[wasm_bindgen(js_name = benillaMobileLoginAccount)]
    fn login_account() -> String;
    #[wasm_bindgen(js_name = benillaMobileLoginPassword)]
    fn login_password() -> String;
    #[wasm_bindgen(js_name = benillaMobileLoginField)]
    fn login_field() -> u8;
    #[wasm_bindgen(js_name = benillaMobileTakeLoginSubmit)]
    fn take_login_submit() -> bool;
    #[wasm_bindgen(js_name = benillaMobileSyncLogin)]
    fn sync_login_dom(account: &str, password: &str, enabled: bool);
}

pub(crate) struct MobileControlsPlugin;

impl Plugin for MobileControlsPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Update, update_mode);
    }
}

fn update_mode(state: Res<State<ClientState>>, mut current: Local<Option<&'static str>>) {
    let mode = match state.get() {
        ClientState::Login => "login",
        ClientState::InWorld => "game",
        _ => "off",
    };
    if *current != Some(mode) {
        set_mode(mode);
        *current = Some(mode);
    }
}

pub(crate) struct MobileLoginInput {
    pub(crate) account: String,
    pub(crate) password: String,
    pub(crate) field: u8,
    pub(crate) submit: bool,
}

pub(crate) fn login_input() -> Option<MobileLoginInput> {
    if !is_touch() {
        return None;
    }
    Some(MobileLoginInput {
        account: login_account(),
        password: login_password(),
        field: login_field(),
        submit: take_login_submit(),
    })
}

pub(crate) fn sync_login(account: &str, password: &str, enabled: bool) {
    sync_login_dom(account, password, enabled);
}
