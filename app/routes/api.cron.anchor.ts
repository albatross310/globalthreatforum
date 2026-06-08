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
  const summary = { stamped: 0, confirmed: 0, errors: 0 };

  function hourIso(unixSeconds?: number) {
    const d = unixSeconds ? new Date(unixSeconds * 1000) : new Date();
    d.setMinutes(0, 0, 0);
    return d.toISOString();
  }

  // 1. Stamp the overnight queue.
  const { data: queued } = await db
    .from("posts")
    .select("id, content_hash")
    .eq("ots_status", "queued")
    .not("content_hash", "is", null)
    .limit(25);

  for (const p of queued ?? []) {
    try {
      const proof = await stampHash(p.content_hash);
      await db
        .from("posts")
        .update({
          ots_status: "pending",
          ots_proof: proof,
          anchored_at: hourIso(),
        })
        .eq("id", p.id);
      summary.stamped++;
    } catch {
      summary.errors++;
    }
  }

  // 2. Upgrade pending proofs that Bitcoin has now confirmed.
  const { data: pending } = await db
    .from("posts")
    .select("id, content_hash, ots_proof")
    .eq("ots_status", "pending")
    .not("ots_proof", "is", null)
    .limit(50);

  for (const p of pending ?? []) {
    try {
      const res = await upgradeProof(p.ots_proof, p.content_hash);
      if (res.changed) {
        await db
          .from("posts")
          .update({
            ots_status: "confirmed",
            ots_proof: res.proofB64,
            anchored_at: hourIso(res.attestedUnix ?? undefined),
          })
          .eq("id", p.id);
        summary.confirmed++;
      }
    } catch {
      summary.errors++;
    }
  }

  return Response.json(summary);
}
