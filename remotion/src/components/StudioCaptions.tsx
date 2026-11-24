import { useCurrentFrame, useVideoConfig } from "remotion";
import { useCaptionPages } from "../hooks/useCaptionPages";
import type { Caption } from "../types";

export function StudioCaptions({ captions }: { captions: Caption[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = (frame * 1000) / fps;
  const pages = useCaptionPages(captions, 1050);
  const page = pages.find(({ startMs, tokens }) =>
    time >= startMs && time < (tokens.at(-1)?.toMs ?? startMs) + 100
  );
  if (!page) return null;

  return (
    <div style={{
      position: "absolute", bottom: 325, left: 96, right: 96,
      display: "flex", justifyContent: "center",
    }}>
      <div style={{
        padding: "12px 25px 16px", borderRadius: 18,
        background: "rgba(21, 18, 16, 0.91)", color: "#fff8eb",
        fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 52,
        lineHeight: 1.22, textAlign: "center", whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
      }}>
        {page.tokens.map((token, index) => (
          <span key={index} style={{
            color: time >= token.fromMs && time < token.toMs ? "#ffbe76" : undefined,
          }}>
            {token.text}
          </span>
        ))}
      </div>
    </div>
  );
}
