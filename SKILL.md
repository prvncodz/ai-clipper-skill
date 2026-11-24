---
name: shorts
description: >
  Automatic longform-to-shortform video creator. Extracts viral-ready short clips from long videos using Claude/Codex as the orchestrator. Transcribes with faster-whisper (GPU), the model selects highlights and matches captions to each clip, Remotion renders Bold, Bounce, Clean, Numeral, or Rise captions, FFmpeg exports platform-optimized files (YouTube Shorts, TikTok, Instagram Reels). Use when user says "shorts", "short clips", "shortform", "extract clips", "tiktok from video", "reels from video", "vertical clips", or "create shorts".
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - AskUserQuestion
  - Task
---

# shorts — Shortform video creator

Run all ten steps from source video through validated exports. Use any selections the user already gave, including timecodes, clip count, content type, style, and destination platform. Make the remaining editorial choices from the transcript and content detection. Pause for creative review only when requested.

## Pre-Flight

Set SHORTS_ROOT to the directory containing this loaded SKILL.md. If the skill location is unavailable, locate the installation:

```bash
# Try common locations in priority order
SHORTS_ROOT=""
for dir in "$PWD" "$HOME/.agents/skills/shorts" "$HOME/.claude/skills/shorts" "$HOME/.claude/skills/claude-shorts" "$HOME/claude-shorts"; do
    if [ -f "$dir/remotion/render.mjs" ] && [ -f "$dir/scripts/snap_boundaries.py" ]; then
        SHORTS_ROOT="$dir"
        break
    fi
done
if [ -z "$SHORTS_ROOT" ]; then
    echo "ERROR: shorts skill project root not found. Please run from the project directory or install with install.sh"
fi
```

Create a fresh run directory so prior clips cannot enter this export. Reuse the resolved paths for all ten steps. Set OUTPUT_DIR to the requested destination or ./shorts by default.

```bash
SHORTS_TMP_BASE="${SHORTS_TMP:-/tmp/claude-shorts}"
mkdir -p "$SHORTS_TMP_BASE"
SHORTS_TMP=$(mktemp -d "$SHORTS_TMP_BASE/run.XXXXXXXX")
OUTPUT_DIR="${OUTPUT_DIR:-./shorts}"
mkdir -p "$SHORTS_TMP/clips"
```

## 10-Step Pipeline

### Step 1: PREFLIGHT

Run safety checks on the input video:

```bash
bash "$SHORTS_ROOT/scripts/preflight.sh" INPUT_FILE "$OUTPUT_DIR"
```

If preflight fails, report errors and stop. For existing exports, use a fresh output subdirectory and carry it through export and validation. For a disk-space warning, check available space at the working directory and proceed only if it fits the estimate. Report unresolved blockers.

Also detect GPU capabilities:

```bash
bash "$SHORTS_ROOT/scripts/detect_gpu.sh"
```

Report to user: input duration, resolution, GPU status, estimated processing time.

### Step 2: TRANSCRIBE

Transcribe with faster-whisper and keep word-level timestamps. Use `--model small` for interviews and podcasts on a CPU-only transcription setup. Honor an explicitly requested model. For other runs, use the script default.
Audio extraction is handled internally by transcribe.py:

```bash
VENV="$HOME/.video-skill"
[ -d "$VENV" ] || VENV="$HOME/.shorts-skill"
source "$VENV/bin/activate"

python3 "$SHORTS_ROOT/scripts/transcribe.py" INPUT_FILE \
    --output $SHORTS_TMP/transcript.json
```

When the user requests experimental Intel GPU transcription and the local
`shorts-openvino` launcher is available, use it in place of the faster-whisper
command:

```bash
shorts-openvino INPUT_FILE --output "$SHORTS_TMP/transcript.json"
```

The launcher selects `--backend openvino` and a local OpenVINO Whisper model.
To use a separate OpenVINO GenAI environment, run `scripts/transcribe.py` in
that environment with `--backend openvino --model /path/to/openvino-whisper`.
Review names, numbers, and word timing against the source before exporting
clips from the experimental backend.

Output is dual-format JSON:

- `segments[]` — WhisperX-style with word timestamps (for Claude/or any other model to read)
- `captions[]` — Remotion-native `{text, startMs, endMs}` array (for rendering captions)

Report to user: transcription time, word count, language detected.

### Step 3: DETECT CONTENT TYPE

Generate the baseline content type and sample frames for visual routing:

```bash
python3 "$SHORTS_ROOT/scripts/detect_content.py" INPUT_FILE \
    --output "$SHORTS_TMP/content_type.json" --contact-sheet "$SHORTS_TMP/content.jpg"
```

Inspect the contact sheet. Route visible gameplay to **gaming**, including footage without a webcam. A discussion about games, desktop UI, or a webcam in a corner alone is insufficient. For mixed or ambiguous footage, inspect frames from the intended segment. Honor an explicit content type. To record a gaming decision, run `python3 "$SHORTS_ROOT/scripts/detect_content.py" INPUT_FILE --output "$SHORTS_TMP/content_type.json" --content-type gaming`. Carry the effective type into the approved segments and step 8.

- **talking-head**: Face-tracked center crop to 9:16
- **screen**: Letterboxed framed layout (content centered, dark padding)
- **podcast**: Face-centered video in a wider window with black space for the title and below the frame

### Step 4: ANALYZE — Claude(or Any Other AI Agent) Reads Transcript

Read the full transcript directly:

```
Read $SHORTS_TMP/transcript.json
```

For gaming, run the following scan and use the gaming selection rules below in place of the speech scoring rubric. Continue with transcript cleanup for captions.

```bash
python3 "$SHORTS_ROOT/scripts/scan_gaming.py" INPUT_FILE "$SHORTS_TMP/gameplay" > "$SHORTS_TMP/gameplay_candidates.json"
```

Inspect the numbered pages in chronological order. Each page covers 40 seconds. Read its 20 frames left to right, every two seconds. Inspect audio candidate times, funny or surprising dialogue, and visual events independently. Check the surrounding sequence at higher frame rate for each promising moment. Rank by a clear setup, visible payoff, and reaction where present. Silence is valid. Keep the best distinct moments (up to three by default, 3–60 seconds each), preserving the approach, event, and reaction. A loud sound alone is insufficient. Use these picks in step 5.

For other content types, load the scoring rubric:

```
Read $SHORTS_ROOT/references/scoring-rubric.md
```

For a typical long video, score 8-12 candidate segments (15-55 seconds each). Use fewer when the source has fewer distinct moments. Score each candidate on 5 dimensions:

| Dimension | Weight | What to look for |
| ----------- | -------- | ------------------ |
| Hook strength | 0.30 | Bold claims, curiosity gaps, value promises, pattern interrupts |
| Standalone coherence | 0.25 | Makes complete sense without any context from the rest of the video |
| Emotional intensity | 0.20 | Strong opinions, surprise reveals, humor, passion |
| Value density | 0.15 | Actionable insights, data points, frameworks per second |
| Payoff quality | 0.10 | Satisfying conclusion — punchline, reveal, call-to-action |

**Weighted score** = sum of (dimension_score * weight), scale 0-100.

For each candidate, identify:

- Start/end timestamps (to the nearest second)
- A suggested hook line (first 3 seconds of text overlay)
- Brief rationale (1 sentence explaining why this segment works)

**Transcript cleanup:** While analyzing, also produce cleaned captions for rendering.
Read the `captions[]` array from transcript.json, then:

1. Remove a filler only when its omission preserves meaning. Keep comparisons, approximations, names and figures intact.
2. Fix obvious transcription errors based on surrounding context
3. Consolidate incomplete sentence fragments where appropriate
4. **Keep all timestamps unchanged** — only modify the `text` field

Write the cleaned transcript to `$SHORTS_TMP/transcript_cleaned.json` using the same
JSON structure as transcript.json (both `segments` and `captions` arrays). The `captions`
array should contain the cleaned text; copy `segments` as-is.

### Step 5: SELECT HIGHLIGHTS

Honor requested moments and timing. For automatic picks, rank candidates using the rubric. Keep the highest-scoring non-overlapping cuts that deliver distinct payoffs and make sense without the surrounding conversation. Default to up to three scoring at least 60. Use the requested count when the source supports it. If fewer qualify, explain the shortfall. If none qualify, report why and finish before rendering.

### Step 6: SET EDITING OPTIONS

For gaming, set the top-level `content_type` to `gaming`. For each segment, put a concise, accurate opening title in `hook_line1`. Inspect full-resolution frames from that segment and add `gaming` with `gameplay` and `facecam` rectangles in original source pixels (`{ "x": ..., "y": ..., "w": ..., "h": ... }`). Measure the webcam panel bounds, excluding borders and overlays. Set `facecam` to null when absent. Choose gameplay bounds that keep the action visible after a centered portrait crop. Recheck the framing at setup and payoff. Gaming uses its own title and white caption treatment.

For podcasts, default to Numeral with two- or three-word caption groups. Use Rise for emotional or motivational moments when the delivery calls for it. Keep the title short and readable in the black band. For other formats, choose a style from the Caption Style Reference based on delivery and layout. Honor an explicitly requested style.

Use the requested platform. Treat “Reels” as Instagram and “YouTube Shorts” as YouTube. Infer a destination when the brief or clip contains a platform-specific cue, such as a request to stitch on TikTok. Use `all` for an unspecified destination with no such cue or a general cross-platform request. For an explicit subset, export each named target in step 10. Report selected timecodes, hooks, styles and platform briefly and continue. If the user asked to review first, present the picks here and apply their feedback before rendering.

Write approved segments to:

```bash
cat > $SHORTS_TMP/approved_segments.json << 'EOF'
{
  "segments": [
    {
      "id": 1,
      "start": 262.0,
      "end": 301.0,
      "hook_line1": "Nobody talks about this...",
      "hook_line2": "The hidden cost of scaling",
      "score": 87,
      "style": "rise"
    }
  ],
  "platform": "all",
  "content_type": "talking-head"
}
EOF
```

### Step 7: SNAP BOUNDARIES — Audio-Aware Cut Points

Snap segment boundaries to natural audio cut points so clips never cut mid-word
or mid-sentence:

```bash
python3 "$SHORTS_ROOT/scripts/snap_boundaries.py" \
    --segments $SHORTS_TMP/approved_segments.json \
    --transcript $SHORTS_TMP/transcript.json \
    --input-video INPUT_FILE \
    --output $SHORTS_TMP/snapped_segments.json
```

For gaming, the script keeps the selected visual timing and clamps it to the source duration. For other formats, it:

1. Loads word-level timestamps from the transcript
2. Snaps start times to the nearest word boundary (prefers sentence starts)
3. Extends end times to the next sentence boundary (. ? !) if within 3 seconds
4. Adds 300ms padding after the last word
5. Uses FFmpeg silencedetect to find natural pauses near cut points
6. Enforces min 5s / max 60s duration, clamps to video bounds

Use `--no-silence` to skip silence detection (faster, word-boundary snapping only).

Report to user: adjustment deltas per segment (e.g., "start +150ms, end +362ms").

From this point forward, use `snapped_segments.json` instead of `approved_segments.json`.

### Step 8: PREPARE — Extract Clips + Compute Reframe

For gaming, extract each clip with accurate frame timing using `ffmpeg -y -ss START -i INPUT_FILE -t DURATION -map 0:v:0 -map '0:a:0?' -c:v libx264 -preset fast -crf 18 -c:a aac OUTPUT_CLIP`. Use end minus start for DURATION and the same numbered filenames as below.

For other formats, extract each snapped segment via FFmpeg stream copy (near-instant, lossless).
Use the snapped start/end times from `$SHORTS_TMP/snapped_segments.json`:

```bash
ffmpeg -y -ss START -to END -i INPUT_FILE -c copy \
    $SHORTS_TMP/clips/clip_01.mp4
```

Compute reframe coordinates for each clip:

```bash
python3 "$SHORTS_ROOT/scripts/compute_reframe.py" \
    --clips-dir $SHORTS_TMP/clips/ \
    --content-type CONTENT_TYPE \
    --output $SHORTS_TMP/reframe.json
```

Report to user: clips extracted, content type per clip, reframe strategy.

### Step 9: RENDER via Remotion

Render the snapped segments using each segment’s saved style:

```bash
node "$SHORTS_ROOT/remotion/render.mjs" \
    --segments $SHORTS_TMP/snapped_segments.json \
    --reframe $SHORTS_TMP/reframe.json \
    --captions $SHORTS_TMP/transcript_cleaned.json \
    --clips-dir $SHORTS_TMP/clips/ \
    --output-dir $SHORTS_TMP/render/
```

The render script:

1. Bundles the Remotion project once (~5-10s)
2. Opens a shared Chrome instance
3. Renders each segment sequentially (~15-30s each)
4. Outputs 1080x1920 MP4 files

Report progress to user as each segment renders.

### Step 10: EXPORT — Platform-Optimized Encoding

Export rendered shorts with the selected platform value. Use the output directory from preflight for both export and validation:

```bash
bash "$SHORTS_ROOT/scripts/export.sh" \
    --input-dir $SHORTS_TMP/render/ \
    --platform PLATFORM \
    --output-dir "$OUTPUT_DIR"
```

Platform encoding specs:

- **YouTube Shorts**: H.264 High 4.2, 12 Mbps, AAC 192k
- **TikTok**: H.264, CRF 18, -preset slow, AAC 128k
- **Instagram Reels**: H.264 High 4.2, 4.5 Mbps maxrate 5000k, AAC 128k
- **All**: Exports all three variants per clip

With NVENC GPU: `h264_nvenc -preset p5 -tune hq` for 5-10x faster encoding.

Present final summary table:

```
| # | File                      | Platform  | Duration | Size   |
|---|---------------------------|-----------|----------|--------|
| 1 | shorts/short_01_yt.mp4    | YouTube   | 39s      | 12.3MB |
| 1 | shorts/short_01_tt.mp4    | TikTok    | 39s      | 8.7MB  |
| 1 | shorts/short_01_ig.mp4    | Instagram | 39s      | 7.1MB  |
```

**Post-export validation:** Run validation on all exported files:

```bash
bash "$SHORTS_ROOT/scripts/validate.sh" --output-dir "$OUTPUT_DIR"
```

Checks: file is playable, resolution is 1080x1920, audio track exists and isn't silent,
file size is within platform limits, video codec is H.264, duration is 3-90 seconds.
If any file fails, report the issues to the user. Failed files should be re-rendered
or re-exported before delivery.

## Important Rules

- Report costs. Remotion rendering is local and free; GPU power is the only potential cost.
- If a step fails, report the error and suggest fixes.
- Retain working files for revisions unless the user requests cleanup.

## Caption Style Reference

| Style | Font | Look | Best for |
| ------- | ------ | ------ | ---------- |
| **bold** | Montserrat Bold | ALL CAPS, pop-in, yellow active word | Business, education, motivation |
| **bounce** | Bangers | Bouncy scale, rotating bright colors | Entertainment, reactions, energy |
| **clean** | Inter Bold | Minimal fade-in, white + shadow | Professional, calm, interviews |
| **numeral** | Display digits | Rolling digits | Statistics, dates, prices and comparisons |
| **rise** | Display lettering | Staggered letter lift | Storytelling, reveals and emphatic phrases |
| **studio** | Inter Bold | Sentence case, dark rounded background, amber active word | Podcasts and interviews |

Load `references/caption-styles.md` for detailed visual specs and spring configs.

## Configurable Parameters

Apply defaults automatically and honor user-specified settings.

| Parameter | Default | Flag/Var | When to change |
| ----------- | --------- | ---------- | ---------------- |
| Whisper model | `small` for CPU interviews and podcasts, `large-v3` otherwise | `--model MODEL` | Override for a specific speed or accuracy requirement |
| Screen zoom | `0.55` | `--zoom 0.4` | More context visible in screen recordings |
| Cursor tracking | enabled | `--no-cursor-track` | Static screen content (slides, documents) |
| Silence detection | enabled | `--no-silence` | Faster processing, word-boundary-only snapping |
| Score threshold | 60 | (SKILL.md instruction) | Override when requested |
| Segment duration | 15-55s | (SKILL.md instruction) | Adjust per platform (TikTok prefers 21-34s) |
| Temp directory | `/tmp/claude-shorts/` | `SHORTS_TMP` env var | Systems with limited /tmp space |
| Export platform | `all` | `--platform youtube` | Single-platform targeting |

## Error Recovery

- **Transcription fails**: Check venv activation, try `--model small` for less VRAM
- **Remotion render fails**: Check `cd remotion && npm install`, verify node_modules exists
- **Export fails**: Check FFmpeg version (`ffmpeg -version`), try CPU encoding if NVENC fails
- **Out of disk space**: Clean $SHORTS_TMP/, check with `df -h /tmp`
