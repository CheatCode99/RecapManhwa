from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

from kokoro_engine import list_voices, generate_wav
from text_parser import parse_narration_file
from ffmpeg_utils import trim_silence, convert_wav_to_mp3


def ok(**kwargs):
    payload = {"ok": True, **kwargs}
    print(json.dumps(payload, ensure_ascii=False))


def fail(message: str):
    payload = {"ok": False, "error": message}
    print(json.dumps(payload, ensure_ascii=False))
    sys.exit(1)


def handle_list_voices():
    voices = list_voices()
    ok(voices=voices)


def handle_generate_single(args):
    temp_dir = Path(tempfile.mkdtemp(prefix="kokoro_single_"))
    raw_wav = temp_dir / "raw.wav"

    generate_wav(
        text=args.text,
        voice=args.voice,
        speed=args.speed,
        output_path=str(raw_wav),
    )

    final_path = Path(args.output)

    if args.remove_silence:
        trimmed_wav = temp_dir / "trimmed.wav"
        trim_silence(str(raw_wav), str(trimmed_wav))
        source_wav = trimmed_wav
    else:
        source_wav = raw_wav

    final_path.parent.mkdir(parents=True, exist_ok=True)

    if args.format == "wav":
        final_path.write_bytes(source_wav.read_bytes())
    elif args.format == "mp3":
        convert_wav_to_mp3(str(source_wav), str(final_path))
    else:
        fail(f"Unsupported format: {args.format}")

    ok(output_path=str(final_path))


def handle_generate_batch(args):
    items = parse_narration_file(args.input_txt)
    if not items:
        fail("No narration blocks were found in the input file.")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    generated_files: list[str] = []

    for index, text in enumerate(items):
        stem = f"audio_{index:03d}"
        temp_dir = Path(tempfile.mkdtemp(prefix=f"kokoro_batch_{index:03d}_"))
        raw_wav = temp_dir / f"{stem}.wav"

        generate_wav(
            text=text,
            voice=args.voice,
            speed=args.speed,
            output_path=str(raw_wav),
        )

        if args.remove_silence:
            trimmed_wav = temp_dir / f"{stem}_trimmed.wav"
            trim_silence(str(raw_wav), str(trimmed_wav))
            source_wav = trimmed_wav
        else:
            source_wav = raw_wav

        if args.format == "wav":
            final_path = output_dir / f"{stem}.wav"
            final_path.write_bytes(source_wav.read_bytes())
        elif args.format == "mp3":
            final_path = output_dir / f"{stem}.mp3"
            convert_wav_to_mp3(str(source_wav), str(final_path))
        else:
            fail(f"Unsupported format: {args.format}")

        generated_files.append(str(final_path))

    ok(count=len(generated_files), files=generated_files)


def build_parser():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list-voices")

    single = sub.add_parser("generate-single")
    single.add_argument("--text", required=True)
    single.add_argument("--voice", required=True)
    single.add_argument("--speed", type=float, default=1.0)
    single.add_argument("--output", required=True)
    single.add_argument("--remove-silence", action="store_true")
    single.add_argument("--format", choices=["wav", "mp3"], default="wav")

    batch = sub.add_parser("generate-batch")
    batch.add_argument("--input-txt", required=True)
    batch.add_argument("--output-dir", required=True)
    batch.add_argument("--voice", required=True)
    batch.add_argument("--speed", type=float, default=1.0)
    batch.add_argument("--remove-silence", action="store_true")
    batch.add_argument("--format", choices=["wav", "mp3"], default="wav")

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    try:
        if args.command == "list-voices":
            handle_list_voices()
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
