#!/usr/bin/env python3
"""Auto-detect video content type: talking-head, screen recording, or podcast.

Samples N frames evenly across the video, runs MediaPipe face detection,
and classifies based on face count, size, and position patterns.

Usage:
    python3 detect_content.py INPUT_VIDEO --output content_type.json

Output:
{
    "content_type": "talking-head",
    "confidence": 0.92,
    "face_stats": {"avg_count": 1.0, "avg_size_pct": 15.2, "center_bias": 0.85},
    "frames_sampled": 10
}

Classification rules:
- talking-head: 1 face, large (>=5% frame area), centered (center_bias >= 0.4)
- podcast: 2+ faces consistently, medium size (5-15%)
- screen: <0.5 avg faces, very small faces (<5%), or small off-center faces (PiP/presenter overlay)
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
import time


def sample_frames(video_path, num_frames, tmpdir):
    """Extract N evenly-spaced frames from video as JPEG files."""
    # Get duration
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", video_path],
        capture_output=True, text=True
    )
    try:
        duration = float(result.stdout.strip())
    except (ValueError, AttributeError):
        print(json.dumps({"error": f"Could not determine video duration: {video_path}"}))
        sys.exit(1)

    timestamps = [duration * (i + 0.5) / num_frames for i in range(num_frames)]
    frame_paths = []

    for i, ts in enumerate(timestamps):
        out_path = os.path.join(tmpdir, f"frame_{i:03d}.jpg")
        subprocess.run(
            ["ffmpeg", "-y", "-ss", str(ts), "-i", video_path,
             "-vframes", "1", "-q:v", "2", out_path],
            capture_output=True, text=True
        )
        if os.path.exists(out_path):
            frame_paths.append(out_path)

    return frame_paths


def write_contact_sheet(frame_paths, destination):
    """Retain a reduced copy of each sample for visual content classification."""
    import cv2
    import numpy as np

    columns = min(3, len(frame_paths))
    rows = (len(frame_paths) + columns - 1) // columns
    cell_w, cell_h = 480, 270
    sheet = np.zeros((rows * cell_h, columns * cell_w, 3), dtype=np.uint8)
    for index, path in enumerate(frame_paths):
        frame = cv2.imread(path)
        height, width = frame.shape[:2]
        scale = min(cell_w / width, cell_h / height)
        resized = cv2.resize(frame, (max(1, round(width * scale)), max(1, round(height * scale))))
        h, w = resized.shape[:2]
        x = index % columns * cell_w + (cell_w - w) // 2
        y = index // columns * cell_h + (cell_h - h) // 2
        sheet[y:y + h, x:x + w] = resized
    os.makedirs(os.path.dirname(os.path.abspath(destination)), exist_ok=True)
    if not cv2.imwrite(destination, sheet):
        raise OSError(f"Could not save contact sheet to {destination}")


def detect_faces(frame_paths):
    """Run MediaPipe face detection on frames, return stats."""
    import mediapipe as mp
    import cv2
    import numpy as np

    mp_face = mp.solutions.face_detection
    detector = mp_face.FaceDetection(
        model_selection=1,  # Full range model (works for far faces too)
        min_detection_confidence=0.5
    )

    face_counts = []
    face_sizes = []  # as percentage of frame area
    face_centers_x = []  # normalized x position (0-1)

    for path in frame_paths:
        img = cv2.imread(path)
        if img is None:
            continue

        h, w = img.shape[:2]
        frame_area = h * w

        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = detector.process(rgb)

        if results.detections:
            face_counts.append(len(results.detections))
            for det in results.detections:
                bbox = det.location_data.relative_bounding_box
                face_w = bbox.width * w
                face_h = bbox.height * h
                face_area_pct = (face_w * face_h) / frame_area * 100
                face_sizes.append(face_area_pct)
                center_x = bbox.xmin + bbox.width / 2
                face_centers_x.append(center_x)
        else:
            face_counts.append(0)

    detector.close()

    avg_count = float(np.mean(face_counts)) if face_counts else 0
    avg_size = float(np.mean(face_sizes)) if face_sizes else 0
    size_std = float(np.std(face_sizes)) if len(face_sizes) > 1 else 0
    max_size = float(np.max(face_sizes)) if face_sizes else 0
    center_bias = 0.0
    if face_centers_x:
        # How close to center (0.5)? 1.0 = perfectly centered
        center_bias = 1.0 - float(np.mean([abs(x - 0.5) for x in face_centers_x])) * 2

    return {
        "avg_count": round(avg_count, 2),
        "avg_size_pct": round(avg_size, 2),
        "max_size_pct": round(max_size, 2),
        "size_std": round(size_std, 2),
        "center_bias": round(center_bias, 3),
        "frames_with_faces": sum(1 for c in face_counts if c > 0),
        "total_frames": len(face_counts),
    }


def classify(face_stats):
    """Classify content type based on face detection stats."""
    avg_count = face_stats["avg_count"]
    avg_size = face_stats["avg_size_pct"]
    center_bias = face_stats["center_bias"]
    face_ratio = face_stats["frames_with_faces"] / max(face_stats["total_frames"], 1)

    # Screen recording: few/no faces or very small faces
    if avg_count < 0.5 or (avg_size < 5 and face_ratio < 0.5):
        confidence = min(1.0, (1.0 - avg_count) * 0.5 + (1.0 - face_ratio) * 0.5)
        return "screen", round(confidence, 3)

    # Podcast: multiple faces consistently
    if avg_count >= 1.8 and face_ratio > 0.7:
        confidence = min(1.0, (avg_count - 1.0) * 0.3 + face_ratio * 0.3 + 0.4)
        return "podcast", round(confidence, 3)

    # PiP / off-center face: small-to-medium face that's far from center
    # (e.g., webcam overlay in corner, presenter in slide corner)
    # Face-tracking would zoom into the small face and lose the main content
    if avg_size < 8 and center_bias < 0.4:
        confidence = min(1.0, (1.0 - center_bias) * 0.3 + (8 - avg_size) / 8 * 0.3 + 0.3)
        return "screen", round(confidence, 3)

    # Talking head: single face, large, centered
    if avg_count >= 0.5 and avg_size >= 5:
        confidence = min(1.0, center_bias * 0.4 + min(avg_size / 20, 1.0) * 0.3 + face_ratio * 0.3)
        return "talking-head", round(confidence, 3)

    # Default to screen if uncertain
    return "screen", 0.5


def main():
    parser = argparse.ArgumentParser(description="Detect video content type")
    parser.add_argument("input", help="Input video file")
    parser.add_argument("--output", required=True, help="Output JSON file")
    parser.add_argument("--frames", type=int, default=10,
                        help="Number of frames to sample (default: 10)")

    parser.add_argument("--contact-sheet", help="Save sample frames for visual gameplay review")
    parser.add_argument("--content-type", choices=["gaming", "screen", "talking-head", "podcast"],
                        help="Use the requested or visually reviewed type")
    args = parser.parse_args()
    if args.frames < 1:
        parser.error("--frames must be positive")

    if not os.path.isfile(args.input):
        print(json.dumps({"error": f"Input file not found: {args.input}"}))
        sys.exit(1)

    start = time.time()

    output = {"content_type": args.content_type, "frames_sampled": 0}
    if args.content_type:
        output["classification_source"] = "specified"

    if args.contact_sheet or not args.content_type:
        with tempfile.TemporaryDirectory(prefix="detect_content_") as tmpdir:
            frame_paths = sample_frames(args.input, args.frames, tmpdir)
            if not frame_paths:
                parser.exit(1, "No frames could be extracted\n")
            output["frames_sampled"] = len(frame_paths)
            if args.contact_sheet:
                write_contact_sheet(frame_paths, args.contact_sheet)
                output["contact_sheet"] = os.path.abspath(args.contact_sheet)
            if not args.content_type:
                face_stats = detect_faces(frame_paths)
                output["content_type"], output["confidence"] = classify(face_stats)
                output["face_stats"] = face_stats

    output["detection_time_sec"] = round(time.time() - start, 2)
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w") as f:
        json.dump(output, f, indent=2)

    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
