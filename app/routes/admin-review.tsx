import { data, Link } from "react-router";
import type { Route } from "./+types/admin-review";
import { createSupabase, requireAdmin } from "../lib/supabase.server";
import { postedString } from "../lib/posted-time";

export function meta() {
  return [{ title: "Review queue — Global Threat Forum" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabase(request);
  await requireAdmin(supabase, request);

  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, excerpt, posted_label, posted_date, profiles ( username )")
    .eq("status", "pending_review")
    .order("posted_at", { ascending: true });

  return data({ posts: posts ?? [] }, { headers });
}

export default function AdminReview({ loaderData }: Route.ComponentProps) {
  const { posts } = loaderData;

  return (
    <div>
      <h1 className="text-2xl font-bold text-violet-950">Review queue</h1>
      <p className="mt-1 text-sm text-slate-600">
        Posts awaiting moderation, oldest first.
      </p>

      {posts.length === 0 ? (
        <p className="mt-8 text-slate-600">Queue is empty. 🎉</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {posts.map((post: any) => (
            <li
              key={post.id}
              className="rounded-lg border border-stone-200 bg-white p-4"
            >
              <Link
                to={`/admin/review/${post.id}`}
                className="font-medium text-violet-950 hover:text-violet-700"
              >
                {post.title}
              </Link>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                {post.excerpt}
              </p>
              <p className="mt-2 text-xs text-slate-600">
                by {post.profiles?.username ?? "unknown"} · submitted{" "}
                {postedString(post.posted_label, post.posted_date)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
