from __future__ import annotations

import asyncio
from pathlib import Path

import edge_tts


def _language_prefix(language: str) -> str:
    return (language or "en").strip().lower()


def _speed_to_rate(speed: float) -> str:
    percent = round((speed - 1.0) * 100)
    return f"{percent:+d}%"


def _normalize_rate(rate: str) -> str:
    value = (rate or "+0%").strip()
    return value if value.endswith("%") else f"{value}%"


def _normalize_pitch(pitch: str) -> str:
    value = (pitch or "+0Hz").strip()
    return value if value.lower().endswith("hz") else f"{value}Hz"


def _normalize_volume(volume: str) -> str:
    value = (volume or "+0%").strip()
    return value if value.endswith("%") else f"{value}%"


async def _fetch_voices(language: str) -> list[str]:
    voices = await edge_tts.list_voices()
    prefix = _language_prefix(language)

    filtered = [
        voice["ShortName"]
        for voice in voices
        if voice.get("Locale", "").lower().startswith(f"{prefix}-")
    ]

    if not filtered:
        filtered = [voice["ShortName"] for voice in voices]

    return sorted(filtered)


def list_voices(language: str = "en") -> list[str]:
    return asyncio.run(_fetch_voices(language))


async def _save_audio(text: str, voice: str, speed: float, output_path: str) -> None:
    rate = _speed_to_rate(speed)
    communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate)
    await communicate.save(output_path)


def generate_mp3(text: str, voice: str, speed: float, output_path: str) -> None:
    if not text.strip():
        raise ValueError("Input text is empty.")

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    asyncio.run(_save_audio(text=text, voice=voice, speed=speed, output_path=str(out)))


async def _save_audio_with_controls(
    text: str,
    voice: str,
    rate: str,
    pitch: str,
    volume: str,
    output_path: str,
) -> None:
    communicate = edge_tts.Communicate(
        text=text,
        voice=voice,
        rate=_normalize_rate(rate),
        pitch=_normalize_pitch(pitch),
        volume=_normalize_volume(volume),
    )
    await communicate.save(output_path)


def generate_mp3_with_controls(
    text: str,
    voice: str,
    rate: str,
    pitch: str,
    volume: str,
    output_path: str,
) -> None:
    if not text.strip():
        raise ValueError("Input text is empty.")

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    asyncio.run(
        _save_audio_with_controls(
            text=text,
            voice=voice,
            rate=rate,
            pitch=pitch,
            volume=volume,
            output_path=str(out),
        )
    )
