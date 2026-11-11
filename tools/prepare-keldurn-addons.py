#!/usr/bin/env python3
"""Prepare bundled Atlas add-ons for the vanilla client's frFR locale."""

import argparse
import re
from pathlib import Path


STRICTNESS_FILES = {
    "Atlas/Libs/Babble-Boss-2.2/Babble-Boss-2.2.lua": "BabbleBoss",
    "Atlas/Libs/Babble-Class-2.2/Babble-Class-2.2.lua": "BabbleClass",
    "Atlas/Libs/Babble-Faction-2.2/Babble-Faction-2.2.lua": "BabbleFaction",
    "Atlas/Libs/Babble-ItemSet-2.2/Babble-ItemSet-2.2.lua": "BabbleItemSet",
    "Atlas/Libs/Babble-Zone-2.2/Babble-Zone-2.2.lua": "BabbleZone",
    "AtlasLoot/Libs/Babble-Boss-2.2/Babble-Boss-2.2.lua": "BabbleBoss",
    "AtlasLoot/Libs/Babble-Class-2.2/Babble-Class-2.2.lua": "BabbleClass",
    "AtlasLoot/Libs/Babble-Faction-2.2/Babble-Faction-2.2.lua": "BabbleFaction",
    "AtlasLoot/Libs/Babble-ItemSet-2.2/Babble-ItemSet-2.2.lua": "BabbleItemSet",
    "AtlasLoot/Libs/Babble-Spell-2.2/Babble-Spell-2.2.lua": "BabbleSpell",
    "AtlasLoot/Libs/Babble-Zone-2.2/Babble-Zone-2.2.lua": "BabbleZone",
}
LOCALE_FILES = (
    "Atlas/Libs/AceLocale-2.2/AceLocale-2.2.lua",
    "AtlasLoot/Libs/AceLocale-2.2/AceLocale-2.2.lua",
)


def relax_locale_strictness(path: Path, symbol: str) -> bool:
    text = path.read_text()
    pattern = re.compile(
        rf"^(\s*{re.escape(symbol)}:SetStrictness\()(true|false)(\)\s*)$",
        re.MULTILINE,
    )
    matches = list(pattern.finditer(text))
    if len(matches) != 1:
        raise ValueError(f"{path}: expected one {symbol}:SetStrictness call, found {len(matches)}")
    match = matches[0]
    if match.group(2) == "false":
        return False
    path.write_text(text[: match.start(2)] + "false" + text[match.end(2) :])
    return True


def remove_unsupported_boss_names(path: Path) -> bool:
    lines = path.read_text().splitlines(keepends=True)
    entries = [line for line in lines if line.strip().casefold() == r"bossnames\bossnames.xml"]
    if len(entries) > 1:
        raise ValueError(f"{path}: duplicate BossNames.xml entries")
    if not entries:
        return False
    path.write_text("".join(line for line in lines if line not in entries))
    return True


def filter_unknown_french_translations(path: Path) -> bool:
    text = path.read_text()
    marker = 'if GetLocale() == "frFR" then\n\t\t\tfor key in pairs(self[TRANSLATIONS]) do'
    if marker in text:
        return False

    validation = "\t\tfor key, value in pairs(self[TRANSLATIONS]) do\n"
    if text.count(validation) != 1:
        raise ValueError(f"{path}: expected one translation-key validation loop")
    fallback = (
        '\t\tif GetLocale() == "frFR" then\n'
        "\t\t\tfor key in pairs(self[TRANSLATIONS]) do\n"
        "\t\t\t\tif not rawget(self[BASE_TRANSLATIONS], key) then\n"
        "\t\t\t\t\tself[TRANSLATIONS][key] = nil\n"
        "\t\t\t\tend\n"
        "\t\t\tend\n"
        "\t\tend\n"
    )
    path.write_text(text.replace(validation, fallback + validation, 1))
    return True


def guard_french_loot_table_names(path: Path) -> bool:
    text = path.read_text()
    assignment = re.compile(
        r'^([ \t]*)AtlasLoot_TableNames\["([^"]+)"\]\[1\][ \t]*=[ \t]*(.*?);[ \t]*(--[^\n]*)?$',
        re.MULTILINE,
    )
    transformed, count = assignment.subn(
        lambda match: (
            f'{match.group(1)}SetTableName("{match.group(2)}", {match.group(3)});'
            f"{' ' + match.group(4) if match.group(4) else ''}"
        ),
        text,
    )
    if re.search(r"^[ \t]*AtlasLoot_TableNames\[", transformed, re.MULTILINE):
        raise ValueError(f"{path}: unsupported direct AtlasLoot_TableNames assignment")

    helper = """  local function SetTableName(name, title)
    local tableName = AtlasLoot_TableNames[name]
    if tableName then
      tableName[1] = title
    end
  end

"""
    marker = 'if (GetLocale() == "frFR") then\n'
    if transformed.count(marker) != 1:
        raise ValueError(f"{path}: expected one frFR locale guard")
    if "local function SetTableName(" not in transformed:
        transformed = transformed.replace(marker, marker + helper, 1)

    if count == 0:
        return False
    path.write_text(transformed)
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("addons", type=Path, help="Keldurn AddOns directory")
    root = parser.parse_args().addons
    if not root.is_dir():
        parser.error(f"not an add-ons directory: {root}")

    changed = []
    for relative in LOCALE_FILES:
        if filter_unknown_french_translations(root / relative):
            changed.append(relative)

    for relative, symbol in STRICTNESS_FILES.items():
        path = root / relative
        if relax_locale_strictness(path, symbol):
            changed.append(relative)

    boss_names = root / "AtlasLoot/AtlasLoot.toc"
    if remove_unsupported_boss_names(boss_names):
        changed.append("AtlasLoot/AtlasLoot.toc")

    loot_table_names = root / "AtlasLoot/TableRegister/loottables.fr.lua"
    if guard_french_loot_table_names(loot_table_names):
        changed.append("AtlasLoot/TableRegister/loottables.fr.lua")

    print(f"Prepared Keldurn addons for frFR ({len(changed)} files changed)")


if __name__ == "__main__":
    main()
