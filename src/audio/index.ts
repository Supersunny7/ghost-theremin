// Audio layer: Tone.js synth voices, accompaniment, MIDI output, recorder.
//
// Rules enforced here:
//   - AudioContext created with latencyHint: "interactive" and only after a
//     user gesture (browser autoplay policy).
//   - Tone.js context.lookAhead kept ~0.01 s for live play.
//   - Frequency and gain changes use short ramps (~10–30 ms); never set raw
//     per-frame to avoid audible clicks.
//   - Master output passes through a Limiter; gain delta is capped per frame.
export {};
