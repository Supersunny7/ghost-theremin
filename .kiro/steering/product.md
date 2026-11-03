---
inclusion: always
---

# Product: Ghost Theremin

## One-liner
A haunted, browser-based instrument you play by waving at your webcam. It stitches together a 1920s theremin, the 1983 MIDI protocol, real-time computer vision, and an LLM so that **every gesture sounds good**.

## Who it is for
1. **Primary:** people with limited hand dexterity or grip (stroke rehab, cerebral palsy, ALS, hand injuries) who cannot hold or press a traditional instrument.
2. **Professional users:** music therapists and special-education teachers who need a zero-install, zero-hardware tool they can open in a session.
3. **Secondary:** curious beginners who want to make something musical in seconds.

## Core promise
- Open a URL, allow the camera, and make music within 30 seconds. No install, no login, no extra hardware.
- Notes snap to a musical scale chosen by the "summon" step, so it is very hard to sound bad.

## Product principles (follow these when making trade-offs)
1. **Latency is the product.** If it does not feel attached to the hand, nothing else matters.
2. **Accessibility is the default, not a hidden mode.** One-hand and head-tracking play are first-class.
3. **Spooky design must carry information.** Every haunted visual maps to a function:
   - ectoplasm trail color = current pitch
   - candle flame size = current volume
   - glowing rune pillars = snap-to positions of scale notes
   - "spirit has arrived" animation = LLM summon finished
4. **Privacy:** camera frames never leave the device. Only the user's short text prompt is sent to the LLM.
5. **Graceful failure:** lost tracking fades to silence; LLM failure falls back to a default scale. Never crash, never blast sound.

## Hackathon context
- Kiroween 2026, **Frankenstein** category. The demo must make clear which "incompatible" technologies are stitched together.
- Judged equally on Impact, Technical Implementation (use of Kiro), Design, Innovation, Presentation.
- All user-facing text and docs in English.

## Out of scope (do not build unless asked)
- Accounts, login, databases, payments.
- Mobile-native apps. (Responsive web is fine; desktop Chrome is the primary target.)
- Uploading or storing camera video anywhere.
