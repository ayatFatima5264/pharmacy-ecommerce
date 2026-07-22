/**
 * Side-effect import: loads .env.local into process.env for CLI scripts.
 * (Next.js does this for the app; plain tsx scripts need it done explicitly.)
 * Import FIRST in any script that talks to Supabase or Resend.
 */
try {
  process.loadEnvFile('.env.local')
} catch {
  // No .env.local — scripts will report missing configuration themselves.
}
