// Summon layer: client for api/summon, zod schemas, fallback scales.
//
// The LLM response is validated against a zod schema on the client side.
// On any parse or validation failure we silently fall back to the default
// scale (D natural minor, 80 BPM) and surface a gentle in-character message
// via the aria-live announcer — we never crash or show a raw error.
//
// API keys never appear here; they live only in the serverless function's
// environment variables.
export {};
