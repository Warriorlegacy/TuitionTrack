#!/usr/bin/env python3
"""Synthesize one narration chunk with edge-tts (Microsoft Edge neural voices).

Free, no API key, no account. Invoked by src/lib/learn/narration.ts as:

    python scripts/tts_edge.py --text-file <in.txt> --out <out.mp3> \
        [--voice en-IN-NeerjaNeural] [--rate +0%] [--pitch +0Hz] \
        [--subs <out.vtt>]

Reads the text from a FILE rather than argv so long narrations never hit a
command-line length limit or get mangled by shell quoting.

Exits non-zero with a message on stderr if synthesis fails, so the caller can
retry or fall back.

Why a helper instead of calling the API from Node: edge-tts speaks a
websocket protocol with its own auth handshake and a specific binary framing.
Driving the maintained Python library is far more robust than reimplementing
that, and it means voice/rate/pitch stay identical to the documented defaults.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys


async def synth(args: argparse.Namespace) -> int:
    try:
        import edge_tts
    except ImportError:
        print(
            "edge-tts is not installed. Install it with:\n"
            "  pip install edge-tts",
            file=sys.stderr,
        )
        return 3

    with open(args.text_file, encoding="utf-8") as fh:
        text = fh.read().strip()
    if not text:
        print("empty narration text", file=sys.stderr)
        return 4

    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)

    communicate = edge_tts.Communicate(text, args.voice, rate=args.rate, pitch=args.pitch)

    if args.subs:
        os.makedirs(os.path.dirname(os.path.abspath(args.subs)) or ".", exist_ok=True)
        await communicate.save(args.out, args.subs)
    else:
        await communicate.save(args.out)

    if not os.path.exists(args.out) or os.path.getsize(args.out) == 0:
        print("edge-tts produced no audio", file=sys.stderr)
        return 5

    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="edge-tts narration helper")
    p.add_argument("--text-file", required=True, help="file containing the text to speak")
    p.add_argument("--out", required=True, help="path to write the MP3")
    p.add_argument("--voice", default=os.environ.get("TTS_VOICE", "en-IN-NeerjaNeural"))
    p.add_argument("--rate", default=os.environ.get("TTS_RATE", "+0%"))
    p.add_argument("--pitch", default=os.environ.get("TTS_PITCH", "+0Hz"))
    p.add_argument("--subs", default="", help="optional path to write a VTT subtitle file")
    args = p.parse_args()

    try:
        return asyncio.run(synth(args))
    except Exception as e:  # noqa: BLE001
        print(f"edge-tts failed: {type(e).__name__}: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
