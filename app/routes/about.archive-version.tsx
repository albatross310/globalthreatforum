import { data, Link } from "react-router";
import type { Route } from "./+types/about.archive-version";
import { createSupabase } from "../lib/supabase.server";
import { renderPostHtml } from "../lib/render.server";

export function meta() {
  return [{ title: "Archived about version — Global Threat Forum" }];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabase(request);
  const { data: version } = await supabase
    .from("about_versions")
    .select("id, content, created_at")
    .eq("id", params.id)
    .single();

  if (!version) throw data("Version not found", { status: 404 });

  return data(
    { html: renderPostHtml(version.content), createdAt: version.created_at },
    { headers }
  );
}

export default function AboutArchiveVersion({ loaderData }: Route.ComponentProps) {
  const { html, createdAt } = loaderData;

  return (
    <article>
      <Link
        to="/about/archive"
        className="text-sm text-slate-600 hover:text-violet-950"
      >
        ← All versions
      </Link>

      <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        Archived version from <strong>{formatDate(createdAt)}</strong> — this may
        not reflect the current About page.
      </div>

      <div
        className="prose prose-slate mt-6 max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}
