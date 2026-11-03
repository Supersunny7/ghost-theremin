// Serverless function: receives a user prompt and returns a scale/tempo JSON
// object validated by the shared zod schema.
//
// The LLM API key is read from the environment variable LLM_API_KEY and is
// never exposed to the browser.  The function returns strict JSON; the client
// falls back to the default scale on any validation failure.
//
// Deployed as a Vercel Edge Function or Node.js function at /api/summon.
export {};
