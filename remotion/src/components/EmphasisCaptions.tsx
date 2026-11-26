import { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Caption } from "../types";
import { podcastVideoHeight, podcastVideoTop } from "../styles/podcastLayout";

type Style = "numeral" | "rise";

function groupWords(captions: Caption[]) {
  const pages: Caption[][] = [];
  for (const word of captions) {
    if (!word.text.trim()) continue;
    const page = pages[pages.length - 1];
    const previous = page?.[page.length - 1];
    if (page && previous && page.length < 3 &&
        page.map(w => w.text.trim()).join(" ").length + word.text.trim().length < 24 &&
        word.startMs - previous.endMs <= 350 && !/[.!?]$/.test(previous.text.trim())) {
      page.push(word);
    } else {
      pages.push([word]);
    }
  }
  return pages;
}

function emphasis(page: Caption[], style: Style) {
  if (style === "numeral") {
    return page.find(w => /\d/.test(w.text)) ??
      page.find(w => /^(?:[A-Z]{2,}|[A-Z][a-z]+[A-Z])/.test(w.text.trim()));
  }
  return page.reduce((best, word) =>
    word.text.trim().length > best.text.trim().length ? word : best);
}

export function EmphasisCaptions({ captions, style, podcast = false }: {
  captions: Caption[];
  style: Style;
  podcast?: boolean;
}) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const now = frame * 1000 / fps;
  const pages = useMemo(() => groupWords(captions), [captions]);
  const page = pages.find(words => words[0].startMs <= now && words[words.length - 1].endMs > now);
  if (!page) return null;

  const word = emphasis(page, style);
  const chars = Array.from(word?.text.trim().toUpperCase() ?? "");
  const end = page[page.length - 1].endMs;
  const start = word?.startMs ?? end;
  const duration = Math.max(1, end - start);
  const age = now - start;
  if (podcast) {
    return (
      <div style={{
        position: "absolute", top: podcastVideoTop + podcastVideoHeight - 150,
        left: 72, right: 72, height: 116,
        display: "flex", alignItems: "center", justifyContent: "center", gap: "0.23em",
        fontFamily: "Montserrat, sans-serif", fontWeight: 700,
        fontSize: Math.min(83, 1280 / page.map(token => token.text.trim()).join(" ").length),
        lineHeight: 1.15, whiteSpace: "nowrap", color: "white",
        WebkitTextStroke: "9px #000", paintOrder: "stroke fill",
        textShadow: "0 6px 9px #000",
      }}>
        {page.map((token, index) => {
          const active = now >= token.startMs && now < token.endMs;
          const emphasized = token === word && now >= token.startMs;
          const progress = Math.min(1, Math.max(0, (now - token.startMs) / 175));
          const motion = emphasized ? Math.sin(progress * Math.PI) : 0;
          return <span key={index} style={{
            color: active || emphasized ? "#fff02d" : undefined,
            transform: style === "rise" ? `translateY(${-12 * motion}px)` : `scale(${1 + 0.1 * motion})`,
          }}>{token.text.trim()}</span>;
        })}
      </div>
    );
  }

  const intro = Math.min(duration * 0.48, style === "numeral" ? 733 : 400);
  const exit = Math.min(duration * 0.18, 267);
  const leaving = Math.max(0, 1 - (end - now) / exit);
  let digits = 0;

  return <div style={{ position: "absolute", top: "57%", left: "7%", right: "7%",
    color: "white", textAlign: "center", textShadow: "0 3px 9px #000, 0 1px 3px #000" }}>
    {word && age >= 0 && <div style={{ height: 170, display: "flex", justifyContent: "center",
      alignItems: "end", fontFamily: "Anton, sans-serif", fontSize: Math.min(145, width * .78 / Math.max(chars.length, 1)),
      opacity: style === "numeral" ? 1 - leaving : 1 }}>
      {chars.map((char, index) => {
        const delay = style === "rise" ? intro * .4 * index / Math.max(1, chars.length - 1) : 0;
        const t = Math.min(1, Math.max(0, (age + 1000 / fps - delay) / (intro - delay)));
        if (style === "numeral" && /\d/.test(char)) {
          const offset = (7 + 3 * digits++) * (t === 1 ? 0 : 2 ** (-10 * t));
          const step = Math.floor(offset);
          return <span key={index} style={{ position: "relative", overflow: "hidden", width: ".62em", height: "1.2em", lineHeight: 1.2 }}>
            {[0, 1].map(row => <span key={row} style={{ position: "absolute", inset: 0,
              transform: `translateY(${(row + step - offset) * 100}%)` }}>
              {(Number(char) + step + row) % 10}
            </span>)}
          </span>;
        }
        const up = 1 + 2 * (t - 1) ** 3 + (t - 1) ** 2;
        return <span key={index} style={{ display: "inline-block", overflow: "hidden", lineHeight: 1.2 }}>
          <span style={{ display: "inline-block", transform: `translateY(${100 * (1 - up + leaving ** 2)}%)` }}>{char}</span>
        </span>;
      })}
    </div>}
    <div style={{ position: "absolute", top: 176, left: 0, right: 0, fontFamily: "Montserrat, sans-serif",
      fontWeight: 800, fontSize: 48, lineHeight: 1.25, overflowWrap: "anywhere",
      textTransform: style === "numeral" ? "uppercase" : "lowercase" }}>
      {page.map((token, i) => <span key={i} style={{
        color: now >= token.startMs && now < token.endMs ? "#FFE066" : "white",
      }}>{i > 0 && " "}{token.text.trim()}</span>)}
    </div>
  </div>;
}
