from __future__ import annotations

from pathlib import Path


def normalize_text(text: str) -> str:
    return " ".join(text.replace("\r", "\n").split())


def parse_narration_file(path: str) -> list[str]:
    raw = Path(path).read_text(encoding="utf-8")
    lines = raw.splitlines()

    items: list[str] = []
    for line in lines:
        cleaned = normalize_text(line)
        if cleaned:
            items.append(cleaned)

    return items