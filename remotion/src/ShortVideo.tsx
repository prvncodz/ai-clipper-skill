import { AbsoluteFill } from "remotion";
import { GamingVideo } from "./components/GamingVideo";
import { VideoFrame } from "./components/VideoFrame";
import { Captions } from "./components/Captions";
import { HookOverlay } from "./components/HookOverlay";
import { fontFaceCSS } from "./styles/fonts";
import { podcastVideoTop } from "./styles/podcastLayout";
import type { ShortVideoProps } from "./types";

export const ShortVideo: React.FC<ShortVideoProps> = ({
  gaming,
  podcast = false,
  clipSrc,
  sourceWidth,
  sourceHeight,
  crop,
  cropKeyframes,
  captions,
  captionStyle,
  hookLine1,
  hookLine2,
}) => {
  if (gaming) {
    return <GamingVideo layout={gaming} clipSrc={clipSrc} sourceWidth={sourceWidth}
      sourceHeight={sourceHeight} captions={captions} title={[hookLine1, hookLine2].filter(Boolean).join(" ")} />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* Load custom fonts for captions and hook overlay */}
      <style dangerouslySetInnerHTML={{ __html: fontFaceCSS }} />

      {/* Reframed video (cropped and scaled to fill 1080x1920) */}
      <VideoFrame
        clipSrc={clipSrc}
        sourceWidth={sourceWidth}
        sourceHeight={sourceHeight}
        crop={crop}
        cropKeyframes={cropKeyframes}
        podcast={podcast}
      />

      {/* Animated captions */}
      <Captions captions={captions} style={captionStyle} podcast={podcast} />

      {podcast ? (
        <div style={{ position: "absolute", top: 0, left: 90, right: 90, height: podcastVideoTop,
          display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: 37,
          boxSizing: "border-box", color: "white", textAlign: "center", fontFamily: "Montserrat, sans-serif",
          fontWeight: 700, fontSize: 72, lineHeight: 1.08, textWrap: "balance" }}>
          {hookLine1 && <div>{hookLine1}</div>}
          {hookLine2 && <div>{hookLine2}</div>}
        </div>
      ) : (hookLine1 || hookLine2) && (
        <HookOverlay line1={hookLine1 ?? ""} line2={hookLine2 ?? ""} />
      )}
    </AbsoluteFill>
  );
};
