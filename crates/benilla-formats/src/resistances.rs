//! Original vanilla Resistances.dbc school vocabulary. The name column is not fixed
//! across regional builds: the reference client puts it at column 3, some localized
//! installs (the French 1.12.1 client) put it at column 5. Detect the column whose
//! seven rows all resolve to a non-empty string instead of assuming one.
use crate::{
    dbc::{id_name_schema, parse, str_at, u32_at},
    FileSource,
};
use anyhow::{Context, Result};
use std::collections::HashMap;

pub struct ResistanceCatalog {
    pub names: HashMap<u8, String>,
}

/// The u32 column whose seven entries are string offsets into the block.
fn detect_name_column(bytes: &[u8]) -> Option<usize> {
    if bytes.len() < 20 || &bytes[..4] != b"WDBC" {
        return None;
    }
    let word_at = |off: usize| -> Option<u32> {
        bytes
            .get(off..off + 4)
            .map(|s| u32::from_le_bytes([s[0], s[1], s[2], s[3]]))
    };
    let nrec = word_at(4)? as usize;
    let nfield = word_at(8)? as usize;
    let recsize = word_at(12)? as usize;
    let strsize = word_at(16)? as usize;
    if nrec == 0 || nfield == 0 || recsize != nfield * 4 {
        return None;
    }
    let strbase = 20 + nrec.checked_mul(recsize)?;
    let strings = bytes.get(strbase..strbase + strsize)?;
    // Column 0 is the id; a name column must resolve for all rows.
    for column in 1..nfield {
        let mut all_names = true;
        for row in 0..nrec {
            let off = word_at(20 + row * recsize + column * 4)? as usize;
            let Some(rest) = strings.get(off..) else {
                all_names = false;
                break;
            };
            let end = rest.iter().position(|&b| b == 0).unwrap_or(rest.len());
            if end == 0 {
                all_names = false;
                break;
            }
        }
        if all_names {
            return Some(column);
        }
    }
    None
}

pub fn load_resistance_catalog(source: &mut impl FileSource) -> Result<ResistanceCatalog> {
    let bytes = source
        .read_file("DBFilesClient/Resistances.dbc")
        .context("reading Resistances.dbc")?;
    let name_col = detect_name_column(&bytes)
        .context("Resistances.dbc has no string column covering all seven schools")?;
    let nfield = u32::from_le_bytes([bytes[8], bytes[9], bytes[10], bytes[11]]) as usize;
    let rows = parse(
        &bytes,
        id_name_schema("Resistances", name_col, nfield),
        "Resistances.dbc",
    )?;
    let mut names = HashMap::new();
    for row in rows.records() {
        if let (Some(id), Some(name)) = (u32_at(row, 0), str_at(&rows, row, name_col)) {
            if id < 7 && !name.is_empty() {
                names.insert(id as u8, name);
            }
        }
    }
    anyhow::ensure!(
        names.len() == 7,
        "Resistances.dbc lacks one or more school names"
    );
    Ok(ResistanceCatalog { names })
}
