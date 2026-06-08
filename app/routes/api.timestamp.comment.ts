import { data } from "react-router";
import type { Route } from "./+types/api.timestamp.comment";
import { createSupabase } from "../lib/supabase.server";
import { proofBytes } from "../lib/ots.server";

// Serves a comment's OpenTimestamps proof as a downloadable .ots file.
export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase } = createSupabase(request);
  const { data: comment } = await supabase
    .from("comments")
    .select("id, ots_proof")
    .eq("id", params.id)
    .single();

  if (!comment?.ots_proof) {
    throw data("No timestamp proof available for this comment.", { status: 404 });
  }

  return new Response(proofBytes(comment.ots_proof) as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="comment-${comment.id}.ots"`,
    },
  });
}
