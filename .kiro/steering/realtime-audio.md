---
inclusion: fileMatch
fileMatchPattern: ["src/engine/**", "src/audio/**", "src/vision/**"]
---

# Real-time audio and vision rules

## Latency budget
- Target: **under 80 ms** from hand movement to audible change, measured end to end.
- Processing inside our code (vision callback through audio parameter update) should stay under 15 ms per frame.
- Instrument the hot path with `performance.mark` / `performance.measure` and expose the numbers in a hidden debug overlay (toggle with the `D` key).

## Hot-path rules (per video frame)
- Do not allocate new objects or arrays in the per-frame loop. Reuse buffers.
- Drive the loop with `requestVideoFrameCallback` when available; fall back to `requestAnimationFrame`.
- Run MediaPipe in `VIDEO` running mode with GPU delegate when available.

## Audio rules
- Create the `AudioContext` with `latencyHint: "interactive"` and set Tone.js `context.lookAhead` low (around 0.01 s) for live play. Accompaniment can be scheduled normally.
- Never set frequency or gain directly per frame. Use short ramps (for example `rampTo` / `setTargetAtTime`, ~10–30 ms) to avoid clicks.
- Master output passes through a limiter. Gain may never jump by more than a configured max delta per frame.
- The AudioContext must start only after a user gesture (button click), per browser autoplay policy.

## Smoothing and stability
- Smooth landmarks with a One Euro Filter (configurable min cutoff and beta).
- Use hysteresis at scale-note boundaries so pitch does not flicker between two notes when the hand rests near a boundary.

## Tracking lost
- If no hand or face is detected for more than ~150 ms, fade volume to zero over ~200 ms. Resume smoothly when tracking returns.
