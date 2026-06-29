import { Composition } from "remotion";
import { TerminalInstall } from "./TerminalInstall";

const FPS = 30;
const DURATION = 17 * FPS; // 510 frames, 17s

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TerminalInstall"
        component={TerminalInstall}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1080}
      />
      <Composition
        id="TerminalInstallWide"
        component={TerminalInstall}
        durationInFrames={DURATION}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};
