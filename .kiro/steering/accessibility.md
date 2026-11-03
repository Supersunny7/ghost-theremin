---
inclusion: fileMatch
fileMatchPattern: ["src/ui/**", "**/*.css", "index.html"]
---

# Accessibility and haunted-UI rules

Target: WCAG 2.1 AA. Accessibility is a core feature of this product, not polish.

## Input
- Every control must be operable by keyboard alone, with a visible focus ring that fits the haunted theme.
- Play modes: two-hand, one-hand (left or right), and head-tracking. Switching modes is one click or one key.
- Sensitivity and play-area size are adjustable with large sliders. Settings persist only in memory unless the user opts in.
- Large hit targets: at least 44×44 px.

## Motion and flashing
- Respect `prefers-reduced-motion`: replace particles and flicker with calm, static glows.
- Provide a manual "Calm spirits" toggle that does the same.
- Nothing may flash more than 3 times per second (WCAG 2.3.1). Candle flicker must stay below that.

## Feedback
- Use an `aria-live="polite"` region to announce state changes in plain words, such as "Spirit summoned: D minor, 80 BPM", "Hand lost", "Recording started".
- Visual meaning must not rely on color alone. Pair pitch color with position or a label.
- Text contrast on the dark theme must meet 4.5:1.

## Tone of copy
- Haunted but kind and clear: "The spirits lost sight of your hand. Raise it back into the light." Never mock or frighten the user in error states.
