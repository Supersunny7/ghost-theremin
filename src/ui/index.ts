// UI layer: React components, haunted visuals, settings panel.
//
// Visual design rules enforced here:
//   - Every haunted visual maps to a function (ectoplasm color = pitch,
//     candle flame size = volume, rune pillars = scale snap positions).
//   - prefers-reduced-motion and the manual "Calm spirits" toggle both replace
//     particles/flicker with static glows.
//   - Nothing flashes more than 3 times per second (WCAG 2.3.1).
//   - All interactive controls have a minimum 44×44 px hit target.
//   - Text contrast meets 4.5:1 against the dark theme.
export { App } from "./App.tsx";
