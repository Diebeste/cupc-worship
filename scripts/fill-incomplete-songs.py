#!/usr/bin/env python3
"""Fill incomplete library songs from confirmed published sources only.

Never machine-translates or invents lyrics. Structural moves and splits
are allowed. Run from repo root after a timestamped backup.

Lyric bodies live in fill-data/*.json next to this script so this file
stays small.
"""
from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime
from pathlib import Path

ROOT = Path("/workspace/worship-app")
LIB = ROOT / "src/data/library-songs.json"
DATA = ROOT / "scripts/fill-data"
SOURCES_MD = ROOT / "backups/fill-sources.md"
SPLITS_MD = ROOT / "backups/splits.md"
SUMMARY_JSON = ROOT / "backups/review/fill-summary.json"


def sec(typ, label, en=None, es=None, notes=""):
    return {
        "type": typ,
        "label": label,
        "notes": notes,
        "linesEn": list(en or []),
        "linesEs": list(es or []),
    }


def find(songs, sid):
    for i, s in enumerate(songs):
        if s["id"] == sid:
            return i, s
    raise KeyError(sid)


def set_sections(song, sections, **fields):
    song["sections"] = sections
    for k, v in fields.items():
        if v is not None:
            song[k] = v
    return song


def new_song(sid, title, sections, original_key="", aliases=None, artist="", notes=""):
    return {
        "id": sid,
        "title": title,
        "artist": artist,
        "originalKey": original_key,
        "bpm": "",
        "notes": notes,
        "sections": sections,
        "aliases": aliases or [],
        "seeded": True,
    }


def load_data(_name=None):
    """Merge every part-*.json under scripts/fill-data/."""
    updates, new_songs = [], []
    for path in sorted(DATA.glob("part-*.json")):
        chunk = json.loads(path.read_text())
        updates.extend(chunk.get("updates") or [])
        new_songs.extend(chunk.get("new_songs") or [])
    return {"updates": updates, "new_songs": new_songs}


def flatten_en(song, drop_headers=None):
    drop = set(drop_headers or [])
    out = []
    for section in song.get("sections") or []:
        for line in section.get("linesEn") or []:
            if line.strip() in drop:
                continue
            out.append(line)
    return out


def couple_existing_en(song, upd):
    """Keep existing English, attach official Spanish templates."""
    templates = upd["sections_es_only_template"]
    drop = upd.get("drop_en_headers") or []
    raw = flatten_en(song, drop)
    if upd.get("split_existing_en_on_blanks"):
        stanzas = split_blanks(raw)
        sections = []
        for i, tmpl in enumerate(templates):
            en = stanzas[i] if i < len(stanzas) else []
            if i == len(templates) - 1 and len(stanzas) > len(templates):
                rest = []
                for extra in stanzas[i:]:
                    rest.extend((rest and [""] or []) + extra)
                en = rest or en
            sections.append(sec(tmpl["type"], tmpl["label"], en, tmpl.get("linesEs") or []))
        return sections
    slices = upd.get("en_stanza_slices") or []
    # flatten ignoring blank-only lines for slicing by non-empty index
    nonempty = [l for l in raw if l.strip()]
    sections = []
    for i, tmpl in enumerate(templates):
        if i < len(slices):
            a, b = slices[i]
            en = nonempty[a:] if b is None else nonempty[a:b]
        else:
            en = []
        sections.append(sec(tmpl["type"], tmpl["label"], en, tmpl.get("linesEs") or []))
    return sections


def split_blanks(arr):
    out, cur = [], []
    for x in arr:
        if x.strip() == "":
            if cur:
                out.append(cur)
                cur = []
        else:
            cur.append(x)
    if cur:
        out.append(cur)
    return out


def apply(songs: list) -> dict:
    sources = []
    splits = []
    filled_ids = set()
    split_new_ids = set()
    structural_ids = set()

    def src(sid, title, what, url, extra=""):
        sources.append({"id": sid, "title": title, "filled": what, "url": url, "notes": extra})

    data = load_data("fills.json")

    # Each entry in data["updates"] is applied in order.
    by_id = data["updates"]
    for upd in by_id:
        sid = upd["id"]
        i, s = find(songs, sid)
        fields = {k: upd[k] for k in ("title", "artist", "originalKey", "aliases") if k in upd}
        if upd.get("keep_existing_en") and upd.get("sections_es_only_template"):
            set_sections(s, couple_existing_en(s, upd), **fields)
        elif "sections" in upd:
            set_sections(s, upd["sections"], **fields)
        else:
            for k, v in fields.items():
                s[k] = v
        src(s["id"], s.get("title") or sid, upd.get("filled", ""), upd.get("url", ""), upd.get("notes", ""))
        if upd.get("kind") == "structural":
            structural_ids.add(s["id"])
        else:
            filled_ids.add(s["id"])
        for sp in upd.get("splits", []):
            splits.append({"from": sid, **sp})

    for ns in data.get("new_songs", []):
        songs.append(
            new_song(
                ns["id"],
                ns["title"],
                ns["sections"],
                original_key=ns.get("originalKey", ""),
                aliases=ns.get("aliases"),
                artist=ns.get("artist", ""),
                notes=ns.get("notes", ""),
            )
        )
        split_new_ids.add(ns["id"])
        src(ns["id"], ns["title"], ns.get("filled", ""), ns.get("url", ""), ns.get("notes", ""))
        if ns.get("split_from"):
            splits.append({
                "from": ns["split_from"],
                "removed": ns.get("removed", ns["title"]),
                "moved_to": ns.get("moved_to", f"{ns['id']} (new entry)"),
            })

    return {
        "sources": sources,
        "splits": splits,
        "filled_ids": sorted(filled_ids),
        "split_new_ids": sorted(split_new_ids),
        "structural_ids": sorted(structural_ids),
        "song_count": len(songs),
    }


def write_markdown(summary):
    lines_out = [
        "# Lyric fill sources",
        "",
        "Filled only from official or well-known published English or Spanish texts. No machine translation or invented lyrics.",
        "",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M %Z')}",
        "",
    ]
    for row in summary["sources"]:
        lines_out += [
            f"## {row['title']}",
            f"- **id:** `{row['id']}`",
            f"- **What was filled:** {row['filled']}",
            f"- **URL:** {row['url']}",
        ]
        if row.get("notes"):
            lines_out.append(f"- **Notes:** {row['notes']}")
        lines_out.append("")
    SOURCES_MD.write_text("\n".join(lines_out))

    split_lines = [
        "# Songs split out of mixed records",
        "",
        "Each extra pasted song was either moved to a new entry or recognized as already present (not duplicated).",
        "",
    ]
    for sp in summary["splits"]:
        split_lines += [
            f"- **From** `{sp['from']}`: {sp['removed']}",
            f"  - Moved to: {sp['moved_to']}",
            "",
        ]
    SPLITS_MD.write_text("\n".join(split_lines))


def main():
    songs = json.loads(LIB.read_text())
    before_n = len(songs)
    summary = apply(songs)
    LIB.write_text(json.dumps(songs, ensure_ascii=False, indent=2) + "\n")
    write_markdown(summary)
    SUMMARY_JSON.parent.mkdir(parents=True, exist_ok=True)
    out = {k: summary[k] for k in summary if k != "sources"}
    out["source_count"] = len(summary["sources"])
    SUMMARY_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
    print(f"songs {before_n} -> {len(songs)}")
    print(f"filled {len(summary['filled_ids'])}: {summary['filled_ids']}")
    print(f"new splits {summary['split_new_ids']}")
    print(f"structural {len(summary['structural_ids'])}")
    print(f"sources -> {SOURCES_MD}")
    print(f"splits  -> {SPLITS_MD}")


if __name__ == "__main__":
    main()
