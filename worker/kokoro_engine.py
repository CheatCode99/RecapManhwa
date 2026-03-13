from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro


BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"

MODEL_PATH = MODELS_DIR / "kokoro-v1.0.onnx"
VOICES_PATH = MODELS_DIR / "voices-v1.0.bin"


def ensure_model_files() -> None:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Missing Kokoro model: {MODEL_PATH}")
    if not VOICES_PATH.exists():
        raise FileNotFoundError(f"Missing Kokoro voices file: {VOICES_PATH}")


@lru_cache(maxsize=1)
def get_kokoro() -> Kokoro:
    ensure_model_files()
    return Kokoro(str(MODEL_PATH), str(VOICES_PATH))


def list_voices() -> list[str]:
    """
    voices-v1.0.bin is stored as numpy key/value style voice data.
    We read the keys so the UI can populate the voice dropdown.
    """
    ensure_model_files()
    data = np.load(VOICES_PATH, allow_pickle=True)
    return sorted(list(data.keys()))


def generate_wav(
    text: str,
    voice: str,
    speed: float,
    output_path: str,
    lang: str = "en-us",
) -> None:
    if not text.strip():
        raise ValueError("Input text is empty.")

    kokoro = get_kokoro()

    samples, sample_rate = kokoro.create(
        text,
        voice=voice,
        speed=speed,
        lang=lang,
    )

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    sf.write(str(out), samples, sample_rate)