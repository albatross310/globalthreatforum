import { data } from "react-router";
import type { Route } from "./+types/api.timestamp";
import { createSupabase } from "../lib/supabase.server";
import { proofBytes } from "../lib/ots.server";

// Serves the OpenTimestamps proof for a published post as a downloadable .ots
// file. Anyone can confirm the proof anchors the post's SHA-256 content hash to
// Bitcoin — e.g. `ots verify -d <hash> <slug>.ots`, where <hash> is shown on
// the post page. (That proves the hash existed by the block time; rebuilding the
// hash from the post content also needs the canonical preimage in hash.server.ts.)
export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase } = createSupabase(request);
  const { data: post } = await supabase
    .from("posts")
    .select("slug, ots_proof, status")
    .eq("slug", params.slug)
    .eq("status", "published")
    .single();

  if (!post?.ots_proof) {
    throw data("No timestamp proof available for this post.", { status: 404 });
  }

  // Node's Response accepts the byte array; cast past the strict DOM BodyInit type.
  return new Response(proofBytes(post.ots_proof) as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${post.slug}.ots"`,
    },
  });
}
