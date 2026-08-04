#!/usr/bin/env python3
"""
ITW_TCG repository validator.
Run: python3 validate.py
Exits 0 only when all checks pass.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent

CARD_FILES = {
    "energy.json": "energy",
    "support.json": "support",
    "wildlife.json": "wildlife",
    "events.json": "event",
}

EXPECTED_EFFECTS_CATEGORIES = {"energy", "support", "wildlife", "event", "effects"}
OBSOLETE_MECHANICS_CATEGORIES = {"flora", "fauna"}

# Regex: match Flora/Fauna as suit/mechanics references (title-case, standalone word)
# We allow lowercase natural-history words (flora, fauna) in free text.
OBSOLETE_RE = re.compile(r'\bFlora\b|\bFauna\b')

failures = []


def fail(msg):
    failures.append(msg)
    print(f"  FAIL: {msg}")


def check(condition, msg):
    if not condition:
        fail(msg)
    return condition


# ---------------------------------------------------------------------------
# 1-6  Card JSON files
# ---------------------------------------------------------------------------
all_ids = {}  # id -> file

for filename, expected_suit in CARD_FILES.items():
    path = ROOT / filename
    print(f"\nChecking {filename} ...")

    # 1. Valid JSON array
    try:
        cards = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        fail(f"{filename}: invalid JSON or file missing — {exc}")
        continue

    if not check(isinstance(cards, list), f"{filename}: root must be a JSON array"):
        continue

    # 5. Exactly 13 cards
    check(len(cards) == 13, f"{filename}: expected 13 cards, got {len(cards)}")

    seen_ranks = []

    for idx, card in enumerate(cards):
        loc = f"{filename}[{idx}]"

        # 2. mechanics and metadata objects
        if not check(isinstance(card.get("mechanics"), dict), f"{loc}: missing/invalid 'mechanics' object"):
            continue
        check(isinstance(card.get("metadata"), dict), f"{loc}: missing/invalid 'metadata' object")

        mech = card["mechanics"]

        # 3a. mechanics.id — positive integer
        cid = mech.get("id")
        check(
            isinstance(cid, int) and cid > 0,
            f"{loc}: mechanics.id must be a positive integer, got {cid!r}",
        )

        # 3b. mechanics.rank — integer 1-13
        rank = mech.get("rank")
        check(
            isinstance(rank, int) and 1 <= rank <= 13,
            f"{loc}: mechanics.rank must be 1–13, got {rank!r}",
        )
        if isinstance(rank, int):
            seen_ranks.append(rank)

        # 3c. mechanics.cost — nonneg integer
        cost = mech.get("cost")
        check(
            isinstance(cost, int) and cost >= 0,
            f"{loc}: mechanics.cost must be a nonneg integer, got {cost!r}",
        )

        # 3d. mechanics.effects — array of strings
        effects = mech.get("effects")
        check(
            isinstance(effects, list) and all(isinstance(e, str) for e in (effects or [])),
            f"{loc}: mechanics.effects must be an array of strings",
        )

        # 4. canonical suit
        suit = mech.get("suit")
        check(
            suit == expected_suit,
            f"{loc}: mechanics.suit must be '{expected_suit}', got {suit!r}",
        )

        # 6. Unique IDs
        if isinstance(cid, int) and cid > 0:
            if cid in all_ids:
                fail(f"{loc}: mechanics.id {cid} already used in {all_ids[cid]}")
            else:
                all_ids[cid] = filename

        # 9. No obsolete Flora/Fauna mechanics references in effect strings
        for effect_str in (effects or []):
            if OBSOLETE_RE.search(effect_str):
                fail(f"{loc}: effect string contains obsolete 'Flora'/'Fauna' mechanics reference: {effect_str!r}")

    # 5. Ranks 1-13 exactly once
    if len(seen_ranks) == len(cards):
        check(
            sorted(seen_ranks) == list(range(1, 14)),
            f"{filename}: ranks must be 1–13 exactly once, got {sorted(seen_ranks)}",
        )

# ---------------------------------------------------------------------------
# 7. Metadata presentation fields (no suit inference from metadata)
#    We just verify expected fields are present; we do NOT reject biological
#    natural-history words in metadata values.
# ---------------------------------------------------------------------------
EXPECTED_META_FIELDS = {"name", "illustration"}

for filename in CARD_FILES:
    path = ROOT / filename
    try:
        cards = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        continue
    for idx, card in enumerate(cards):
        meta = card.get("metadata")
        if not isinstance(meta, dict):
            continue
        loc = f"{filename}[{idx}]"
        for field in EXPECTED_META_FIELDS:
            check(field in meta, f"{loc}: metadata missing field '{field}'")

# ---------------------------------------------------------------------------
# 8. effects.json
# ---------------------------------------------------------------------------
print("\nChecking effects.json ...")
effects_path = ROOT / "effects.json"
try:
    effects_data = json.loads(effects_path.read_text(encoding="utf-8"))
    check(isinstance(effects_data, dict), "effects.json: root must be a JSON object")

    # Expected categories present
    for cat in EXPECTED_EFFECTS_CATEGORIES:
        check(cat in effects_data, f"effects.json: missing expected category '{cat}'")

    # Obsolete mechanics categories must not appear
    for cat in OBSOLETE_MECHANICS_CATEGORIES:
        check(cat not in effects_data, f"effects.json: contains obsolete mechanics category '{cat}'")

    # 9. No Flora/Fauna mechanics references in effects.json values
    raw_text = effects_path.read_text(encoding="utf-8")
    for m in OBSOLETE_RE.finditer(raw_text):
        fail(f"effects.json: contains obsolete mechanics reference '{m.group()}' at position {m.start()}")

except (FileNotFoundError, json.JSONDecodeError) as exc:
    fail(f"effects.json: invalid JSON or file missing — {exc}")

# ---------------------------------------------------------------------------
# 9/10. index.html
# ---------------------------------------------------------------------------
print("\nChecking index.html ...")
html_path = ROOT / "index.html"
try:
    html = html_path.read_text(encoding="utf-8")

    # 10a. No 'addeventListener' (wrong capitalisation)
    check(
        "addeventListener" not in html,
        "index.html: contains 'addeventListener' (wrong capitalisation)",
    )

    # 10b. Canonical lowercase suit values present
    for suit in ("energy", "support", "wildlife", "event"):
        check(suit in html, f"index.html: missing canonical lowercase suit value '{suit}'")

    # 10c / 9. No old Flora/Fauna suit dropdown or mechanics definitions
    for m in OBSOLETE_RE.finditer(html):
        # Allow title-case in comments only if they look like natural-history prose
        # For code/mechanics context we reject all occurrences.
        fail(f"index.html: contains obsolete mechanics reference '{m.group()}' at position {m.start()}")

except FileNotFoundError:
    fail("index.html: file not found")

# ---------------------------------------------------------------------------
# 11. README.md
# ---------------------------------------------------------------------------
print("\nChecking README.md ...")
readme_path = ROOT / "README.md"
try:
    readme = readme_path.read_text(encoding="utf-8")

    # Documents canonical four suits
    for suit in ("energy", "support", "wildlife", "event"):
        check(suit in readme.lower(), f"README.md: does not mention canonical suit '{suit}'")

    # Documents mechanics.suit authority rule
    check(
        "mechanics.suit" in readme,
        "README.md: does not document the mechanics.suit authority rule",
    )

    # 9. No obsolete Flora/Fauna mechanics references in README.
    # We scan for title-case Flora/Fauna used as active suit/mechanics definitions.
    # We skip:
    #   - artwork path lines (artwork/flora/ or artwork/fauna/)
    #   - lines inside backtick code spans where Flora/Fauna is the *object* being rejected
    #     (i.e. the word appears inside backticks: `Flora` or `Fauna`)
    #   - lines that clearly describe a validator or linter rejecting these terms
    for line_no, line in enumerate(readme.splitlines(), 1):
        if not OBSOLETE_RE.search(line):
            continue
        stripped = line.strip()
        # Allow artwork path references
        if re.search(r'artwork/(flora|fauna)/', stripped, re.IGNORECASE):
            continue
        # Allow lines where the term is inside backticks (documentation *about* the term)
        if re.search(r'`Flora`|`Fauna`', stripped):
            continue
        # Flag only if used in a mechanics/suit definition context
        if re.search(r'suit|mechanic|category|dropdown|card type', stripped, re.IGNORECASE):
            fail(f"README.md:{line_no}: obsolete mechanics reference in mechanics context: {stripped!r}")

except FileNotFoundError:
    fail("README.md: file not found")

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
print("\n" + "=" * 60)
if failures:
    print(f"VALIDATION FAILED — {len(failures)} issue(s) found:")
    for i, f in enumerate(failures, 1):
        print(f"  {i}. {f}")
    sys.exit(1)
else:
    print("VALIDATION PASSED — all checks passed.")
    sys.exit(0)
