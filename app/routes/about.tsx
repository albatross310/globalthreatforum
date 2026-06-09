import { data, Link } from "react-router";
import type { Route } from "./+types/about";
import { createSupabase, getSessionUser } from "../lib/supabase.server";
import { renderPostHtml } from "../lib/render.server";

export function meta() {
  return [
    { title: "About — Global Threat Forum" },
    {
      name: "description",
      content: "About Global Threat Forum and its mission.",
    },
  ];
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabase(request);
  const user = await getSessionUser(supabase);

  const { data: versions, count } = await supabase
    .from("about_versions")
    .select("id, content, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(1);

  const current = versions?.[0] ?? null;
  return data(
    {
      isAdmin: user?.role === "admin",
      versionCount: count ?? 0,
      html: current ? renderPostHtml(current.content) : null,
      updatedAt: current?.created_at ?? null,
    },
    { headers }
  );
}

export default function About({ loaderData }: Route.ComponentProps) {
  const { isAdmin, versionCount, html, updatedAt } = loaderData;

  return (
    <article>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-violet-950">
          About
        </h1>
        {isAdmin && (
          <Link
            to="/about/edit"
            className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            Edit about page
          </Link>
        )}
      </div>

      {html ? (
        <>
          <div
            className="prose prose-slate mt-6 max-w-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-stone-200 pt-4 text-xs text-slate-600">
            {updatedAt && <span>Last updated {formatDate(updatedAt)}.</span>}
            {versionCount > 1 && (
              <Link to="/about/archive" className="text-violet-700 hover:underline">
                View {versionCount - 1} earlier version
                {versionCount - 1 === 1 ? "" : "s"}
              </Link>
            )}
          </div>
        </>
      ) : (
        <p className="mt-6 text-slate-600">
          There's no about page yet.{" "}
          {isAdmin && (
            <Link to="/about/edit" className="text-violet-700 hover:underline">
              Write the first version
            </Link>
          )}
        </p>
      )}
    </article>
  );
}
