
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


def ensure_ffmpeg_exists(ffmpeg_path: str = "ffmpeg") -> str:
    resolved = shutil.which(ffmpeg_path) if ffmpeg_path == "ffmpeg" else ffmpeg_path
    if not resolved:
        raise FileNotFoundError("FFmpeg was not found.")
    return resolved

def trim_silence(input_path: str, output_path: str, ffmpeg_path: str = "ffmpeg") -> None:
    ffmpeg = ensure_ffmpeg_exists(ffmpeg_path)

    filter_chain = (
        "silenceremove="
        "start_periods=0:"
        "stop_periods=-1:"
        "stop_duration=1.0:"
        "stop_threshold=-50dB:"
        "stop_silence=0.35:"
        "detection=rms:"
        "window=0.03"
    )

    cmd = [
        ffmpeg,
        "-y",
        "-i",
        input_path,
        "-af",
        filter_chain,
        output_path
    ]

    subprocess.run(cmd, check=True, capture_output=True, text=True)

def enhance_speech(input_path: str, output_path: str, ffmpeg_path: str = "ffmpeg") -> None:
    ffmpeg = ensure_ffmpeg_exists(ffmpeg_path)

    filter_chain = (
        "highpass=f=90,"
        "equalizer=f=300:width_type=q:width=1.2:g=-2.8,"
        "equalizer=f=3000:width_type=q:width=1.0:g=2.8,"
        "equalizer=f=5200:width_type=q:width=0.9:g=2.2,"
        "equalizer=f=8500:width_type=q:width=0.8:g=1.2,"
        "deesser=i=0.35:m=0.5:f=0.5:s=o,"
        "compand=attacks=0.01:decays=0.20:points=-80/-80|-22/-18|0/-5,"
        "loudnorm=I=-16:LRA=11:TP=-1.5,"
        "afade=t=out:st=0:d=0.03"
    )

    cmd = [
        ffmpeg,
        "-y",
        "-i",
        input_path,
        "-af",
        filter_chain,
        "-ar", "24000",
        "-ac", "1",
        "-sample_fmt", "s16",
        output_path,
    ]

    subprocess.run(cmd, check=True, capture_output=True, text=True)

def convert_wav_to_mp3(input_path: str, output_path: str, ffmpeg_path: str = "ffmpeg") -> None:
    ffmpeg = ensure_ffmpeg_exists(ffmpeg_path)

    cmd = [
        ffmpeg,
        "-y",
        "-i",
        input_path,
        "-codec:a",
        "libmp3lame",
        "-q:a",
        "2",
        output_path,
    ]
    subprocess.run(cmd, check=True)


def convert_audio(input_path: str, output_path: str, ffmpeg_path: str = "ffmpeg") -> None:
    ffmpeg = ensure_ffmpeg_exists(ffmpeg_path)

    out_ext = Path(output_path).suffix.lower()
    cmd = [
        ffmpeg,
        "-y",
        "-i",
        input_path,
    ]

    if out_ext == ".mp3":
        cmd.extend(["-codec:a", "libmp3lame", "-q:a", "2"])

    cmd.append(output_path)
    subprocess.run(cmd, check=True, capture_output=True, text=True)
