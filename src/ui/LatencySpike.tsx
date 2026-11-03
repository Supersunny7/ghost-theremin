/**
 * LatencySpike.tsx — throwaway proof-of-concept for latency measurement.
 *
 * Deliberately self-contained in one file so the hot path is easy to profile.
 * This component will be replaced once the engine/audio/vision layers are built.
 *
 * Pipeline per frame:
 *   requestVideoFrameCallback (or rAF fallback)
 *     → MediaPipe HandLandmarker.detectForVideo()   [vision inference ms]
 *     → map wrist x→frequency, y→gain               [our processing ms]
 *     → Tone.js OscillatorNode rampTo()
 *
 * Latency budget (realtime-audio.md):
 *   - Our processing code: < 15 ms per frame
 *   - End-to-end target: < 80 ms
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  HandLandmarker,
  FilesetResolver,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import * as Tone from "tone";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Frequency range mapped to hand x position [0, 1] */
const FREQ_MIN = 110;   // A2
const FREQ_MAX = 1760;  // A6 — wide range to make x movement audible
const GAIN_MIN = 0;
const GAIN_MAX = 0.7;   // keep below 1 to leave headroom for the limiter

/** Ramp time in seconds for frequency and gain changes (avoids clicks) */
const RAMP_S = 0.02;

// ─── Types ───────────────────────────────────────────────────────────────────

interface DebugStats {
  fps: number;
  visionMs: number;
  processingMs: number;
  // Rolling average frame interval (ms) — used for latency estimate
  frameIntervalMs: number;
  // Audio output latency from the WebAudio context (ms), 0 until audio starts
  audioLatencyMs: number;
}

interface CameraSettings {
  width: number;
  height: number;
  frameRate: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Map a value in [0,1] to [min, max] — no allocation, pure math */
function lerp(t: number, min: number, max: number): number {
  return min + t * (max - min);
}

/** Log-scale frequency mapping so pitch changes feel linear to the ear */
function toFreq(x: number): number {
  return FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, x);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LatencySpike() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Tone.js nodes — created once on user gesture, never re-created
  const oscRef = useRef<Tone.Oscillator | null>(null);
  const gainRef = useRef<Tone.Gain | null>(null);
  const limiterRef = useRef<Tone.Limiter | null>(null);

  // MediaPipe landmarker — created once after WASM is loaded
  const landmarkerRef = useRef<HandLandmarker | null>(null);

  // Loop state — stored in refs to avoid re-render allocations on every frame
  const rafIdRef = useRef<number>(0);
  const lastFrameTsRef = useRef<number>(0);  // for fps calculation
  const trackingLostTimerRef = useRef<number>(0); // ms since last detection

  const [audioReady, setAudioReady] = useState(false);
  const [visionReady, setVisionReady] = useState(false);
  const [stats, setStats] = useState<DebugStats>({
    fps: 0,
    visionMs: 0,
    processingMs: 0,
    frameIntervalMs: 0,
    audioLatencyMs: 0,
  });
  const [cameraSettings, setCameraSettings] = useState<CameraSettings | null>(null);
  const [debugVisible, setDebugVisible] = useState(true);
  const [status, setStatus] = useState("Waiting for spirits…");

  // ── Debug overlay toggle (D key) ──────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "d" || e.key === "D") {
        setDebugVisible((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── MediaPipe init ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function initVision() {
      // FilesetResolver downloads the WASM bundle from the CDN.
      // In production this will be self-hosted; for the spike CDN is fine.
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
      );
      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          // GPU delegate where available for lower inference latency
          delegate: "GPU",
        },
        runningMode: "VIDEO",   // required for per-frame detectForVideo()
        numHands: 1,            // spike only needs one hand
      });

      if (!cancelled) {
        landmarkerRef.current = landmarker;
        setVisionReady(true);
        setStatus('Vision ready. Click "Wake the spirits" to begin.');
      }
    }

    initVision().catch((err: unknown) => {
      if (!cancelled) setStatus(`Vision init failed: ${String(err)}`);
    });

    return () => { cancelled = true; };
  }, []);

  // ── Camera init ───────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let stream: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({
        video: {
          width: 640,
          height: 480,
          frameRate: { ideal: 60, min: 30 },
          facingMode: "user",
        },
        audio: false,
      })
      .then((s) => {
        stream = s;
        video.srcObject = s;
        // Read back what the browser/camera actually negotiated
        const track = s.getVideoTracks()[0];
        if (track) {
          const { width = 0, height = 0, frameRate = 0 } = track.getSettings();
          setCameraSettings({ width, height, frameRate: Math.round(frameRate) });
        }
        return video.play();
      })
      .catch((err: unknown) => setStatus(`Camera error: ${String(err)}`));

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Audio init (user-gesture gated) ──────────────────────────────────────
  const wakeSpirits = useCallback(async () => {
    if (audioReady) return;

    // AudioContext must start inside a user gesture (browser autoplay policy)
    await Tone.start();

    // latencyHint: "interactive" is set by Tone when context is started;
    // lower lookAhead to minimise scheduling latency for live play
    Tone.getContext().lookAhead = 0.01;

    const limiter = new Tone.Limiter(-3).toDestination();
    const gain = new Tone.Gain(0).connect(limiter);
    const osc = new Tone.Oscillator({ type: "sine", frequency: FREQ_MIN }).connect(gain);
    osc.start();

    limiterRef.current = limiter;
    gainRef.current = gain;
    oscRef.current = osc;
    setAudioReady(true);
    setStatus("Spirits awake. Show your right hand.");
  }, [audioReady]);

  // ── Per-frame loop ────────────────────────────────────────────────────────
  // Starts once both vision and audio are ready.
  useEffect(() => {
    if (!audioReady || !visionReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Stat smoothing — rolling average over recent frames
    let smoothFps = 0;
    let smoothVisionMs = 0;
    let smoothProcessingMs = 0;
    let smoothFrameIntervalMs = 0;
    const ALPHA = 0.1; // EMA factor

    function frame(nowMs: number) {
      // ── FPS ──────────────────────────────────────────────────────────────
      const dtMs = nowMs - lastFrameTsRef.current;
      lastFrameTsRef.current = nowMs;
      const fps = dtMs > 0 ? 1000 / dtMs : 0;
      smoothFps += ALPHA * (fps - smoothFps);
      // Track the raw interval separately for the latency estimate
      if (dtMs > 0) smoothFrameIntervalMs += ALPHA * (dtMs - smoothFrameIntervalMs);

      // ── Vision inference ─────────────────────────────────────────────────
      performance.mark("vision-start");
      let result: HandLandmarkerResult | null = null;
      if (landmarkerRef.current && video.readyState >= 2) {
        // detectForVideo requires monotonically increasing timestamps
        result = landmarkerRef.current.detectForVideo(video, nowMs);
      }
      performance.mark("vision-end");
      performance.measure("vision", "vision-start", "vision-end");
      const visionMs = performance.getEntriesByName("vision").at(-1)?.duration ?? 0;
      smoothVisionMs += ALPHA * (visionMs - smoothVisionMs);

      // ── Our processing ───────────────────────────────────────────────────
      performance.mark("proc-start");

      const rightHand = result?.landmarks[0];  // numHands=1, first result

      if (rightHand && rightHand.length > 0) {
        trackingLostTimerRef.current = 0;

        // Wrist landmark (index 0) gives the most stable position reference.
        // x is mirrored below in canvas draw so we un-mirror here for
        // intuitive left=low, right=high pitch mapping.
        const wrist = rightHand[0]!;
        const x = 1 - wrist.x;   // un-mirror: 0=left-of-frame, 1=right
        const y = 1 - wrist.y;   // 0=bottom, 1=top; top = louder

        const freq = toFreq(Math.max(0, Math.min(1, x)));
        const vol  = lerp(Math.max(0, Math.min(1, y)), GAIN_MIN, GAIN_MAX);

        // Short ramps avoid per-frame clicks; never set .value directly
        oscRef.current?.frequency.rampTo(freq, RAMP_S);
        gainRef.current?.gain.rampTo(vol, RAMP_S);

        setStatus(`Pitch: ${freq.toFixed(0)} Hz  |  Vol: ${(vol * 100).toFixed(0)}%`);

        // ── Landmark overlay ───────────────────────────────────────────────
        // Draw a simple wrist dot so the user can see what's being tracked.
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.save();
        // Mirror the canvas to match the video mirror transform
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.arc(
          wrist.x * canvas.width,
          wrist.y * canvas.height,
          12, 0, Math.PI * 2
        );
        ctx.fillStyle = "rgba(120, 255, 180, 0.85)";
        ctx.fill();
        ctx.restore();
      } else {
        // Tracking lost — fade to silence after ~150 ms
        trackingLostTimerRef.current += dtMs;
        if (trackingLostTimerRef.current > 150) {
          gainRef.current?.gain.rampTo(0, 0.2); // 200 ms fade
          if (trackingLostTimerRef.current > 350) {
            setStatus("The spirits lost sight of your hand. Raise it back into the light.");
          }
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      performance.mark("proc-end");
      performance.measure("proc", "proc-start", "proc-end");
      const procMs = performance.getEntriesByName("proc").at(-1)?.duration ?? 0;
      smoothProcessingMs += ALPHA * (procMs - smoothProcessingMs);

      // Audio output latency — sum of outputLatency (hardware) and baseLatency
      // (WebAudio graph scheduling). Both are in seconds; convert to ms.
      // Only available after AudioContext is running; fall back to 0.
      const ac = Tone.getContext().rawContext as AudioContext;
      const audioLatencyMs = Math.round(
        ((ac.outputLatency ?? 0) + (ac.baseLatency ?? 0)) * 1000
      );

      setStats({
        fps: Math.round(smoothFps),
        visionMs: Math.round(smoothVisionMs * 10) / 10,
        processingMs: Math.round(smoothProcessingMs * 100) / 100,
        frameIntervalMs: Math.round(smoothFrameIntervalMs * 10) / 10,
        audioLatencyMs,
      });

      // ── Schedule next frame ──────────────────────────────────────────────
      // requestVideoFrameCallback keeps us in sync with the video decoder;
      // fall back to rAF when unavailable.
      if ("requestVideoFrameCallback" in video) {
        // Cast needed because TS lib doesn't always include this yet
        (video as HTMLVideoElement & {
          requestVideoFrameCallback: (cb: (now: number) => void) => number;
        }).requestVideoFrameCallback(frame);
      } else {
        rafIdRef.current = requestAnimationFrame(frame);
      }
    }

    // Kick off the loop
    if ("requestVideoFrameCallback" in video) {
      (video as HTMLVideoElement & {
        requestVideoFrameCallback: (cb: (now: number) => void) => number;
      }).requestVideoFrameCallback(frame);
    } else {
      rafIdRef.current = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [audioReady, visionReady]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.root}>
      {/* aria-live region — all state transitions announced here */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={styles.srOnly}
        id="status-announcer"
      >
        {status}
      </div>

      {/* Video + landmark overlay, stacked */}
      <div style={styles.videoWrapper}>
        <video
          ref={videoRef}
          style={styles.video}
          playsInline
          muted
          aria-label="Mirrored webcam feed"
        />
        <canvas
          ref={canvasRef}
          style={styles.canvas}
          aria-hidden="true"
        />
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        {!audioReady && (
          <button
            style={styles.wakeButton}
            onClick={wakeSpirits}
            disabled={!visionReady}
            aria-label="Wake the spirits and start audio"
          >
            {visionReady ? "👻 Wake the spirits" : "⏳ Loading vision…"}
          </button>
        )}
        <p style={styles.statusText} role="status">{status}</p>
      </div>

      {/* Debug overlay — toggle with D key */}
      {debugVisible && (
        <aside style={styles.debug} aria-label="Debug performance overlay">
          <strong>DEBUG</strong> <span style={styles.debugHint}>(D to hide)</span>
          <table style={styles.debugTable}>
            <tbody>
              <tr>
                <td>Det. FPS</td>
                <td style={fps_color(stats.fps)}>{stats.fps}</td>
              </tr>
              <tr>
                <td>Cam FPS</td>
                <td style={fps_color(cameraSettings?.frameRate ?? 0)}>
                  {cameraSettings ? cameraSettings.frameRate : "—"}
                </td>
              </tr>
              <tr>
                <td>Cam res</td>
                <td style={{ color: "#c0a0ff" }}>
                  {cameraSettings
                    ? `${cameraSettings.width}×${cameraSettings.height}`
                    : "—"}
                </td>
              </tr>
              <tr><td colSpan={2} style={styles.debugDivider} /></tr>
              <tr>
                <td>Vision</td>
                <td style={ms_color(stats.visionMs, 30)}>{stats.visionMs} ms</td>
              </tr>
              <tr>
                <td>Processing</td>
                <td style={ms_color(stats.processingMs, 5)}>{stats.processingMs} ms</td>
              </tr>
              <tr>
                <td>Audio out</td>
                <td style={ms_color(stats.audioLatencyMs, 20)}>{stats.audioLatencyMs} ms</td>
              </tr>
              <tr><td colSpan={2} style={styles.debugDivider} /></tr>
              <tr>
                <td>Est. latency</td>
                <td style={ms_color(
                  stats.frameIntervalMs + stats.visionMs + stats.processingMs + stats.audioLatencyMs,
                  80
                )}>
                  {Math.round(
                    stats.frameIntervalMs + stats.visionMs + stats.processingMs + stats.audioLatencyMs
                  )} ms
                </td>
              </tr>
            </tbody>
          </table>
        </aside>
      )}
    </div>
  );
}

// ─── Colour helpers for the debug overlay ────────────────────────────────────

function fps_color(fps: number): React.CSSProperties {
  if (fps >= 25) return { color: "#6fffaa" };
  if (fps >= 15) return { color: "#ffd966" };
  return { color: "#ff6b6b" };
}

function ms_color(ms: number, warningThreshold: number): React.CSSProperties {
  if (ms < warningThreshold) return { color: "#6fffaa" };
  if (ms < warningThreshold * 2) return { color: "#ffd966" };
  return { color: "#ff6b6b" };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    background: "#0a0010",
    minHeight: "100vh",
    color: "#e8d5ff",
    fontFamily: "monospace",
    padding: "1rem",
    gap: "1rem",
  },
  videoWrapper: {
    position: "relative",
    width: 640,
    maxWidth: "100%",
    aspectRatio: "4/3",
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid #4a2080",
    boxShadow: "0 0 24px #6a00ff44",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    // Mirror so the user sees a natural reflection
    transform: "scaleX(-1)",
    display: "block",
  },
  canvas: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
  },
  controls: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.5rem",
  },
  wakeButton: {
    // Minimum 44×44 px hit target (WCAG 2.5.5)
    minWidth: 220,
    minHeight: 48,
    fontSize: "1.1rem",
    fontFamily: "monospace",
    background: "#3a006f",
    color: "#e8d5ff",
    border: "1px solid #9b59ff",
    borderRadius: 6,
    cursor: "pointer",
    padding: "0.5rem 1.25rem",
  },
  statusText: {
    fontSize: "0.9rem",
    color: "#c0a0ff",
    margin: 0,
    minHeight: "1.4em",
  },
  debug: {
    position: "fixed",
    top: 12,
    right: 12,
    background: "rgba(0,0,0,0.75)",
    border: "1px solid #4a2080",
    borderRadius: 6,
    padding: "0.6rem 0.9rem",
    fontSize: "0.78rem",
    lineHeight: 1.6,
    color: "#c0a0ff",
    zIndex: 100,
  },
  debugHint: {
    color: "#6a4090",
    fontSize: "0.7rem",
    marginLeft: 6,
  },
  debugTable: {
    borderCollapse: "collapse",
    width: "100%",
    marginTop: 4,
  },
  debugDivider: {
    borderTop: "1px solid #2a1050",
    padding: "2px 0",
  },
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
    whiteSpace: "nowrap",
    border: 0,
  },
};
