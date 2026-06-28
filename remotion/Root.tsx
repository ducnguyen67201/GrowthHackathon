import React from "react"; // classic JSX runtime (tsconfig jsx:preserve) needs React in scope
import { Composition, registerRoot } from "remotion";
import {
  HeroVideo,
  HERO_DURATION,
  HERO_FPS,
  HERO_HEIGHT,
  HERO_WIDTH,
  heroDefaultProps,
} from "./HeroVideo";

// Branch G (feat/video-hero). Remotion entry point — bundle()/selectComposition() in
// lib/video.ts target the "HeroVideo" id registered here.
function RemotionRoot() {
  return (
    <Composition
      id="HeroVideo"
      component={HeroVideo}
      durationInFrames={HERO_DURATION}
      fps={HERO_FPS}
      width={HERO_WIDTH}
      height={HERO_HEIGHT}
      defaultProps={heroDefaultProps}
    />
  );
}

registerRoot(RemotionRoot);
