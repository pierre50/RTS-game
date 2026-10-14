#!/usr/bin/env python3
"""Build the accepted stone-studded LPC club walk, slash and hurt layers."""

from pathlib import Path
import argparse

from config import DEFAULT_SOURCE_ROOT
from build_lpc_club_spiked_walk_fixed_preview import build_spiked_sheets


def build_club_sources(source_root: Path = DEFAULT_SOURCE_ROOT) -> None:
    target = source_root / "weapon/blunt/club_playable"
    sheets = build_spiked_sheets()
    for animation, (behind, front) in sheets.items():
        folder = target / animation
        (folder / "behind").mkdir(parents=True, exist_ok=True)
        behind.save(folder / "behind/club.png")
        front.save(folder / "club.png")
    print(f"Prepared stone club sources: {target}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE_ROOT)
    build_club_sources(parser.parse_args().source)
