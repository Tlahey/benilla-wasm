//! **The UI missing-info audit** — the diagnostic that catches the silent gap: a frame or
//! region that IS on screen but shows nothing. The script-error log catches what raised; this
//! catches what did not (an empty `MinimapZoneText` after `GetMinimapZoneText()` answered "").
//!
//! The walk is over the live model only: [`crate::widget::WidgetArena`]'s frames and the
//! host's `region_data`. Nothing runs Lua, nothing renders, and nothing is recorded unless the
//! player asks for it (`/console uiaudit`) — so the instrument is free when it is not used.
//!
//! Two findings are what the zone-bar report is: a **visible FontString with no text** and a
//! **visible Texture with neither a path nor a fill**. A hidden region is skipped: it is not the
//! player's missing information, it is the UI's own deliberate state.

use crate::widget::{FrameHandle, RegionKind};

use super::{Model, UiScript};

/// One finding. `frame` is the owning frame's published name (or its numeric id when unnamed),
/// `region` is its index in `frame.regions`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UiAuditRow {
    /// The owning frame's name, or `#<id>` for a frame nobody named.
    pub frame: String,
    /// The region's index in the owner's `regions` list.
    pub region: usize,
    /// `"FontString"` / `"Texture"` / `"Title"`.
    pub kind: &'static str,
    /// `"empty text"` / `"no texture"`.
    pub issue: &'static str,
    /// The region's draw layer and the specific shape of the gap.
    pub detail: String,
}

impl UiAuditRow {
    /// The one line a console command prints.
    pub fn line(&self) -> String {
        format!(
            "{} / region {} ({}): {} [{}]",
            self.frame, self.region, self.kind, self.issue, self.detail
        )
    }
}

impl UiScript {
    /// Every visible frame/region finding, optionally scoped to frames whose name starts with
    /// `scope` (`Some("Minimap")`). Arena order; deterministic for a given UI.
    pub fn ui_audit(&self, scope: Option<&str>) -> Vec<UiAuditRow> {
        let model = self.model_ref();
        let mut rows = Vec::new();
        for (handle, frame) in model.arena.iter_frames() {
            if !frame.shown || !frame.effective_visible {
                continue;
            }
            let frame_name = frame_label(&model, handle);
            if let Some(scope) = scope {
                if !frame_name.starts_with(scope) {
                    continue;
                }
            }
            for (index, &rh) in frame.regions.iter().enumerate() {
                let Some(region) = model.arena.region(rh) else {
                    continue;
                };
                let data = model.region_data.get(&rh);
                let hidden = data.is_some_and(|d| d.hidden);
                if hidden {
                    continue;
                }
                let layer = format!("{:?}", region.draw_layer);
                match region.kind {
                    RegionKind::FontString => {
                        let text = data.and_then(|d| d.text.as_deref()).unwrap_or("");
                        if text.trim().is_empty() {
                            let detail = if text.is_empty() {
                                format!("{layer}; FontString text never set")
                            } else {
                                format!("{layer}; FontString text is whitespace only")
                            };
                            rows.push(UiAuditRow {
                                frame: frame_name.clone(),
                                region: index,
                                kind: "FontString",
                                issue: "empty text",
                                detail,
                            });
                        }
                    }
                    RegionKind::Texture => {
                        let painted = data.is_some_and(|d| {
                            d.texture.is_some() || d.fill.is_some() || d.gradient.is_some()
                        });
                        if !painted {
                            rows.push(UiAuditRow {
                                frame: frame_name.clone(),
                                region: index,
                                kind: "Texture",
                                issue: "no texture",
                                detail: format!("{layer}; Texture has no path, fill or gradient"),
                            });
                        }
                    }
                    RegionKind::Title => {}
                }
            }
        }
        rows
    }
}

/// The frame's public name; unnamed frames fall back to their numeric wrapper id so a row is
/// still addressable. Walks the parent chain because a named parent is the useful identity for
/// an unnamed child frame (a tooltip's anonymous inner frame reads as its owner).
fn frame_label(model: &Model, handle: FrameHandle) -> String {
    let mut cursor = Some(handle);
    while let Some(h) = cursor {
        let Some(frame) = model.arena.frame(h) else {
            break;
        };
        if let Some(name) = &frame.name {
            return name.clone();
        }
        cursor = frame.parent;
    }
    match model.frame_to_id.get(&handle) {
        Some(id) => format!("#{id}"),
        None => "<unknown>".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_empty_visible_fontstring_is_found_and_a_filled_one_is_not() {
        let mut script = UiScript::new().expect("VM");
        script
            .run(
                r#"
                AuditFrame = CreateFrame("Frame", "AuditFrame", UIParent)
                AuditFrame:Show()
                AuditText = AuditFrame:CreateFontString("AuditText", "ARTWORK")
                "#,
            )
            .expect("build the audit fixture");

        let rows = script.ui_audit(Some("AuditFrame"));
        assert!(
            rows.iter().any(|r| {
                r.frame == "AuditFrame" && r.kind == "FontString" && r.issue == "empty text"
            }),
            "the never-set FontString is the missing-info row: {rows:?}"
        );

        script
            .run(r#"AuditText:SetText("Durotar")"#)
            .expect("set text");
        let rows = script.ui_audit(Some("AuditFrame"));
        assert!(
            !rows
                .iter()
                .any(|r| r.kind == "FontString" && r.issue == "empty text"),
            "a filled FontString must not be reported: {rows:?}"
        );
    }

    #[test]
    fn a_visible_texture_with_no_art_is_found() {
        let mut script = UiScript::new().expect("VM");
        script
            .run(
                r#"
                AuditTexFrame = CreateFrame("Frame", "AuditTexFrame", UIParent)
                AuditTexFrame:Show()
                AuditTex = AuditTexFrame:CreateTexture("AuditTex", "ARTWORK")
                "#,
            )
            .expect("build the audit fixture");

        let rows = script.ui_audit(Some("AuditTexFrame"));
        assert!(
            rows.iter()
                .any(|r| r.kind == "Texture" && r.issue == "no texture"),
            "the texture with no art is a missing-info row: {rows:?}"
        );
    }

    #[test]
    fn the_scope_keeps_frames_outside_the_prefix() {
        let mut script = UiScript::new().expect("VM");
        script
            .run(
                r#"
                ScopedA = CreateFrame("Frame", "ScopedA", UIParent)
                ScopedA:Show()
                ScopedAText = ScopedA:CreateFontString("ScopedAText", "ARTWORK")
                OtherB = CreateFrame("Frame", "OtherB", UIParent)
                OtherB:Show()
                OtherBText = OtherB:CreateFontString("OtherBText", "ARTWORK")
                "#,
            )
            .expect("build the audit fixture");

        let rows = script.ui_audit(Some("Scoped"));
        assert!(rows.iter().all(|r| r.frame == "ScopedA"), "{rows:?}");
    }
}
