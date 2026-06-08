import { data } from "react-router";
import type { Route } from "./+types/api.timestamp";
import { createSupabase } from "../lib/supabase.server";
import { proofBytes } from "../lib/ots.server";

// Serves the OpenTimestamps proof for a published post as a downloadable .ots
// file, so anyone can verify it independently (opentimestamps.org or the CLI).
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
