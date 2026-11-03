---
inclusion: always
---

# Tech stack and conventions

## Stack
- **Build:** Vite + TypeScript (strict mode) + React for UI chrome.
- **Vision:** `@mediapipe/tasks-vision` (HandLandmarker; FaceLandmarker for head-tracking mode). Runs fully in the browser.
- **Audio:** Tone.js on top of WebAudio. Web MIDI API for optional MIDI out.
- **Visuals:** Canvas 2D or WebGL for the ectoplasm/particle layer, drawn over the mirrored video.
- **LLM "summon":** one small serverless function at `api/summon.ts` that calls the LLM and returns strict JSON. Validate with `zod` on both server and client.
- **Tests:** Vitest for unit tests, `fast-check` for property-based tests, Playwright for end-to-end smoke tests.
- **Deploy:** Vercel (static site + one function).

## Folder layout
```
src/
  vision/   # MediaPipe wrappers; produces normalized landmarks only
  engine/   # PURE functions: smoothing, gesture->control mapping, scale quantization, hysteresis
  audio/    # Tone.js synth voices, accompaniment, MIDI output, recorder
  summon/   # client for api/summon, zod schemas, fallback scales
  ui/       # React components, haunted visuals, settings panel
api/
  summon.ts
tests/
  engine/   # unit + property-based tests
  e2e/
```

## Hard rules
- `src/engine/` must be **pure TypeScript with no DOM, no Tone.js, no MediaPipe imports**, so it can be property-tested.
- All coordinates entering the engine are normalized to `[0, 1]`. Treat `NaN`, `undefined`, or out-of-range values as "tracking lost".
- MIDI note and velocity values must be integers clamped to `0..127`.
- **Never put API keys in frontend code.** The LLM key lives only in the serverless function's environment variables.
- The LLM must return JSON matching the zod schema. On parse or validation failure, use the default scale (D natural minor, 80 BPM) and show a gentle in-character message.
- Do not add a new dependency without stating why in the chat and in `docs/kiro-journal.md`.

## Commands
- `npm run dev`: local dev server
- `npm run test`: all Vitest tests
- `npm run test:pbt`: property-based tests only (`tests/engine/**/*.pbt.test.ts`)
- `npm run lint` / `npm run typecheck`
- `npm run e2e`: Playwright smoke tests

## Style
- Small modules, named exports, no default exports.
- Prefer explicit types for public functions in `src/engine/`.
- Comments explain *why*, not *what*.
