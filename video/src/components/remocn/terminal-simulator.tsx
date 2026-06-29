"use client";

import {
  Img,
  Sequence,
  staticFile,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type TerminalLineType = "command" | "log" | "success" | "error";

export interface TerminalLine {
  text: string;
  type: TerminalLineType;
  delay?: number;
  /**
   * Extra freeze-frame pause AFTER this line finishes typing, in frames.
   * Use this to build dramatic tension before the next batch of logs.
   * If omitted, lines whose text ends in "..." auto-freeze for 18 frames.
   */
  pause?: number;
}

export interface TerminalSimulatorProps {
  lines?: TerminalLine[];
  prompt?: string;
  title?: string;
  background?: string;
  chromeColor?: string;
  fontSize?: number;
  /**
   * Reveal speed. Despite the name, the reveal is now CHUNKED — each
   * `1 / charsPerFrame` frames bumps the cursor by `chunkSize` characters,
   * so output appears in bursts instead of dripping char-by-char.
   */
  charsPerFrame?: number;
  /** Characters revealed per step. */
  chunkSize?: number;
  speed?: number;
  className?: string;
}

const DEFAULT_LINES: TerminalLine[] = [
  { text: "npm run build", type: "command", delay: 0 },
  { text: "Resolving dependencies...", type: "log", delay: 6 },
  { text: "> remocn@1.0.0 build", type: "log", delay: 4 },
  { text: "> next build", type: "log", delay: 4 },
  { text: "Compiling...", type: "log", delay: 12 },
  { text: "Compiled successfully in 4.2s", type: "success", delay: 14 },
  { text: "Generating static pages (24/24)", type: "log", delay: 10 },
  { text: "Build completed without errors", type: "success", delay: 12 },
];

const TYPE_COLORS: Record<TerminalLineType, string> = {
  command: "oklch(22% 0.02 264)",
  log: "oklch(50% 0.015 264)",
  success: "oklch(0.458 0.305 268.13)",
  error: "#ef4444",
};

/** Auto freeze-frame heuristic: any line ending in "..." holds the camera. */
function autoPause(line: TerminalLine): number {
  if (line.pause !== undefined) return line.pause;
  if (line.text.trimEnd().endsWith("...")) return 18;
  return 0;
}

export function TerminalSimulator({
  lines = DEFAULT_LINES,
  prompt = "$",
  title = "~/projects/remocn",
  background = "#0a0a0a",
  chromeColor = "#1a1a1a",
  fontSize = 18,
  charsPerFrame = 1,
  chunkSize = 1,
  speed = 1,
  className,
}: TerminalSimulatorProps) {
  const frame = useCurrentFrame() * speed;
  const { fps } = useVideoConfig();

  const lineHeight = Math.round(fontSize * 1.6);
  const visibleLines = 8;
  const windowWidth = 900;
  const windowHeight = 480;

  // Compute cumulative start frames for each line, including auto/explicit
  // pauses AFTER a line finishes typing.
  const starts: number[] = [];
  let acc = 10;
  for (let i = 0; i < lines.length; i++) {
    const delay = lines[i].delay ?? 8;
    acc += delay;
    starts.push(acc);
    // Approximate typing duration (in frames) for chunked output.
    const typingFrames = Math.ceil(
      lines[i].text.length / (chunkSize * charsPerFrame),
    );
    acc += typingFrames + autoPause(lines[i]);
  }

  // STEP-FUNCTION scroll. Each overflowing line snaps the buffer up by
  // exactly one lineHeight on the frame it begins. No interpolation, no
  // easing — terminals do not glide.
  let translateY = 0;
  for (let i = visibleLines; i < lines.length; i++) {
    if (frame >= starts[i]) {
      translateY -= lineHeight;
    }
  }

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
      }}
    >
      <div
        style={{
          width: windowWidth,
          height: windowHeight,
          background,
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.55)",
          backdropFilter: "blur(22px)",
          WebkitBackdropFilter: "blur(22px)",
          boxShadow:
            "0 44px 110px rgba(28,40,75,0.30), inset 0 1px 0 rgba(255,255,255,0.65)",
          display: "flex",
          flexDirection: "column",
          fontFamily:
            "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace",
        }}
      >
        {/* Chrome */}
        <div
          style={{
            height: 40,
            background: chromeColor,
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            gap: 8,
            borderBottom: "1px solid oklch(92% 0.005 250)",
          }}
        >
          <Light color="#ff5f57" />
          <Light color="#febc2e" />
          <Light color="#28c840" />
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              color: "#52525b",
              fontSize: 13,
            }}
          >
            <Img
              src={staticFile("logo.png")}
              style={{ width: 18, height: 18, borderRadius: 5 }}
            />
            {title}
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            padding: 20,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 20,
              right: 20,
              top: 20,
              transform: `translateY(${translateY}px)`,
            }}
          >
            {lines.map((line, index) => (
              <Sequence
                key={index}
                from={Math.round(starts[index] / speed)}
                layout="none"
              >
                <TerminalLineRow
                  line={line}
                  prompt={prompt}
                  fontSize={fontSize}
                  lineHeight={lineHeight}
                  charsPerFrame={charsPerFrame}
                  chunkSize={chunkSize}
                  fps={fps}
                  speed={speed}
                />
              </Sequence>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Light({ color }: { color: string }) {
  return (
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        background: color,
        opacity: 0.85,
      }}
    />
  );
}

function TerminalLineRow({
  line,
  prompt,
  fontSize,
  lineHeight,
  charsPerFrame,
  chunkSize,
  fps,
  speed,
}: {
  line: TerminalLine;
  prompt: string;
  fontSize: number;
  lineHeight: number;
  charsPerFrame: number;
  chunkSize: number;
  fps: number;
  speed: number;
}) {
  const localFrame = useCurrentFrame() * speed;
  const totalChars = line.text.length;

  // Chunked reveal: Math.floor of an interpolated count, then snapped to the
  // nearest multiple of `chunkSize`. This is what gives the bursty terminal
  // feel — text doesn't drip, it lurches.
  const linearRevealed = Math.floor(
    interpolate(localFrame, [0, totalChars / charsPerFrame], [0, totalChars], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const revealed = Math.min(
    totalChars,
    Math.ceil(linearRevealed / chunkSize) * chunkSize,
  );
  const visible = line.text.substring(0, revealed);
  const typingDone = revealed >= totalChars;
  // 2 Hz blink at any framerate.
  const cursorVisible = Math.floor((localFrame / fps) * 2) % 2 === 0;

  return (
    <div
      style={{
        height: lineHeight,
        fontSize,
        color: TYPE_COLORS[line.type],
        display: "flex",
        alignItems: "center",
        whiteSpace: "pre",
      }}
    >
      {line.type === "command" && (
        <span style={{ color: "oklch(0.458 0.305 268.13)", marginRight: 8 }}>{prompt}</span>
      )}
      <span>{visible}</span>
      {!typingDone && cursorVisible && (
        <span
          style={{
            display: "inline-block",
            width: fontSize * 0.55,
            height: fontSize,
            background: TYPE_COLORS[line.type],
            marginLeft: 2,
          }}
        />
      )}
    </div>
  );
}
