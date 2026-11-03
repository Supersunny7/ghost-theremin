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
- THE debug overlay SHALL display per-frame processing time and estimated end-to-end latency.

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
