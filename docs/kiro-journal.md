# Kiro build journal

> Log how Kiro was used as you build. This becomes the source for the Devpost
> "How we used Kiro" write-up and the blog post. Keep entries short; add
> screenshots to `docs/journal-img/`.

## Template
### YYYY-MM-DD: <what you worked on>
- **Kiro feature used:** (spec / vibe / steering / hook / MCP / PBT / power / custom agent)
- **Model:** (Auto / Claude Sonnet / ...)
- **What I asked:**
- **What Kiro did well:**
- **What I had to correct (and how I changed steering/spec so it doesn't happen again):**
- **Bug or insight caught by PBT / hooks:**

---

## Entries

### 2026-11-03: Project scaffold

- **Kiro feature used:** vibe / steering
- **Model:** Auto
- **What I asked:** Scaffold the full project from the tech.md steering spec — Vite + React + TypeScript strict, Vitest, fast-check, Playwright, ESLint, folder layout, npm scripts.
- **What Kiro did well:** Generated all config files (tsconfig, vite, vitest, eslint, playwright), placeholder index files for every layer, and the correct npm scripts in one pass. Typecheck and tests both passed clean on first run.
- **What I had to correct:** Nothing yet.
- **Bug or insight caught by PBT / hooks:** N/A — placeholder only.

#### Dependencies added in this session

| Package | Type | Reason |
|---|---|---|
| `react` `react-dom` | prod | UI shell (React) per tech spec |
| `zod` | prod | Schema validation for LLM JSON response (client + server) per tech spec |
| `@vitejs/plugin-react` | dev | Vite React transform per tech spec |
| `vite` | dev | Build tool per tech spec |
| `typescript` | dev | Strict TypeScript per tech spec |
| `vitest` | dev | Unit test runner per tech spec |
| `fast-check` | dev | Property-based tests per tech spec |
| `@playwright/test` | dev | End-to-end smoke tests per tech spec |
| `eslint` `typescript-eslint` `@eslint/js` `globals` | dev | Linting per tech spec |
| `eslint-plugin-react-hooks` `eslint-plugin-react-refresh` | dev | React-specific lint rules |
| `@types/react` `@types/react-dom` | dev | TypeScript types for React |
### 2026-11-03: Latency spike + first hook
- **Kiro feature used:** vibe coding (spike), agent hook (Stop)
- **Model:** Auto
- **What I asked:** a throwaway latency proof of concept (webcam → MediaPipe → Tone.js)
- **What Kiro did well:** working hand tracking on the first try; vision 8 ms, processing 0.14 ms
- **What I had to correct:** the generated code had a nested-quote syntax error that broke the dev server.
  I added a "Stop check" hook so Kiro runs typecheck, lint and tests before finishing and fixes failures itself.
- **Insight:** camera FPS (20) is the real latency bottleneck, not our code.