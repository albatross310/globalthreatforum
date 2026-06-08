import { data } from "react-router";
import type { Route } from "./+types/api.upload";
import { createSupabase } from "../lib/supabase.server";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabase(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw data("Unauthorized", { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw data("No file provided", { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw data("Unsupported image type", { status: 415 });
  }
  if (file.size > MAX_SIZE) {
    throw data("Image too large (max 5 MB)", { status: 413 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  // Storage RLS requires the first folder segment to be the user's id.
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("post-images")
    .upload(path, file, { contentType: file.type });
  if (error) {
    throw data(`Upload failed: ${error.message}`, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("post-images").getPublicUrl(path);

  return data({ url: publicUrl }, { headers });
}
