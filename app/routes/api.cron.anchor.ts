import { data } from "react-router";
import type { Route } from "./+types/api.cron.anchor";
import { createServiceClient } from "../lib/supabase.server";
import { stampHash, upgradeProof } from "../lib/ots.server";

// Daily 8am job (Vercel Cron). Stamps overnight-queued submissions to
// OpenTimestamps, and upgrades pending proofs once Bitcoin has confirmed them.
// Protected by CRON_SECRET — Vercel sends it as a Bearer token automatically.
export async function loader({ request }: Route.LoaderArgs) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    throw data("Unauthorized", { status: 401 });
  }

  const db = createServiceClient();
  const summary = {
    stamped: 0,
    confirmed: 0,
    errors: 0,
    notes: [] as string[],
  };

  // Bitcoin block time, rounded down to the hour (kept coarse like posted_at).
  function blockHourIso(unixSeconds: number) {
    const d = new Date(unixSeconds * 1000);
    d.setMinutes(0, 0, 0);
    return d.toISOString();
  }

  // Posts and comments share the same anchoring columns, so process both tables.
  for (const table of ["posts", "comments"] as const) {
    // 1. Stamp the overnight queue.
    const { data: queued, error: qErr } = await db
      .from(table)
      .select("id, content_hash")
      .eq("ots_status", "queued")
      .not("content_hash", "is", null)
      .limit(25);
    if (qErr) summary.notes.push(`${table} queued query: ${qErr.message}`);

    for (const row of queued ?? []) {
      try {
        const proof = await stampHash(row.content_hash);
        const { error: uErr } = await db
          .from(table)
          .update({
            ots_status: "pending",
            ots_proof: proof,
            // Filled with the block time only once Bitcoin confirms it.
            anchored_at: null,
          })
          .eq("id", row.id);
        if (uErr) {
          summary.notes.push(`${table} stamp update: ${uErr.message}`);
          summary.errors++;
        } else {
          summary.stamped++;
        }
      } catch (e) {
        summary.notes.push(`${table} stamp: ${(e as Error).message}`);
        summary.errors++;
      }
    }

    // 2. Upgrade pending proofs that Bitcoin has now confirmed.
    const { data: pending, error: pErr } = await db
      .from(table)
      .select("id, content_hash, ots_proof")
      .eq("ots_status", "pending")
      .not("ots_proof", "is", null)
      .limit(50);
    if (pErr) summary.notes.push(`${table} pending query: ${pErr.message}`);

    for (const row of pending ?? []) {
      try {
        const res = await upgradeProof(row.ots_proof, row.content_hash);
        if (res.changed) {
          await db
            .from(table)
            .update({
              ots_status: "confirmed",
              ots_proof: res.proofB64,
              // Record the true block time; never substitute the run time (it
              // would overstate how tightly the content is anchored).
              anchored_at: res.attestedUnix ? blockHourIso(res.attestedUnix) : null,
            })
            .eq("id", row.id);
          summary.confirmed++;
        }
      } catch {
        summary.errors++;
      }
    }
  }

  return Response.json(summary);
}
