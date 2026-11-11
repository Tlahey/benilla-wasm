use bevy::prelude::*;
use wasm_bindgen::prelude::*;

use crate::char_select::ClientState;
use crate::creature_anim::Engaged;
use crate::net::{ObjectStore, Reputations, SelfPlayer};
use crate::target::{Factions, Selection};

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
export function benillaMobileSetHudState(hasTarget, inCombat, canAttack, canInteract) {
    globalThis.BENILLA_MOBILE?.setHudState({
        hasTarget,
        inCombat,
        canAttack,
        canInteract,
    });
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
    #[wasm_bindgen(js_name = benillaMobileSetHudState)]
    fn set_hud_state_dom(has_target: bool, in_combat: bool, can_attack: bool, can_interact: bool);
}

pub(crate) struct MobileControlsPlugin;

impl Plugin for MobileControlsPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Update, (update_mode, sync_hud_state));
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

    fn sync_hud_state(
        selection: Res<Selection>,
        self_player: Query<(Option<&Engaged>, Option<&ObjectStore>), With<SelfPlayer>>,
        objects: Query<&ObjectStore>,
        factions: Option<Res<Factions>>,
        reputations: Res<Reputations>,
        mut current: Local<Option<(bool, bool, bool, bool)>>,
    ) {
        let (in_combat, self_store) = self_player
            .get_single()
            .map_or((false, None), |(engaged, store)| (engaged.is_some(), store));
        let has_target = selection.target.is_some() || selection.guid.is_some();
        let target_store = selection.target.and_then(|entity| objects.get(entity).ok());
        let can_attack = has_target
            && crate::target::can_attack(
                target_store,
                factions.as_deref(),
                &reputations,
                self_store,
            );
        let can_interact = has_target
            && crate::target::can_interact(
                target_store,
                factions.as_deref(),
                &reputations,
                self_store,
            );
        let next = (has_target, in_combat, can_attack, can_interact);
        if *current != Some(next) {
            set_hud_state_dom(has_target, in_combat, can_attack, can_interact);
            *current = Some(next);
        }
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
