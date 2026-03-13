from __future__ import annotations

import argparse
import json
import math
import random
import shutil
import subprocess
from pathlib import Path


FPS = 30
OUT_W = 1920
OUT_H = 1080

# Large working canvas for smoother motion before final 1080p output
WORK_W = 3840
WORK_H = 2160


def ok(**kwargs):
    print(json.dumps({"ok": True, **kwargs}, ensure_ascii=False))


def fail(message: str):
    print(json.dumps({"ok": False, "error": message}, ensure_ascii=False))
    raise SystemExit(1)


def ensure_binary(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise FileNotFoundError(f"{name} was not found in PATH.")
    return path


def natural_key(path: Path):
    import re
    parts = re.split(r"(\d+)", path.name.lower())
    return [int(p) if p.isdigit() else p for p in parts]


def list_files(folder: Path, allowed_exts: set[str]) -> list[Path]:
    files = [
        p for p in folder.iterdir()
        if p.is_file() and p.suffix.lower().lstrip(".") in allowed_exts
    ]
    files.sort(key=natural_key)
    return files


def probe_audio_duration(audio_path: Path) -> float:
    ffprobe = ensure_binary("ffprobe")
    cmd = [
        ffprobe,
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(audio_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return float(result.stdout.strip())


def probe_image_dimensions(image_path: Path) -> tuple[int, int]:
    ffprobe = ensure_binary("ffprobe")
    cmd = [
        ffprobe,
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "csv=p=0:s=x",
        str(image_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    width_str, height_str = result.stdout.strip().split("x")
    return int(width_str), int(height_str)


def choose_animation(enabled: list[str]) -> str:
    if not enabled:
        return "zoom_in"
    return random.choice(enabled)


def compute_fitted_bounds(src_w: int, src_h: int) -> tuple[float, float, float, float]:
    """
    Returns:
        scaled_w, scaled_h, x_pad, y_pad
    after fitting the source into WORK_W x WORK_H while preserving aspect ratio.
    """
    src_aspect = src_w / src_h
    work_aspect = WORK_W / WORK_H

    if src_aspect > work_aspect:
        scaled_w = WORK_W
        scaled_h = WORK_W / src_aspect
        x_pad = 0.0
        y_pad = (WORK_H - scaled_h) / 2.0
    else:
        scaled_h = WORK_H
        scaled_w = WORK_H * src_aspect
        x_pad = (WORK_W - scaled_w) / 2.0
        y_pad = 0.0

    return scaled_w, scaled_h, x_pad, y_pad


def zoom_ease_expr(total_frames: int) -> str:
    total_frames = max(total_frames, 2)
    p = f"(on/{total_frames - 1})"
    # faster start so it feels less laggy
    return f"(1-pow(1-({p}),1.25))"


def pan_ease_expr(total_frames: int) -> str:
    total_frames = max(total_frames, 2)
    # crop uses n, not on
    p = f"(n/{total_frames - 1})"
    # starts moving immediately and continues until the end
    return f"(1-pow(1-({p}),0.65))"


def base_foreground_fit_filter() -> str:
    # Main panel: preserve aspect ratio, fit inside the working canvas, centered,
    # with transparent padding so the blurred background remains visible behind it.
    return (
        f"scale=w='if(gt(a,{WORK_W}/{WORK_H}),{WORK_W},-2)':"
        f"h='if(gt(a,{WORK_W}/{WORK_H}),-2,{WORK_H})':"
        "flags=lanczos,"
        "format=rgba,"
        f"pad={WORK_W}:{WORK_H}:(ow-iw)/2:(oh-ih)/2:color=black@0"
    )


def base_foreground_frame_filter() -> str:
    # Contained foreground panel at output size with transparent padding.
    return (
        f"scale=w='if(gt(a,{OUT_W}/{OUT_H}),{OUT_W},-2)':"
        f"h='if(gt(a,{OUT_W}/{OUT_H}),-2,{OUT_H})':"
        "flags=lanczos,"
        "format=rgba,"
        f"pad={OUT_W}:{OUT_H}:(ow-iw)/2:(oh-ih)/2:color=black@0"
    )


def background_cover_filter() -> str:
    # Background: same image, scaled to fully cover 1920x1080, cropped, then blurred
    return (
        f"scale={OUT_W}:{OUT_H}:force_original_aspect_ratio=increase:"
        "flags=lanczos,"
        f"crop={OUT_W}:{OUT_H},"
        "gblur=sigma=35,"
        "format=yuv420p"
    )


def build_zoom_filter(animation: str, total_frames: int, duration: float) -> str:
    total_frames = max(total_frames, 2)
    zoom_ease = zoom_ease_expr(total_frames)

    duration_ratio = max(duration / 2.0, 1.0)

    zoom_start = 1.00
    zoom_end = min(1.20 + 0.04 * (duration_ratio - 1.0), 1.34)

    if animation == "zoom_in":
        return (
            f"{base_foreground_fit_filter()},"
            f"zoompan="
            f"z='{zoom_start}+({zoom_end - zoom_start})*{zoom_ease}':"
            f"x='iw/2-(iw/zoom/2)':"
            f"y='ih/2-(ih/zoom/2)':"
            f"d=1:s={OUT_W}x{OUT_H}:fps={FPS},"
            "format=rgba"
        )

    if animation == "zoom_out":
        return (
            f"{base_foreground_fit_filter()},"
            f"zoompan="
            f"z='{zoom_end}-({zoom_end - zoom_start})*{zoom_ease}':"
            f"x='iw/2-(iw/zoom/2)':"
            f"y='ih/2-(ih/zoom/2)':"
            f"d=1:s={OUT_W}x{OUT_H}:fps={FPS},"
            "format=rgba"
        )

    return (
        f"{base_foreground_fit_filter()},"
        f"zoompan="
        f"z='{zoom_start}+({zoom_end - zoom_start})*{zoom_ease}':"
        f"x='iw/2-(iw/zoom/2)':"
        f"y='ih/2-(ih/zoom/2)':"
        f"d=1:s={OUT_W}x{OUT_H}:fps={FPS},"
        "format=rgba"
    )


def build_pan_filter(
    animation: str,
    total_frames: int,
    duration: float,
    src_w: int,
    src_h: int,
) -> str:
    total_frames = max(total_frames, 2)
    pan_ease = pan_ease_expr(total_frames)

    scaled_w, scaled_h, x_pad, y_pad = compute_fitted_bounds(src_w, src_h)

    center_x = (WORK_W - OUT_W) / 2
    center_y = (WORK_H - OUT_H) / 2

    horizontal_travel = max(scaled_w - OUT_W, 0)
    vertical_travel = max(scaled_h - OUT_H, 0)

    # Left/right: fit-to-screen behavior, no artificial zoom look
    if animation == "pan_left_to_center":
        if horizontal_travel <= 1:
            x_expr = f"{center_x}"
        else:
            left_x = x_pad
            center_fit_x = x_pad + horizontal_travel / 2
            x_expr = f"{left_x}+(({center_fit_x} - {left_x})*{pan_ease})"
        y_expr = f"{center_y}"

    elif animation == "pan_right_to_center":
        if horizontal_travel <= 1:
            x_expr = f"{center_x}"
        else:
            right_x = x_pad + horizontal_travel
            center_fit_x = x_pad + horizontal_travel / 2
            x_expr = f"{right_x}-(({right_x} - {center_fit_x})*{pan_ease})"
        y_expr = f"{center_y}"

    # Up/down: traverse the real fitted image height
    elif animation == "pan_down_to_center":
        if vertical_travel <= 1:
            y_expr = f"{center_y}"
        else:
            top_y = y_pad
            bottom_y = y_pad + vertical_travel
            y_expr = f"{top_y}+(({bottom_y} - {top_y})*{pan_ease})"
        x_expr = f"{center_x}"

    elif animation == "pan_up_to_center":
        if vertical_travel <= 1:
            y_expr = f"{center_y}"
        else:
            top_y = y_pad
            bottom_y = y_pad + vertical_travel
            y_expr = f"{bottom_y}-(({bottom_y} - {top_y})*{pan_ease})"
        x_expr = f"{center_x}"

    else:
        x_expr = f"{center_x}"
        y_expr = f"{center_y}"

    return (
        f"{base_foreground_fit_filter()},"
        f"crop={OUT_W}:{OUT_H}:x='{x_expr}':y='{y_expr}',"
        f"fps={FPS},"
        "format=rgba"
    )


def build_animation_filter(
    animation: str,
    total_frames: int,
    duration: float,
    src_w: int,
    src_h: int,
) -> str:
    if animation in {"zoom_in", "zoom_out"}:
        return build_zoom_filter(animation, total_frames, duration)

    if animation in {
        "pan_left_to_center",
        "pan_right_to_center",
        "pan_up_to_center",
        "pan_down_to_center",
    }:
        return build_pan_filter(animation, total_frames, duration, src_w, src_h)

    return build_zoom_filter("zoom_in", total_frames, duration)


def horizontal_pan_overlay_x(animation: str, total_frames: int, duration: float) -> str:
    total_frames = max(total_frames, 2)
    ease = pan_ease_expr(total_frames)
    duration_ratio = max(duration / 2.0, 1.0)

    # Keep the move subtle so the contained panel stays inside frame.
    shift = min(140 + 24 * (duration_ratio - 1.0), 280)

    if animation == "pan_left_to_center":
        return f"{shift}*(1-{ease})"

    if animation == "pan_right_to_center":
        return f"-{shift}*(1-{ease})"

    return "0"


def render_pair(image_path: Path, audio_path: Path, output_path: Path, animation: str):
    ffmpeg = ensure_binary("ffmpeg")

    duration = probe_audio_duration(audio_path)
    total_frames = max(2, math.ceil(duration * FPS))
    src_w, src_h = probe_image_dimensions(image_path)

    bg_filter = background_cover_filter()

    if animation in {"zoom_in", "zoom_out"}:
        fg_filter = build_zoom_filter(animation, total_frames, duration)
        overlay_x = "(W-w)/2"
        overlay_y = "(H-h)/2"

    elif animation in {
        "pan_up_to_center",
        "pan_down_to_center",
    }:
        fg_filter = build_pan_filter(animation, total_frames, duration, src_w, src_h)
        overlay_x = "(W-w)/2"
        overlay_y = "(H-h)/2"

    elif animation in {"pan_left_to_center", "pan_right_to_center"}:
        fg_filter = f"{base_foreground_frame_filter()},fps={FPS},format=rgba"
        overlay_x = f"(W-w)/2+({horizontal_pan_overlay_x(animation, total_frames, duration)})"
        overlay_y = "(H-h)/2"

    else:
        fg_filter = build_zoom_filter("zoom_in", total_frames, duration)
        overlay_x = "(W-w)/2"
        overlay_y = "(H-h)/2"

    filter_complex = (
        f"[0:v]{bg_filter}[bg];"
        f"[0:v]{fg_filter}[fgsrc];"
        "[fgsrc]split[fg][fgshadowsrc];"
        "[fgshadowsrc]alphaextract,gblur=sigma=12[fgalpha];"
        f"color=c=black:s={OUT_W}x{OUT_H}:r={FPS},format=rgba[shadowbase];"
        "[shadowbase][fgalpha]alphamerge,colorchannelmixer=aa=0.32[shadow];"
        f"[bg][shadow]overlay=x='{overlay_x}+18':y='{overlay_y}+18':format=auto[bgshadow];"
        f"[bgshadow][fg]overlay=x='{overlay_x}':y='{overlay_y}':format=auto,format=yuv420p[v]"
    )

    cmd = [
        ffmpeg,
        "-y",
        "-loop", "1",
        "-framerate", str(FPS),
        "-i", str(image_path),
        "-i", str(audio_path),
        "-filter_complex", filter_complex,
        "-map", "[v]",
        "-map", "1:a:0",
        "-r", str(FPS),
        "-c:v", "h264_nvenc",
        "-preset", "p6",
        "-rc", "vbr_hq",
        "-cq", "19",
        "-b:v", "0",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        "-shortest",
        str(output_path),
    ]

    subprocess.run(cmd, check=True, capture_output=True, text=True)

def handle_generate_batch(args):
    image_dir = Path(args.image_dir)
    audio_dir = Path(args.audio_dir)
    output_dir = Path(args.output_dir)

    if not image_dir.exists():
        fail(f"Image folder not found: {image_dir}")
    if not audio_dir.exists():
        fail(f"Audio folder not found: {audio_dir}")

    output_dir.mkdir(parents=True, exist_ok=True)

    image_files = list_files(image_dir, {"png", "jpg", "jpeg", "webp"})
    audio_files = list_files(audio_dir, {"wav", "mp3", "m4a", "ogg", "aac"})

    if not image_files:
        fail("No image files found.")
    if not audio_files:
        fail("No audio files found.")
    if len(image_files) != len(audio_files):
        fail(f"Image/audio count mismatch. Images: {len(image_files)}, Audio: {len(audio_files)}")

    enabled_animations = [item.strip() for item in args.animations.split(",") if item.strip()]
    generated_files: list[str] = []

    total = len(image_files)

    for index, (image_path, audio_path) in enumerate(zip(image_files, audio_files), start=1):
        animation = choose_animation(enabled_animations)
        output_name = f"video_{index-1:03d}.mp4"
        output_path = output_dir / output_name

        print(
            json.dumps(
                {
                    "type": "progress",
                    "current": index,
                    "total": total,
                    "image": image_path.name,
                    "audio": audio_path.name,
                    "animation": animation,
                    "output": output_name,
                },
                ensure_ascii=False,
            ),
            flush=True,
        )

        render_pair(image_path, audio_path, output_path, animation)
        generated_files.append(str(output_path))

    print(
        json.dumps(
            {
                "type": "done",
                "ok": True,
                "count": len(generated_files),
                "files": generated_files,
            },
            ensure_ascii=False,
        ),
        flush=True,
    )


def build_parser():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)

    batch = sub.add_parser("generate-batch")
    batch.add_argument("--image-dir", required=True)
    batch.add_argument("--audio-dir", required=True)
    batch.add_argument("--output-dir", required=True)
    batch.add_argument("--animations", default="zoom_in")

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    try:
        if args.command == "generate-batch":
            handle_generate_batch(args)
        else:
            fail("Unknown command.")
    except Exception as exc:
        fail(str(exc))


if __name__ == "__main__":
    main()
