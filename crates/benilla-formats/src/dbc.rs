//! Small shared helpers for our typed DBC catalog loaders (creatures, game objects).
//!
//! DBC files carry no column types, so each loader supplies a [`Schema`] (field count must match the
//! file header) and reads fields by index. Layouts are verified clean-room against build 5875 (the
//! file header's `fieldCount × 4 == recordSize`, cross-checked with wowdev.wiki).

use std::collections::HashMap;
use std::io::Cursor;

use anyhow::{anyhow, Context, Result};
use benilla_dbc::{DbcParser, FieldType, Record, RecordSet, Schema, SchemaField, StringRef, Value};

use crate::FileSource;

/// Parse a DBC's bytes with `schema` into an owned record set (`what` names it for error messages).
pub(crate) fn parse(bytes: &[u8], schema: Schema, what: &str) -> Result<RecordSet> {
    let parser = DbcParser::parse(&mut Cursor::new(bytes))
        .map_err(|e| anyhow!("parsing {what} header: {e}"))?;
    let parser = parser
        .with_schema(schema)
        .map_err(|e| anyhow!("applying {what} schema (field-count mismatch?): {e}"))?;
    parser
        .parse_records()
        .map_err(|e| anyhow!("parsing {what} records: {e}"))
}

/// An unsigned field (accepts the int variants).
pub(crate) fn u32_at(r: &Record, i: usize) -> Option<u32> {
    match r.get_value(i)? {
        Value::UInt32(v) => Some(*v),
        Value::Int32(v) => Some(*v as u32),
        _ => None,
    }
}

/// A float field.
pub(crate) fn f32_at(r: &Record, i: usize) -> Option<f32> {
    match r.get_value(i)? {
        Value::Float32(v) => Some(*v),
        _ => None,
    }
}

/// A signed field (accepts either int variant, mirroring [`u32_at`]'s leniency: the schema tag
/// just picks how the parser decodes the same 4 raw bytes, so a column read as `UInt32` still
/// round-trips through here bit-for-bit).
pub(crate) fn i32_at(r: &Record, i: usize) -> Option<i32> {
    match r.get_value(i)? {
        Value::Int32(v) => Some(*v),
        Value::UInt32(v) => Some(*v as i32),
        _ => None,
    }
}

/// **Which locale slot a localized 1.12.1 DBC fills** — the fix for the French client's shifted
/// name columns.
///
/// A localized install fills the 8-locale block's slot for **its own locale**, not the enUS slot:
/// the French client's `AreaTable` names live at column 13 (base 11 + 2), `SkillLine` at 5
/// (base 3 + 2), `Spell` at 122 (base 120 + 2). Those enUS columns are empty there, so a loader
/// that hardcodes them reads `""` and silently drops every row. Pick the slot inside
/// `base_enus..base_enus+8` with the most non-empty strings instead of assuming enUS.
///
/// `base_enus` is the fixed enUS column from the table's own pinned layout; the call site is the
/// one place that knows it. Falls back to `base_enus` when the bytes are malformed, the block has
/// no readable strings, or every slot is empty (the loader's own "no localization" case).
pub(crate) fn detect_locale_column(bytes: &[u8], base_enus: usize) -> usize {
    let word_at = |off: usize| -> Option<u32> {
        bytes
            .get(off..off + 4)
            .map(|s| u32::from_le_bytes([s[0], s[1], s[2], s[3]]))
    };
    let Some(nrec) = word_at(4).map(|v| v as usize) else {
        return base_enus;
    };
    let Some(nfield) = word_at(8).map(|v| v as usize) else {
        return base_enus;
    };
    let Some(recsize) = word_at(12).map(|v| v as usize) else {
        return base_enus;
    };
    let Some(strsize) = word_at(16).map(|v| v as usize) else {
        return base_enus;
    };
    if bytes.len() < 20
        || &bytes[..4] != b"WDBC"
        || nrec == 0
        || nfield == 0
        || recsize != nfield.saturating_mul(4)
    {
        return base_enus;
    }
    let Some(strbase) = 20usize.checked_add(nrec.saturating_mul(recsize)) else {
        return base_enus;
    };
    let Some(str_end) = strbase.checked_add(strsize) else {
        return base_enus;
    };
    let Some(strings) = bytes.get(strbase..str_end) else {
        return base_enus;
    };
    if base_enus >= nfield {
        return base_enus;
    }
    let last = base_enus.saturating_add(8).min(nfield);
    let mut best = (base_enus, 0usize);
    for column in base_enus..last {
        let mut hits = 0usize;
        for row in 0..nrec {
            let off = word_at(20 + row.saturating_mul(recsize) + column.saturating_mul(4));
            let Some(off) = off else { continue };
            let off = off as usize;
            let Some(rest) = strings.get(off..) else {
                continue;
            };
            let end = rest.iter().position(|&b| b == 0).unwrap_or(rest.len());
            if end > 0 {
                hits += 1;
            }
        }
        if hits > best.1 {
            best = (column, hits);
        }
    }
    best.0
}

/// A non-empty string field, resolved through the record set's string block.
pub(crate) fn str_at(rs: &RecordSet, r: &Record, i: usize) -> Option<String> {
    match r.get_value(i)? {
        Value::StringRef(StringRef(off)) => {
            let s = rs.get_string(StringRef(*off)).ok()?;
            (!s.is_empty()).then(|| s.to_string())
        }
        _ => None,
    }
}

/// `SpellIcon.dbc`: id → texture path (`Interface\Icons\…`, extensionless). 1033 records × 2
/// fields (`ID(0)`, `TextureFilename(1, str)`) — verified against build 5875 (`spells.rs`'s own
/// module doc). Shared by [`crate::spells`] (the action-bar catalog) and [`crate::skill_lines`]
/// (a skill line's own tab icon) — one load, not two, since both just want id → path.
pub(crate) fn load_spell_icon_map(chain: &mut impl FileSource) -> Result<HashMap<u32, String>> {
    let bytes = chain
        .read_file("DBFilesClient\\SpellIcon.dbc")
        .context("reading SpellIcon.dbc")?;
    let mut schema = Schema::new("SpellIcon");
    schema.add_field(SchemaField::new("ID", FieldType::UInt32));
    schema.add_field(SchemaField::new("TextureFilename", FieldType::String));
    let set = parse(&bytes, schema, "SpellIcon.dbc")?;
    let mut icons = HashMap::new();
    for r in set.records() {
        if let (Some(id), Some(path)) = (u32_at(r, 0), str_at(&set, r, 1)) {
            icons.insert(id, path);
        }
    }
    Ok(icons)
}

/// A minimal `ID(0) … Name(name_col) …` schema of `cols` u32-wide columns — the shape every
/// "id → localized name" DBC has, since a string column is itself one u32 offset into the string
/// block. Enough for the id→name reads; the loc block's other 7 slots and its flag mask stay
/// anonymous `cN` columns.
pub(crate) fn id_name_schema(what: &str, name_col: usize, cols: usize) -> Schema {
    let mut s = Schema::new(what);
    for i in 0..cols {
        if i == name_col {
            s.add_field(SchemaField::new("Name", FieldType::String));
        } else {
            s.add_field(SchemaField::new(format!("c{i}"), FieldType::UInt32));
        }
    }
    s
}

/// Read an `ID → name` DBC through the patch chain into a map, skipping rows whose name is empty.
/// Shared by every such table ([`crate::quest_headers`]'s AreaTable/QuestSort,
/// [`crate::quest_info`]'s QuestInfo) — the layout differences are the two column numbers.
pub(crate) fn load_id_name_table(
    chain: &mut impl FileSource,
    file: &str,
    name_col: usize,
    cols: usize,
    what: &str,
) -> Result<HashMap<u32, String>> {
    let bytes = chain
        .read_file(file)
        .with_context(|| format!("reading {file}"))?;
    let name_col = detect_locale_column(&bytes, name_col);
    let rs = parse(&bytes, id_name_schema(what, name_col, cols), what)?;
    let mut out = HashMap::with_capacity(rs.records().len());
    for r in rs.records() {
        // `str_at` already drops an empty string — a row whose name slot points at the string
        // block's leading NUL is a hole, not a name.
        if let (Some(id), Some(name)) = (u32_at(r, 0), str_at(&rs, r, name_col)) {
            out.insert(id, name);
        }
    }
    Ok(out)
}

#[cfg(test)]
mod locale_column_tests {
    use super::detect_locale_column;

    fn wdbc(rows: &[[u32; 9]], strings: &[u8]) -> Vec<u8> {
        let mut out = Vec::new();
        out.extend_from_slice(b"WDBC");
        out.extend_from_slice(&(rows.len() as u32).to_le_bytes());
        out.extend_from_slice(&9u32.to_le_bytes());
        out.extend_from_slice(&36u32.to_le_bytes());
        out.extend_from_slice(&(strings.len() as u32).to_le_bytes());
        for row in rows {
            for value in row {
                out.extend_from_slice(&value.to_le_bytes());
            }
        }
        out.extend_from_slice(strings);
        out
    }

    #[test]
    fn the_populated_locale_slot_wins_over_the_empty_enus_slot() {
        // Column 1 (enUS) is the empty string, column 2 (the frFR slot) is "Nom".
        let bytes = wdbc(&[[0, 0, 1, 0, 0, 0, 0, 0, 0]], b"\0Nom\0");
        assert_eq!(detect_locale_column(&bytes, 1), 2);
    }

    #[test]
    fn the_enus_slot_wins_when_it_is_the_populated_one() {
        let bytes = wdbc(&[[0, 1, 0, 0, 0, 0, 0, 0, 0]], b"\0Name\0");
        assert_eq!(detect_locale_column(&bytes, 1), 1);
    }

    #[test]
    fn malformed_bytes_fall_back_to_the_enus_column() {
        assert_eq!(detect_locale_column(b"not a dbc", 1), 1);
        assert_eq!(detect_locale_column(b"", 1), 1);
    }

    #[test]
    fn every_locale_slot_empty_reads_as_no_localization() {
        let bytes = wdbc(&[[0, 0, 0, 0, 0, 0, 0, 0, 0]], b"\0");
        assert_eq!(detect_locale_column(&bytes, 1), 1);
    }
}
