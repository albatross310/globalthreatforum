// Verifies your Supabase connection and that the migration has run.
// Usage: pnpm check
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

if (!url || url.includes("your-project-ref")) {
  fail("SUPABASE_URL is missing or still the placeholder. Edit .env.");
}
if (!key || key.includes("your-anon")) {
  fail("SUPABASE_ANON_KEY is missing or still the placeholder. Edit .env.");
}

console.log(`\n→ Connecting to ${url} ...`);
const supabase = createClient(url, key, {
  realtime: { transport: ws }, // Node < 22 has no native WebSocket
});

// 1. Can we reach the project at all?
const { error: authError } = await supabase.auth.getSession();
if (authError) fail(`Auth endpoint unreachable: ${authError.message}`);
console.log("✓ Reached the project and the Auth API.");

// 2. Has the migration run? (selecting from posts should succeed, even if empty)
const { error: postsError } = await supabase
  .from("posts")
  .select("id")
  .limit(1);

if (postsError) {
  if (/relation .*posts.* does not exist|schema cache/i.test(postsError.message)) {
    fail(
      "Connected, but the 'posts' table doesn't exist yet.\n" +
        "   → Run supabase/migrations/0001_init.sql in the Supabase SQL editor."
    );
  }
  fail(`Query failed: ${postsError.message}`);
}

console.log("✓ The 'posts' table exists — migration has run.");
console.log("\n✅ Everything is connected. Run `pnpm dev` and you're live.\n");
