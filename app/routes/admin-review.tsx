import { data, Link } from "react-router";
import type { Route } from "./+types/admin-review";
import { createSupabase, requireAdmin } from "../lib/supabase.server";

export function meta() {
  return [{ title: "Review queue — Global Threat Forum" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabase(request);
  await requireAdmin(supabase, request);

  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, excerpt, updated_at, profiles ( username )")
    .eq("status", "pending_review")
    .order("updated_at", { ascending: true });

  return data({ posts: posts ?? [] }, { headers });
}

export default function AdminReview({ loaderData }: Route.ComponentProps) {
  const { posts } = loaderData;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Review queue</h1>
      <p className="mt-1 text-sm text-slate-500">
        Posts awaiting moderation, oldest first.
      </p>

      {posts.length === 0 ? (
        <p className="mt-8 text-slate-500">Queue is empty. 🎉</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {posts.map((post: any) => (
            <li
              key={post.id}
              className="rounded-lg border border-slate-800 bg-slate-900/50 p-4"
            >
              <Link
                to={`/admin/review/${post.id}`}
                className="font-medium text-white hover:text-emerald-400"
              >
                {post.title}
              </Link>
              <p className="mt-1 line-clamp-2 text-sm text-slate-400">
                {post.excerpt}
              </p>
              <p className="mt-2 text-xs text-slate-600">
                by {post.profiles?.username ?? "unknown"} · submitted{" "}
                {new Date(post.updated_at).toLocaleString("en-GB")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
