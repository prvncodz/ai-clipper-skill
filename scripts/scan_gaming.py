"""Generate chronological gameplay contact sheets and nearby audio-reaction candidates."""
import argparse
import json
import math
from pathlib import Path
import subprocess

import numpy as np


def reaction_times(source):
    probe = subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
        "stream=index", "-of", "csv=p=0", source,
    ])
    if not probe.strip():
        return []

    # One RMS value per second keeps memory independent of decoded audio size.
    levels = []
    with subprocess.Popen([
        "ffmpeg", "-v", "error", "-i", source, "-map", "0:a:0", "-ac", "1",
        "-ar", "8000", "-f", "s16le", "-",
    ], stdout=subprocess.PIPE) as audio:
        while block := audio.stdout.read(16000):
            samples = np.frombuffer(block, dtype="<i2").astype(float) / 32768
            levels.append(10 * math.log10(max(float(np.mean(samples ** 2)), 1e-10)))
        if audio.wait():
            raise RuntimeError("Could not decode gameplay audio")

    candidates = []
    for second, level in enumerate(levels):
        nearby = levels[max(0, second - 10):second + 11]
        rise = level - float(np.median(nearby))
        if level > -45 and rise >= 6:
            candidates.append((rise, second))
    selected = []
    for _, second in sorted(candidates, reverse=True):
        if all(abs(second - previous) >= 8 for previous in selected):
            selected.append(second)
            if len(selected) >= max(8, math.ceil(len(levels) / 60)):
                break
    return sorted(selected)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    args.directory.mkdir(parents=True, exist_ok=True)
    # Each page covers 40 seconds. Cell n on zero-based page p is at 40*p + 2*n.
    subprocess.run([
        "ffmpeg", "-nostdin", "-v", "error", "-y", "-i", args.source, "-an",
        "-vf", "fps=1/2:round=up,scale=240:144:force_original_aspect_ratio=decrease,"
        "pad=240:144:(ow-iw)/2:(oh-ih)/2,tile=5x4",
        "-start_number", "0", "-q:v", "3", str(args.directory / "page_%04d.jpg"),
    ], check=True)
    print(json.dumps({"seconds_per_cell": 2, "cells_per_page": 20,
                      "audio_candidate_seconds": reaction_times(args.source)}))


if __name__ == "__main__":
    main()
