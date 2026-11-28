# Clipex

![Clipex wordmark and vertical video illustration](clipex-header.svg)

Clipex turns a local video into captioned vertical clips for YouTube Shorts, TikTok, and Instagram Reels. The `shorts` skill runs in Claude Code or Codex. The agent picks highlights or uses your timecodes, then runs the local transcription, rendering, and export tools. Clipex is a fork of claude-shorts by Agrici Daniel.

## Install Clipex

Install the `shorts` skill for your agent.

```bash
npx skills add prvncodz/clipex
```

Select Claude Code or Codex when prompted. Then run `bash setup.sh` from the installed skill directory to install the video processing dependencies. Restart your agent and invoke `/shorts` in Claude Code or `$shorts` in Codex.

### Manual installation

Use Bash on Linux or in [WSL 2](https://learn.microsoft.com/en-us/windows/wsl/install) on Windows. Install Python 3.10+ with `venv`, Node.js 18+ with npm, FFmpeg with `ffprobe`, `jq`, `bc`, and either Claude Code or Codex. The Claude Code installer also needs `rsync`.

Setup uses `~/.video-skill` if it exists. Otherwise, it creates or reuses `~/.shorts-skill`. Rerun `bash setup.sh` after changing `requirements.txt`; it applies the listed versions to either Python environment. Setup also installs dependencies under the skill's `remotion/` directory.

#### Codex

Clone the repo into your personal skills directory and run setup there.

```bash
mkdir -p "$HOME/.agents/skills"
git clone https://github.com/prvncodz/clipex.git "$HOME/.agents/skills/shorts"
cd "$HOME/.agents/skills/shorts"
bash setup.sh
```

If you already have the repo in that directory, run `bash setup.sh` there. Start a new Codex session and invoke `$shorts`.

You can also copy an existing checkout with `bash install.sh codex`. The installer defaults to Claude Code; use `bash install.sh claude` explicitly if preferred.

#### Claude Code

Copy the skill into Claude Code's skills directory, then install dependencies from that copy.

```bash
git clone https://github.com/prvncodz/clipex.git clipex
cd clipex
bash install.sh
cd "$HOME/.claude/skills/shorts"
bash setup.sh
```

Start Claude Code and invoke `/shorts`.

## Samples

- [Foltyn GTA](samples/foltyn-gta.mp4)
- [IShowSpeed GTA](samples/ishowspeed-gta.mp4)
- [Jensen Huang](samples/jensen-huang.mp4)
- [Theo Von and Sam Altman](samples/theo-von-sam-altman.mp4)
- [Untitled](samples/untitled.mp4)

## Make clips

Pass the path to a local video in your prompt. Add a clip count, timecodes, a caption style, a destination platform, or an output directory as needed.

In Codex, enter this prompt.

```text
$shorts Take two clips from ~/Videos/interview.mp4 for YouTube Shorts. Use Studio captions.
```

In Claude Code, use the slash command.

```text
/shorts ~/Videos/gameplay.mp4 Find up to three gameplay highlights for TikTok. Save them to ~/Videos/gameplay-shorts.
```

To use a specific moment, include its start and end times, such as `04:22 to 05:01`. To approve the picks before rendering, add "show me the picks first." By default, the agent selects the clips and continues through export.

## How Clipex edits your video

Clipex transcribes the source with word timestamps and samples frames to choose a layout. For speech-led videos, the agent scores highlights by hook strength, standalone coherence, emotional intensity, value density, and payoff. It defaults to up to three distinct clips that score at least 60. For gameplay, the agent reviews sampled frames and audio cues, then checks the action, setup, and payoff before picking clips. See the [scoring rubric](references/scoring-rubric.md).

Talking-head clips use a face-tracked crop. Screen recordings use a framed layout, and podcasts put the speaker in a wider window with space for a title. Gameplay can fill the vertical frame or place a webcam panel above the action. The gameplay layout uses its own opening title and white captions.

The agent can choose Bold, Bounce, Clean, Numeral, Rise, or Studio for other layouts. Studio uses sentence case with an amber active word on a dark background. Podcasts default to Numeral and may use Rise for emotional or motivational clips. You can request a style in your prompt. See the [caption style reference](SKILL.md#caption-style-reference).

Clipex aligns speech cuts with word boundaries and nearby pauses. The gaming workflow preserves the selected visual timing. Remotion renders the chosen cuts at 1080 × 1920, and FFmpeg encodes them for the target platform. See the [full skill workflow](SKILL.md).

## Find and check your exports

Clipex writes exports to `~/Videos/shorts` by default. If that directory already contains `short_*.mp4` files, the skill uses a fresh subdirectory and reports the final paths. You can also name a destination in your prompt.

Clipex exports YouTube Shorts and Instagram Reels by default. Ask for TikTok if you want a TikTok export. The filename suffix identifies each variant.

| Platform | Example file |
| --- | --- |
| YouTube Shorts | `short_01_yt.mp4` |
| TikTok | `short_01_tt.mp4` |
| Instagram Reels | `short_01_ig.mp4` |

The skill runs a validation pass that checks playback, dimensions, the audio track, codec, duration, and file size. It reports any failures with the output paths. See the [export script](scripts/export.sh) for the encoding settings.

## Choose a transcription backend

The skill prefers local OpenVINO for podcasts when the launcher is available. Other runs use faster-whisper, which can run on NVIDIA CUDA or CPU. The skill uses `small` for CPU-only interviews and podcasts with faster-whisper. The script defaults to `large-v3` for other runs. Ask for a specific model to override these defaults.

For experimental Intel GPU transcription, ask for OpenVINO. If your system has a `shorts-openvino` launcher, the agent can use it. You can also run the transcription script from a separate Python environment with OpenVINO GenAI and a local OpenVINO Whisper model. Activate that environment and run this command from the skill directory.

```bash
python3 scripts/transcribe.py "$HOME/Videos/interview.mp4" \
    --backend openvino --model /path/to/openvino-whisper \
    --output /tmp/clipex-transcript.json
```

Check names, numbers, and word timing against the source before exporting clips from the experimental backend.
