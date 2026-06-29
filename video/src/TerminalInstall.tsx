import {
  AbsoluteFill,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import {
  TerminalSimulator,
  type TerminalLine,
} from "@/components/remocn/terminal-simulator";
import { SoftBlurIn } from "@/components/remocn/soft-blur-in";

const { fontFamily: mono } = loadFont();
const { fontFamily: sans } = loadInter();

const LINES: TerminalLine[] = [
  { text: "brew install --cask educlopez/tap/ui-craft", type: "command", delay: 4 },
  { text: "Installing Cask ui-craft...", type: "log", delay: 8 },
  { text: "✓ ui-craft v1.0.0 installed", type: "success", delay: 6, pause: 8 },
  { text: "ui-craft install", type: "command", delay: 14 },
  { text: "Detecting AI coding harnesses...", type: "log", delay: 8 },
  { text: "✓ Claude Code", type: "success", delay: 3 },
  { text: "✓ Cursor", type: "success", delay: 3 },
  { text: "✓ Codex", type: "success", delay: 3 },
  { text: "✓ Gemini", type: "success", delay: 3 },
  { text: "✓ OpenCode", type: "success", delay: 3, pause: 8 },
  { text: "Wiring into native config...", type: "log", delay: 8 },
  { text: "→ skill · commands · MCP gates · review agents", type: "log", delay: 5 },
  { text: "→ snapshotted · reversible", type: "log", delay: 4 },
  { text: "✓ Done. Your agent designs with taste.", type: "success", delay: 8 },
];

const CARD_START = 290;

const fade = (f: number, a: number, b: number) =>
  interpolate(f, [a, b], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const CopyIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="rgba(255,255,255,0.6)"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="11" height="11" rx="2.5" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);

const HeroCard: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => {
  const f = useCurrentFrame();
  // Size by HEIGHT (1080 in both formats) so square & wide stay consistent
  // and nothing crowds the short edge. Horizontal space uses width.
  const H = height;
  const logo = fade(f, 0, 18);
  const logoY = interpolate(f, [0, 22], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sub = fade(f, 30, 54);
  const pill = fade(f, 46, 70);
  const pillScale = interpolate(f, [46, 70], [0.96, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const link = fade(f, 64, 86);

  return (
    <AbsoluteFill
      style={{
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: `${H * 0.06}px ${width * 0.06}px`,
        textAlign: "center",
      }}
    >
      {/* logo */}
      <Img
        src={staticFile("logo.png")}
        style={{
          opacity: logo,
          transform: `translateY(${logoY}px)`,
          width: H * 0.088,
          height: H * 0.088,
          borderRadius: H * 0.02,
          boxShadow: "0 16px 40px rgba(10,20,45,0.45)",
        }}
      />

      {/* headline — two lines so per-char reveal never breaks a word */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: H * 0.034,
        }}
      >
        {["Design taste for", "your AI agent"].map((line, i) => (
          <div
            key={line}
            style={{
              position: "relative",
              width: width * 0.9,
              height: H * 0.084,
            }}
          >
            <Sequence from={i * 4} layout="none">
              <SoftBlurIn
                text={line}
                fontSize={H * 0.072}
                color="#ffffff"
                fontWeight={700}
                blur={14}
                fontFamily={sans}
                letterSpacing="-0.03em"
                lineHeight={1.0}
              />
            </Sequence>
          </div>
        ))}
      </div>

      {/* sub */}
      <div
        style={{
          opacity: sub,
          maxWidth: Math.min(width * 0.5, H * 0.6),
          color: "rgba(255,255,255,0.88)",
          fontFamily: sans,
          fontSize: H * 0.0185,
          lineHeight: 1.5,
          marginTop: H * 0.024,
        }}
      >
        Same prompt. Same model. Different result — UI Craft gives your coding
        agent the design intuition it's missing.
      </div>

      {/* glass command pill */}
      <div
        style={{
          opacity: pill,
          transform: `scale(${pillScale})`,
          marginTop: H * 0.034,
          display: "flex",
          alignItems: "center",
          gap: H * 0.016,
          padding: `${H * 0.015}px ${H * 0.024}px`,
          borderRadius: 999,
          background: "rgba(255,255,255,0.14)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.3)",
          boxShadow: "0 14px 40px rgba(10,20,45,0.3)",
        }}
      >
        <span
          style={{
            fontFamily: mono,
            fontSize: H * 0.016,
            color: "#ffffff",
            letterSpacing: 0.5,
          }}
        >
          brew install --cask educlopez/tap/ui-craft
        </span>
        <CopyIcon size={H * 0.019} />
      </div>

      {/* link */}
      <div
        style={{
          opacity: link,
          marginTop: H * 0.024,
          color: "rgba(255,255,255,0.92)",
          fontFamily: sans,
          fontWeight: 600,
          fontSize: H * 0.0145,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        Explore the system <span style={{ fontSize: H * 0.014 }}>↗</span>
      </div>
    </AbsoluteFill>
  );
};

export const TerminalInstall: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const bgScale = interpolate(frame, [0, durationInFrames], [1.0, 1.07]);

  const termOpacity = interpolate(
    frame,
    [CARD_START - 6, CARD_START + 18],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const termScale =
    (width >= 1920 ? 1.5 : 1.06) *
    interpolate(frame, [CARD_START - 6, CARD_START + 18], [1, 0.97], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  // legibility scrim ramps up as the hero takes over
  const scrim = interpolate(frame, [CARD_START - 10, CARD_START + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#cfe0f0", fontFamily: mono }}>
      {/* painterly Figma background */}
      <AbsoluteFill style={{ transform: `scale(${bgScale})` }}>
        <Img
          src={staticFile("bg.png")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>

      {/* terminal scene */}
      <AbsoluteFill style={{ background: "rgba(247,250,253,0.18)" }} />
      <AbsoluteFill
        style={{
          opacity: termOpacity,
          transform: `scale(${termScale})`,
          transformOrigin: "center center",
        }}
      >
        <TerminalSimulator
          lines={LINES}
          prompt="❯"
          title="ui-craft — install"
          background="rgba(255,255,255,0.52)"
          chromeColor="rgba(255,255,255,0.40)"
          fontSize={19}
          charsPerFrame={1}
          chunkSize={2}
        />
      </AbsoluteFill>

      {/* hero scrim + content */}
      <AbsoluteFill
        style={{
          opacity: scrim,
          background:
            "linear-gradient(180deg, rgba(12,20,40,0.58) 0%, rgba(12,20,40,0.32) 42%, rgba(12,20,40,0.52) 100%)",
        }}
      />
      {frame >= CARD_START ? (
        <Sequence from={CARD_START} layout="none">
          <HeroCard width={width} height={height} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
