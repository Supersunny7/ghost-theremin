// Property-based tests for src/engine, run via `npm run test:pbt`.
// Uses fast-check to generate arbitrary inputs and assert invariants that must
// hold for all valid (and invalid) inputs — e.g. MIDI output always in 0..127,
// out-of-range coordinates are treated as tracking-lost, etc.
import { describe, it } from "vitest";
import * as fc from "fast-check";

describe("engine properties (placeholder)", () => {
  it("fast-check is importable and runnable", () => {
    // Trivial property: for all numbers, x === x.
    // Replace with real engine invariants as functions are added.
    fc.assert(fc.property(fc.integer(), (n) => n === n));
  });
});
