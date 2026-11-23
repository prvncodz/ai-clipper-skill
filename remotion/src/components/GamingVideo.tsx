import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { useCaptionPages } from "../hooks/useCaptionPages";
import type { Crop, ShortVideoProps } from "../types";

type Source = Pick<ShortVideoProps, "clipSrc" | "sourceWidth" | "sourceHeight">;

function Panel({ clipSrc, sourceWidth, sourceHeight, crop, top, width, height, muted }: Source & {
  crop: Crop; top: number; width: number; height: number; muted: boolean;
}) {
  const scale = Math.max(width / crop.w, height / crop.h);
  return (
    <div style={{ position: "absolute", top, width, height, overflow: "hidden" }}>
      <OffthreadVideo src={clipSrc} muted={muted} style={{
        position: "absolute", width: sourceWidth * scale, height: sourceHeight * scale,
        left: width / 2 - (crop.x + crop.w / 2) * scale,
        top: height / 2 - (crop.y + crop.h / 2) * scale,
      }} />
    </div>
  );
}

type GamingProps = Source & Pick<ShortVideoProps, "captions"> & {
  layout: NonNullable<ShortVideoProps["gaming"]>; title: string;
};

export function GamingVideo({ layout, title, captions, ...source }: GamingProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const now = frame * 1000 / fps;
  const pages = useCaptionPages(captions, 850);
  const page = pages.find(p => p.tokens.some(t => t.fromMs <= now && now < t.toMs));
  const showTitle = Boolean(title) && frame < fps * 2;
  const text = showTitle ? title : page?.tokens.map(t => t.text.trim()).join(" ");
  const seam = layout.facecam ? Math.round(height / 3) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "black", fontFamily: "Arial, sans-serif" }}>
      {layout.facecam && <Panel {...source} crop={layout.facecam} top={0}
        width={width} height={seam} muted />}
      <Panel {...source} crop={layout.gameplay} top={seam}
        width={width} height={height - seam} muted={false} />
      {text && <div style={{
        position: "absolute", left: "50%", top: seam || height * 0.19,
        transform: "translate(-50%, -50%)", textAlign: "center",
        width: "88%", boxSizing: "border-box", overflowWrap: "anywhere",
        background: showTitle ? "white" : undefined,
        borderRadius: 44, padding: showTitle ? "24px 32px" : 0,
        fontSize: showTitle ? 64 : 42, fontWeight: 700, lineHeight: 1.12,
        color: showTitle ? "#121212" : "white",
        WebkitTextStroke: showTitle ? undefined : "5px #191919", paintOrder: "stroke fill",
      }}>{text}</div>}
    </AbsoluteFill>
  );
}
