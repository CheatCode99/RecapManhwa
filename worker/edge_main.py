from __future__ import annotations

import argparse
import json
import shutil
import sys
import tempfile
from pathlib import Path

from text_parser import parse_narration_file
from ffmpeg_utils import trim_silence, convert_audio


def ok(**kwargs):
    payload = {"ok": True, **kwargs}
    print(json.dumps(payload, ensure_ascii=False))


def fail(message: str):
    payload = {"ok": False, "error": message}
    print(json.dumps(payload, ensure_ascii=False))
    sys.exit(1)


def load_edge_engine():
    try:
        from edge_engine import list_voices, generate_mp3_with_controls
    except ModuleNotFoundError as exc:
        if exc.name == "edge_tts":
            fail(
                "Edge TTS dependency is missing. Install it with: "
                "pip install edge-tts==7.2.7"
            )
        raise

    return list_voices, generate_mp3_with_controls


def finalize_audio(
    raw_audio_path: Path,
    final_path: Path,
    output_format: str,
    remove_silence: bool,
) -> None:
    working_audio = raw_audio_path

    if remove_silence:
        wav_input = raw_audio_path.with_name(f"{raw_audio_path.stem}_source.wav")
        convert_audio(str(raw_audio_path), str(wav_input))

        trimmed_wav = raw_audio_path.with_name(f"{raw_audio_path.stem}_trimmed.wav")
        trim_silence(str(wav_input), str(trimmed_wav))
        working_audio = trimmed_wav

    final_path.parent.mkdir(parents=True, exist_ok=True)

    if output_format == "mp3":
        if working_audio.suffix.lower() == ".mp3":
            shutil.copyfile(working_audio, final_path)
        else:
            convert_audio(str(working_audio), str(final_path))
        return

    if output_format == "wav":
        convert_audio(str(working_audio), str(final_path))
        return

    fail(f"Unsupported format: {output_format}")


def handle_list_voices(args):
    list_voices, _ = load_edge_engine()
    ok(voices=list_voices(args.language))


def handle_generate_single(args):
    _, generate_mp3 = load_edge_engine()

    temp_dir = Path(tempfile.mkdtemp(prefix="edge_single_"))
    raw_audio = temp_dir / "raw.mp3"

    generate_mp3(
        text=args.text,
        voice=args.voice,
        rate=args.rate,
        pitch=args.pitch,
        volume=args.volume,
        output_path=str(raw_audio),
    )

    final_path = Path(args.output)
    finalize_audio(raw_audio, final_path, args.format, args.remove_silence)
    ok(output_path=str(final_path))


def handle_generate_batch(args):
    _, generate_mp3 = load_edge_engine()

    items = parse_narration_file(args.input_txt)
    if not items:
        fail("No narration blocks were found in the input file.")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    generated_files: list[str] = []

    for index, text in enumerate(items):
        stem = f"audio_{index:03d}"
        temp_dir = Path(tempfile.mkdtemp(prefix=f"edge_batch_{index:03d}_"))
        raw_audio = temp_dir / f"{stem}.mp3"

        generate_mp3(
            text=text,
            voice=args.voice,
            rate=args.rate,
            pitch=args.pitch,
            volume=args.volume,
            output_path=str(raw_audio),
        )

        if args.format == "wav":
            final_path = output_dir / f"{stem}.wav"
        elif args.format == "mp3":
            final_path = output_dir / f"{stem}.mp3"
        else:
            fail(f"Unsupported format: {args.format}")

        finalize_audio(raw_audio, final_path, args.format, args.remove_silence)
        generated_files.append(str(final_path))

    ok(count=len(generated_files), files=generated_files)


def build_parser():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)

    voices = sub.add_parser("list-voices")
    voices.add_argument("--language", default="en")

    single = sub.add_parser("generate-single")
    single.add_argument("--language", default="en")
    single.add_argument("--text", required=True)
    single.add_argument("--voice", required=True)
    single.add_argument("--rate", default="+0%")
    single.add_argument("--pitch", default="+0Hz")
    single.add_argument("--volume", default="+0%")
    single.add_argument("--output", required=True)
    single.add_argument("--remove-silence", action="store_true")
    single.add_argument("--format", choices=["wav", "mp3"], default="mp3")

    batch = sub.add_parser("generate-batch")
    batch.add_argument("--language", default="en")
    batch.add_argument("--input-txt", required=True)
    batch.add_argument("--output-dir", required=True)
    batch.add_argument("--voice", required=True)
    batch.add_argument("--rate", default="+0%")
    batch.add_argument("--pitch", default="+0Hz")
    batch.add_argument("--volume", default="+0%")
    batch.add_argument("--remove-silence", action="store_true")
    batch.add_argument("--format", choices=["wav", "mp3"], default="mp3")

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    try:
        if args.command == "list-voices":
            handle_list_voices(args)
        elif args.command == "generate-single":
            handle_generate_single(args)
        elif args.command == "generate-batch":
            handle_generate_batch(args)
        else:
            fail("Unknown command.")
    except Exception as exc:
        fail(str(exc))


if __name__ == "__main__":
    main()
