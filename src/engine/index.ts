// Engine layer: pure TypeScript only.
// No DOM, no Tone.js, no MediaPipe imports are allowed here — this module
// must remain importable in a Node/Vitest environment with no browser globals,
// so that every function can be property-tested with fast-check.
//
// Responsibilities:
//   - Landmark smoothing (One Euro Filter)
//   - Gesture → control mapping (normalized [0,1] coords → pitch/volume/etc.)
//   - Scale quantization (map continuous pitch to nearest scale degree)
//   - Hysteresis at scale-note boundaries
//   - Tracking-lost detection (no update for > 150 ms → signal fade)
//
// All public functions carry explicit TypeScript types.
export {};
