# Spec brief 01: Core gesture-to-sound engine

> This is a brief for Kiro's spec workflow. Kiro should turn it into
> `.kiro/specs/core-engine/requirements.md`, then `design.md`, then `tasks.md`.

## Goal
Turn normalized hand landmarks into stable, in-scale, click-free sound with under 80 ms end-to-end latency. This is the heart of Ghost Theremin; everything else (summon, visuals, recording) builds on it.

## Scope
- `src/engine/` (pure logic): One Euro smoothing, gesture-to-control mapping, scale quantization with hysteresis, tracking-lost handling.
- `src/vision/` (thin wrapper): MediaPipe HandLandmarker producing normalized landmarks.
- `src/audio/` (thin wrapper): one Tone.js lead voice driven by engine output, master limiter.
- A minimal page: mirrored webcam, "Wake the spirits" start button, debug latency overlay.

Out of scope for this spec: LLM summon, accompaniment, MIDI out, recording, head tracking, final haunted visuals.

## Lessons from the latency spike (branch `spike/latency`, 2026-11-03)
Measured on a Windows laptop webcam in Chrome:
- Camera delivers 30 FPS at 640×480 (in a dark room it dropped to ~20 FPS because of auto-exposure).
- MediaPipe vision: ~7.8 ms per frame. Our processing: ~0.15 ms. Audio output latency: ~10 ms.
- **Detection ran at only 20 FPS while the camera delivered 30**, so one in three frames was dropped.
  Likely cause: per-frame React state updates (pitch/volume text) re-rendering the component.
- Estimated latency ~68 ms excluding camera capture; felt acceptable when playing.

Requirements that follow from this:
- Detection FPS must equal camera FPS. Drive the loop with `requestVideoFrameCallback`.
- **No React state updates in the per-frame loop.** Keep live values in refs or a plain store; update on-screen readouts at most ~10 times per second.
- Request `frameRate: { ideal: 60, min: 30 }` at 640×480, and show the actual camera FPS in the debug overlay.
- If camera FPS drops below 24, show a gentle "The spirits need more light" hint.
- The control point is the palm center (average of wrist and the MCP joints), which is steadier than a fingertip.

## User stories
1. As a player, when I move my right hand left or right, the pitch changes smoothly across about two octaves of the current scale.
2. As a player, when I raise or lower my right hand, the volume rises or falls without clicks or sudden jumps.
3. As a player with tremor, when my hand rests near one spot, the pitch stays on one note instead of flickering.
4. As a player, when my hand leaves the camera view, the sound fades to silence, and resumes smoothly when my hand returns.
5. As a developer, I can see live latency numbers in a debug overlay.

## Acceptance criteria (draft, Kiro should refine)
- WHEN the right-hand x position changes, THE engine SHALL output a MIDI note from the active scale within the configured range.
- WHEN the right-hand y position changes, THE engine SHALL output a gain in `[0, 1]` and SHALL NOT change gain by more than `maxGainDeltaPerFrame` per frame.
- WHILE the hand stays within a hysteresis band around a note boundary, THE engine SHALL keep the current note.
- IF no hand is detected for more than 150 ms, THEN THE engine SHALL ramp gain to 0 within 200 ms.
- IF any input coordinate is NaN, undefined, or outside `[0, 1]`, THEN THE engine SHALL treat it as tracking lost and SHALL NOT throw.
- THE debug overlay SHALL display camera FPS, detection FPS, per-frame processing time, and estimated end-to-end latency.
- WHILE the camera delivers N frames per second, THE system SHALL run detection on all N frames (no dropped frames due to our own code).

## Correctness properties (to be tested with fast-check)
Please enable property-based testing for these and keep the generators broad.

1. **In-scale:** for any x in `[0, 1]` and any valid scale, `quantize(x, scale)` returns a MIDI note whose pitch class is in that scale.
2. **Monotonic:** if `x1 <= x2` then `quantize(x1) <= quantize(x2)` (ignoring hysteresis state).
3. **Valid MIDI:** every output note and velocity is an integer in `0..127`.
4. **Bounded gain change:** across any sequence of inputs, consecutive gains differ by at most `maxGainDeltaPerFrame`.
5. **Smoothing stays in range:** the One Euro Filter output never leaves the min/max of the inputs seen so far.
6. **No flicker:** for any sequence of x values that stays within ±(hysteresis band) of a boundary, the note changes at most once.
7. **Never throws:** for arbitrary input (including NaN, Infinity, negative numbers), the engine step function returns a valid state.

## Non-functional
- Engine step function must not allocate per call (reuse output object).
- Engine code has zero runtime dependencies.
