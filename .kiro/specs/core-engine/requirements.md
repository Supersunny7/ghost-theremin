# Requirements Document

## Introduction

The core gesture-to-sound engine is the heart of Ghost Theremin. It converts normalized hand landmarks from a webcam into stable, musically in-scale, click-free audio output with under 80 ms end-to-end latency. The engine consists of three layers working in concert:

- **Engine** (`src/engine/`): pure TypeScript functions for One Euro smoothing, gesture-to-control mapping, scale quantization with hysteresis, and tracking-lost handling. Zero runtime dependencies; fully property-testable in Node/Vitest.
- **Vision** (`src/vision/`): a thin MediaPipe HandLandmarker wrapper that produces normalized landmark coordinates and nothing else.
- **Audio** (`src/audio/`): a thin Tone.js wrapper that drives one lead synthesizer voice and a master limiter from engine output.

Everything described here is prerequisite infrastructure. LLM summon, accompaniment, MIDI output, recording, head tracking, and final haunted visuals are out of scope for this spec.

---

## Glossary

- **Engine**: The pure-TypeScript module at `src/engine/` that transforms normalized coordinates into audio-control signals. No DOM, Tone.js, or MediaPipe imports are permitted inside it.
- **Vision_Layer**: The thin wrapper at `src/vision/` that calls MediaPipe HandLandmarker and emits normalized landmarks to the Engine.
- **Audio_Layer**: The thin wrapper at `src/audio/` that reads engine output and drives the Tone.js lead voice and master limiter.
- **System**: The end-to-end pipeline from camera frame capture through audio output.
- **Frame_Loop**: The per-video-frame callback, driven by `requestVideoFrameCallback` (or `requestAnimationFrame` as fallback), that runs Vision_Layer → Engine → Audio_Layer in sequence.
- **Palm_Center**: The arithmetic mean of exactly five landmarks: wrist (index 0) and the four MCP (metacarpophalangeal) joints (indices 5, 9, 13, 17). Used as the primary control point because it is steadier than any single fingertip.
- **One_Euro_Filter**: An adaptive low-pass filter parameterized by `minCutoff` and `beta` that smooths a noisy scalar signal while minimizing lag on fast movements.
- **Scale**: An ordered set of MIDI pitch classes (e.g., D natural minor = `[2, 4, 5, 7, 9, 10, 0]`). The active Scale is set externally; the Engine defaults to D natural minor at 80 BPM when none is provided.
- **Quantizer**: The sub-function of the Engine that maps a continuous normalized x position to a MIDI note in the active Scale using equal-width zone division.
- **Hysteresis_Band**: The dead zone of width `hysteresisWidth` on either side of each zone boundary. While the smoothed x is within `hysteresisWidth` of a boundary (approaching from either direction), the current note is held. The note changes only when x crosses a boundary by more than `hysteresisWidth`. Valid range of `hysteresisWidth`: `[0, zoneWidth / 2)` where `zoneWidth = 1 / numNotes`.
- **maxGainDeltaPerFrame**: A configurable maximum allowed change in gain (0–1) between consecutive engine frames. Default: `0.25`. Valid range: `(0, 1]`. Click prevention is handled by the Audio_Layer ramp, not by this cap.
- **Tracking_Lost**: The state entered when `timestampMs - lastValidTimestampMs > 150`, where `lastValidTimestampMs` is the timestamp of the last frame that delivered valid Palm_Center coordinates. Frames with invalid or absent coordinates do not update `lastValidTimestampMs`.
- **Debug_Overlay**: A hidden UI layer (toggled with the `D` key) that displays real-time performance metrics.
- **MIDI_Note**: An integer in `[0, 127]` representing a chromatic pitch. Middle C = 60.
- **MIDI_Velocity**: An integer in `[0, 127]` representing note loudness.
- **Normalized_Coordinate**: A floating-point number in `[0, 1]` where 0 is the left/top edge and 1 is the right/bottom edge of the camera frame.
- **Play_Area**: The active region of the camera frame within which hand position is mapped to `[0, 1]`. Default: 10% inset on all edges, giving an active area of x ∈ [0.1, 0.9], y ∈ [0.1, 0.9]. Positions outside the Play_Area are clamped to its nearest edge before remapping.
- **Portamento**: The ramp time for oscillator frequency changes when the Quantizer selects a new note. Default: 30 ms. Valid range: `[0, 500]` ms. A value of 0 makes changes instantaneous. Independent of the gain ramp time.
- **HandMode**: The configurable hand selection mode for the Vision_Layer. Values: `"right"` | `"left"` | `"any"` (default `"any"`). In `"any"` mode, whichever hand is detected is used; two hands present → rightmost in mirrored display space. In `"right"` / `"left"` mode, MediaPipe's handedness label strings are mapped to the user's physical hands via a single named constant `HANDEDNESS_LABEL` in the Vision_Layer source. The correct mapping must be verified manually because it depends on whether MediaPipe receives a mirrored or unmirrored image.
- **EngineState**: The output object of the Engine step function, containing at minimum: `midiNote: number` (integer in [0, 127]), `midiVelocity: number` (`Math.round(gain × 127)`, clamped to `[0, 127]`, integer), `gain: number` (finite, in [0, 1]), `active: boolean` (`true` when tracking or during a single-frame glitch within the 150 ms window; `false` only in Tracking_Lost state, i.e., `timestampMs - lastValidTimestampMs > 150`). All numeric fields must be finite; MIDI fields must be integers in [0, 127] regardless of `active`.

---

## Requirements

### Requirement 1: Vision Layer — Normalized Landmark Extraction

**User Story:** As a player, I want the system to read my hand position from the webcam, so that I can control the instrument without touching anything.

#### Acceptance Criteria

1. WHEN the player clicks "Wake the spirits", THE Vision_Layer SHALL request a camera stream at 640×480 with `frameRate: { ideal: 60, min: 30 }`.
2. IF camera permission is denied or no camera device is available, THEN THE Vision_Layer SHALL emit an error signal and THE System SHALL display an accessible error message in the `aria-live="polite"` region.
3. WHEN a camera stream is active, THE Vision_Layer SHALL drive the Frame_Loop using `requestVideoFrameCallback`, falling back to `requestAnimationFrame` when `requestVideoFrameCallback` is unavailable.
4. WHEN a camera frame is received, THE Vision_Layer SHALL compute landmark detection within that same callback invocation so that no camera frame is dropped due to Vision_Layer scheduling.
5. WHEN MediaPipe detects one or more hands, THE Vision_Layer SHALL select the primary hand according to the active HandMode: in `"any"` mode (default), use the single detected hand, or the rightmost hand in mirrored display space when two hands are present; in `"right"` and `"left"` mode, THE Vision_Layer SHALL use a single named constant `HANDEDNESS_LABEL` (defined in one place in the Vision_Layer source) to map MediaPipe's handedness label string to the user's physical hand — this mapping MUST be verified manually (see criterion 6) because MediaPipe's label convention depends on whether the input image is mirrored, and the project passes an unmirrored frame to MediaPipe while mirroring only with CSS; THE Vision_Layer SHALL emit the Palm_Center of the selected hand as two Normalized_Coordinates `(x, y)` computed in mirrored coordinate space, and SHALL emit a tracking-lost signal when no hand matching the active HandMode is detected.
6. THE `HANDEDNESS_LABEL` mapping SHALL be verified manually before shipping: set HandMode to `"right"`, raise the right hand in front of the camera, and confirm that the system tracks it (not the left hand); if the mapping is inverted, update the single `HANDEDNESS_LABEL` constant; this criterion is not automated.
7. WHEN MediaPipe detects no hands in a frame, THE Vision_Layer SHALL emit `null` coordinates as a tracking-lost signal to the Engine.
8. WHERE the browser supports GPU acceleration, THE Vision_Layer SHALL run MediaPipe HandLandmarker in `VIDEO` running mode with GPU delegate enabled; IF GPU delegate is unavailable, THE Vision_Layer SHALL fall back to CPU delegate.
9. THE Vision_Layer SHALL mirror the camera image horizontally (CSS `scaleX(-1)`) before display so that moving the hand right in display space increases the x Normalized_Coordinate, and SHALL emit coordinates computed in that mirrored space.
10. THE Vision_Layer SHALL clamp all emitted Normalized_Coordinates to the range `[0.0, 1.0]` before passing them to the Engine.

---

### Requirement 2: Palm Center Calculation

**User Story:** As a player with tremor, I want the control point to be stable, so that small involuntary movements do not cause constant pitch changes.

#### Acceptance Criteria

1. WHEN MediaPipe returns hand landmarks, THE Vision_Layer SHALL compute Palm_Center as the arithmetic mean of exactly five landmarks with equal weight: wrist (index 0) and the four MCP joints (indices 5, 9, 13, 17).
2. THE Vision_Layer SHALL emit Palm_Center as a pair of Normalized_Coordinates, each clamped to the range `[0.0, 1.0]`, with no raw pixel values crossing the Vision_Layer boundary.
3. WHEN MediaPipe returns a hand detection, THE Vision_Layer SHALL accept that hand as valid only when the hand presence confidence score meets or exceeds `minHandPresenceConfidence` (default 0.5, configurable in `(0, 1]`); IF the score is below this threshold, THE Vision_Layer SHALL emit a tracking-lost signal instead of a Palm_Center coordinate.
4. WHILE a tracking-lost signal is active, THE Vision_Layer SHALL continue emitting tracking-lost signals on each subsequent frame until MediaPipe returns a complete and valid landmark set.

---

### Requirement 3: One Euro Smoothing

**User Story:** As a player with tremor, when my hand rests near one spot, I want the pitch to stay on one note instead of flickering, while fast intentional sweeps still track my hand tightly.

#### Acceptance Criteria

1. WHEN the Engine receives a Normalized_Coordinate sample, THE Engine SHALL pass it through the One_Euro_Filter for that axis before forwarding the smoothed value to the Quantizer or gain mapper.
2. THE Engine SHALL expose `minCutoff` and `beta` as configurable parameters of the One_Euro_Filter with documented defaults (`minCutoff = 1.0 Hz`, `beta = 0.007`) and valid ranges (`minCutoff` in `(0, 100]` Hz, `beta` in `[0, 10]`).
3. THE Engine SHALL maintain a separate One_Euro_Filter instance for the x axis and for the y axis, so that smoothing state does not bleed between axes.
4. FOR ALL finite sequences of Normalized_Coordinate inputs to a single One_Euro_Filter instance, THE filter output SHALL remain within the range `[min(inputs), max(inputs)]`. *(Property: smoothing stays in range — fast-check)*
5. IF the Engine receives a coordinate that is NaN, undefined, or outside `[0, 1]`, THEN THE Engine SHALL hold the last valid filter output unchanged and SHALL freeze filter state for that frame, so that stale state does not inject a pitch jump when tracking resumes.

---

### Requirement 4: Scale Quantization

**User Story:** As a player, when I move my right hand left or right, I want the pitch to change smoothly across about two octaves of the current scale, so that I always sound musical.

#### Acceptance Criteria

1. WHEN the Engine receives a smoothed x Normalized_Coordinate in `[0, 1]` (after play-area remapping), THE Quantizer SHALL divide the play area into equal-width zones — one zone per Scale note across the configured note range (default: D3–D5, MIDI notes 50–74, yielding 15 zones for D natural minor) — and SHALL return the Scale note whose zone contains the input x; zone boundaries are computed as `i / numNotes` for `i` in `1..numNotes-1`.
2. THE Quantizer SHALL only return a MIDI_Note whose pitch class is a member of the active Scale, for any x in `[0, 1]` and any Scale containing at least two distinct pitch classes. *(Property: in-scale — fast-check)*
3. THE Quantizer SHALL return `quantize(x1) ≤ quantize(x2)` for all pairs `x1 ≤ x2` in `[0, 1]` when no hysteresis hold is active on either evaluation. *(Property: monotonic — fast-check)*
4. THE Engine SHALL clamp every output MIDI_Note and MIDI_Velocity in EngineState to the integer range `[0, 127]`, regardless of the value of the `active` field. *(Property: valid MIDI — fast-check)*
5. IF the Engine receives an x Normalized_Coordinate that is NaN, undefined, or outside `[0, 1]`, THEN THE Engine SHALL treat that frame as a single-frame glitch: hold the last valid MIDI_Note, hold the last valid gain, and return EngineState with `active: true` (the 150 ms countdown has not expired, so tracking is not lost); the Engine SHALL NOT throw.

---

### Requirement 5: Hysteresis at Note Boundaries

**User Story:** As a player with tremor, when my hand rests near a note boundary, I want the pitch to stay on the current note instead of flickering between two adjacent notes, while fast sweeps still track my hand tightly.

#### Acceptance Criteria

1. WHEN the Quantizer has selected a MIDI_Note, THE Engine SHALL apply hysteresis on BOTH edges of the current note's zone: the current note changes only when the smoothed x Normalized_Coordinate moves past either zone boundary by more than `hysteresisWidth` into the adjacent zone. WHILE the coordinate stays within `hysteresisWidth` of a zone boundary (on either side), THE Engine SHALL keep the current note. WHEN the coordinate moves more than `hysteresisWidth` beyond a boundary, THE Engine SHALL immediately apply normal equal-width zone quantization to select the new note.
2. IF the Engine has no previously selected note (e.g., on startup), THEN THE Engine SHALL resolve to the equal-width zone containing the initial x coordinate, bypassing hysteresis for that first selection only.
3. THE Engine SHALL expose `hysteresisWidth` as a configurable parameter with a default of `0.015` and a valid range of `[0.0, zoneWidth / 2)` where `zoneWidth` is the width of one equal-width scale-note zone; values outside this range SHALL be clamped to the nearest bound.
4. FOR ANY sequence of x values that stays within ±`hysteresisWidth` of a single zone boundary, THE Engine SHALL change the selected note at most once across the entire sequence. *(Property: no flicker — fast-check)*

---

### Requirement 6: Volume Control

**User Story:** As a player, when I raise or lower my right hand, I want the volume to rise or fall without clicks or sudden jumps.

#### Acceptance Criteria

1. WHEN the Engine receives a smoothed y Normalized_Coordinate in `[0, 1]` (after play-area remapping), THE Engine SHALL map it to a gain value in `[0, 1]` using a linear inverse relationship, where y = 0.0 maps to gain 1.0 and y = 1.0 maps to gain 0.0.
2. IF the smoothed y Normalized_Coordinate is NaN, undefined, or outside `[0, 1]`, THEN THE Engine SHALL hold the last valid gain value unchanged and SHALL NOT update gain until a valid coordinate is received.
3. WHEN the Engine computes a new gain value, THE Engine SHALL clamp the absolute delta from the previous gain so that it does not exceed `maxGainDeltaPerFrame`, where `maxGainDeltaPerFrame` is a configurable value in the range `(0, 1]` with a default of `0.25`; audible-click prevention is the responsibility of the Audio_Layer ramp, not this cap. *(Property: bounded gain change — fast-check)*
4. WHEN the Audio_Layer receives a new gain value, THE Audio_Layer SHALL apply it using a ramp of 10–30 ms via Tone.js `rampTo` or `setTargetAtTime`, and SHALL NOT write gain directly, to prevent audible clicks.
5. THE Audio_Layer SHALL route the lead voice through a master limiter set to a ceiling of -1 dBFS before the output stage, and SHALL apply a default master volume of -6 dB (configurable).

---

### Requirement 7: Tracking-Lost Handling

**User Story:** As a player, when my hand leaves the camera view, I want the sound to fade to silence, and resume smoothly when my hand returns.

#### Acceptance Criteria

1. THE Engine step function SHALL accept `timestampMs: number` as an explicit input parameter (keeping the Engine pure and testable without a real clock). THE Engine SHALL track `lastValidTimestampMs`, updated to `timestampMs` on every frame that delivers valid coordinates. WHEN `timestampMs - lastValidTimestampMs > 150`, THE Engine SHALL enter Tracking_Lost state and SHALL begin ramping gain to 0. Frames with invalid or absent coordinates do NOT update `lastValidTimestampMs`. On the very first frame before any valid coordinate has been received, `lastValidTimestampMs` is initialised to `timestampMs` so the countdown does not fire immediately.
2. WHILE in Tracking_Lost state, THE Audio_Layer SHALL complete the gain ramp to 0 within 200 ms of the state being entered.
3. WHEN valid landmark coordinates resume after Tracking_Lost, THE Engine SHALL exit Tracking_Lost state, SHALL reset the One_Euro_Filter instances to the first new valid sample (discarding frozen state), and SHALL complete a gain ramp from 0 to the target gain within 100 ms, without an audible click.
4. IF any input coordinate is NaN, undefined, or outside `[0, 1]` on a single frame within the 150 ms window, THEN THE Engine SHALL treat that frame as a single-frame glitch: hold the last valid state, return `active: true`, and SHALL NOT throw an exception. `active` becomes `false` only when Tracking_Lost state is entered (i.e., `timestampMs - lastValidTimestampMs > 150`).
5. FOR ALL arbitrary inputs (including NaN, Infinity, negative numbers, and undefined), THE Engine step function SHALL return a valid EngineState object — defined as: no exception thrown, all numeric fields are finite, all MIDI fields are integers in `[0, 127]`, and `active` is a boolean. *(Property: never throws — fast-check)*

---

### Requirement 8: Frame Loop Integrity and Latency

**User Story:** As a developer, I want the system to run detection on every camera frame and stay under 80 ms end-to-end, so that the instrument feels physically attached to the hand.

#### Acceptance Criteria

1. WHILE the camera delivers N frames per second, THE System SHALL invoke Vision_Layer landmark detection once per delivered frame; IF a detection call is still in progress when the next frame arrives, THEN THE System SHALL process the newest frame and record the skipped frame as a Vision_Layer overrun, not a Frame_Loop drop.
2. THE System SHOULD achieve a total end-to-end latency of no more than 80 ms, measured from the timestamp of the first video frame containing a new hand gesture to the onset of the corresponding audible audio output; this target is verified manually using slow-motion video of the hand and audio onset, not by automated test.
3. THE Frame_Loop SHALL NOT trigger a React re-render cycle as a result of pitch or gain value changes; live pitch and gain values SHALL be readable by the audio and visual subsystems without causing component re-renders.
4. WHEN on-screen readouts of pitch or gain must be updated, THE System SHALL throttle those updates to at most 10 times per second.
5. THE Engine step function SHALL reuse a single pre-allocated output object per call and SHALL NOT allocate new objects or arrays during the code path from engine input ingestion to output object population.

---

### Requirement 9: Low-FPS Warning

**User Story:** As a player, when the camera frame rate drops, I want a gentle hint so I know why the instrument feels sluggish.

#### Acceptance Criteria

1. WHEN the measured camera FPS, calculated as a rolling average over the last 2 seconds, drops below 24, THE System SHALL display the message "The spirits need more light" in an accessible `aria-live="polite"` region.
2. WHEN the measured camera FPS rolling average recovers to 26 or above, THE System SHALL clear the low-FPS warning message.

---

### Requirement 10: Debug Overlay

**User Story:** As a developer, I can see live latency numbers in a debug overlay so I can diagnose performance regressions.

#### Acceptance Criteria

1. THE Debug_Overlay SHALL be hidden by default and SHALL toggle on/off when the player presses the `D` key while no text input element has focus.
2. WHEN the Debug_Overlay is visible, THE System SHALL display the following metrics refreshed at a rate between 1 and 10 times per second: camera FPS, camera resolution, detection FPS, vision processing time (ms), per-frame processing time (ms), audio output latency (ms), and estimated end-to-end latency (ms); estimated latency is computed as `avgFrameIntervalMs + visionMs + processingMs + (AudioContext.baseLatency + AudioContext.outputLatency) × 1000` and is labeled "excludes camera capture"; metrics not yet available SHALL display as `--`.
3. THE System SHALL measure per-frame processing time using `performance.mark("proc-start")` immediately after Vision_Layer frame receipt and `performance.mark("proc-end")` immediately after the Audio_Layer parameter update completes.
4. THE System SHALL estimate end-to-end latency as `avgFrameIntervalMs + visionMs + processingMs + (AudioContext.baseLatency + AudioContext.outputLatency) × 1000`, labeled "excludes camera capture" in the Debug_Overlay.

---

### Requirement 11: Engine Purity and Zero Dependencies

**User Story:** As a developer, I want the engine to be fully testable in Node/Vitest without a browser, so that property-based tests can run reliably in CI.

#### Acceptance Criteria

1. THE Engine SHALL contain no imports from browser-specific globals or APIs, including but not limited to: `window`, `document`, `navigator`, `HTMLElement`, `Worker`, `AudioContext`, `MediaStream`, or any Web API absent in a standard Node.js environment.
2. THE Engine SHALL have zero runtime npm dependencies — it SHALL be compilable as a standalone TypeScript module.
3. THE Engine SHALL expose all public functions with explicit TypeScript parameter and return types.
4. WHEN any Engine function is imported in a Vitest test environment with no browser globals, THE Engine SHALL load and execute without thrown exceptions or unhandled promise rejections.

---

### Requirement 12: Minimal Playable Page

**User Story:** As a player, I want to open a URL, allow the camera, and be making music within 30 seconds, so that there is zero setup friction.

#### Acceptance Criteria

1. THE System SHALL render a page containing: a mirrored webcam feed (CSS `scaleX(-1)`), a "Wake the spirits" start button, and the Debug_Overlay (hidden by default).
2. WHEN the player clicks "Wake the spirits", THE System SHALL request camera permission, initialize MediaPipe, create the Tone.js AudioContext, and begin the Frame_Loop — all within one user gesture; the AudioContext (or `Tone.start()` call) MUST be invoked synchronously inside the click handler, before any `await` expression, to satisfy the browser autoplay policy; THE System SHALL complete full initialization within 30 seconds; IF initialization exceeds 30 seconds, THE System SHALL display an accessible timeout error message.
3. THE AudioContext SHALL be created with `latencyHint: "interactive"` and Tone.js `context.lookAhead` SHALL be set to no more than 0.01 s.
4. IF camera permission is denied, THEN THE System SHALL display an accessible message in the `aria-live="polite"` region explaining that camera access is required and inviting the player to try again.
5. IF the camera device is unavailable (e.g., in use by another application), THEN THE System SHALL display a distinct accessible message in the `aria-live="polite"` region explaining the device conflict.

---

### Requirement 13: Play Area

**User Story:** As a player, I want the instrument to respond to my hand across a well-defined central region of the camera frame, so that accidental edge positions do not jump the pitch or volume to an extreme.

#### Acceptance Criteria

1. THE Engine SHALL define a configurable Play_Area as an inset rectangle within the `[0, 1]` × `[0, 1]` normalized frame, specified by four inset fractions (top, right, bottom, left), with a default of 10% on every edge (active area: x ∈ [0.1, 0.9], y ∈ [0.1, 0.9]).
2. WHEN the Engine receives a Palm_Center Normalized_Coordinate, THE Engine SHALL remap it from the Play_Area rectangle to `[0, 1]` before passing it to the Quantizer and gain mapper; positions outside the Play_Area SHALL be clamped to the nearest Play_Area edge before remapping.
3. THE Engine SHALL expose the four Play_Area inset fractions as configurable parameters; each inset fraction SHALL be in the range `[0, 0.49]` and the opposing pair of insets (left + right, top + bottom) SHALL sum to less than 1.0; values violating these constraints SHALL be rejected with an error at configuration time.
4. WHEN Play_Area insets are set to zero on all edges, THE remapping SHALL be an identity operation, passing Normalized_Coordinates through unchanged. *(Property: zero inset is identity — fast-check)*

---

### Requirement 14: Portamento

**User Story:** As a player, I want note changes to glide rather than jump, so that the instrument sounds like a theremin instead of a keyboard.

#### Acceptance Criteria

1. WHEN the Quantizer selects a new MIDI_Note that differs from the previously selected note, THE Audio_Layer SHALL ramp the oscillator frequency to the frequency corresponding to the new MIDI_Note over the configured portamento time, using a Tone.js frequency ramp (`portamento` or equivalent `rampTo` on the oscillator frequency parameter).
2. THE Audio_Layer SHALL expose `portamentoMs` as a configurable parameter with a default of `30` ms and a valid range of `[0, 500]` ms; when `portamentoMs` is 0, frequency changes SHALL be instantaneous.
3. THE portamento ramp time is independent of the gain ramp time configured in Requirement 6; changing the gain ramp time SHALL NOT affect the portamento time and vice versa.
4. WHILE Tracking_Lost state is active, THE Audio_Layer SHALL NOT initiate a new portamento ramp; WHEN tracking resumes and the first new MIDI_Note is selected, THE Audio_Layer SHALL set the oscillator frequency directly (no portamento ramp) for that first note, then resume normal portamento for subsequent note changes.
