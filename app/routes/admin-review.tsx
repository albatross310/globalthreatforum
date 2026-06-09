import { data, Form, Link } from "react-router";
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

  const { data: comments } = await supabase
    .from("comments")
    .select(
      "id, body, posted_label, posted_date, posts ( slug, title ), profiles ( username )"
    )
    .eq("status", "pending_review")
    .order("posted_at", { ascending: true });

  return data({ posts: posts ?? [], comments: comments ?? [] }, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabase(request);
  await requireAdmin(supabase, request);

  const form = await request.formData();
  const intent = String(form.get("intent"));
  const id = String(form.get("id"));

  // RLS limits these updates to admins.
  if (intent === "approve_comment") {
    await supabase.from("comments").update({ status: "published" }).eq("id", id);
  } else if (intent === "reject_comment") {
    await supabase.from("comments").update({ status: "rejected" }).eq("id", id);
  }
  return data({ ok: true }, { headers });
}

export default function AdminReview({ loaderData }: Route.ComponentProps) {
  const { posts, comments } = loaderData;
  const empty = posts.length === 0 && comments.length === 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-violet-950">Review queue</h1>
      <p className="mt-1 text-sm text-slate-600">
        Posts and comments awaiting moderation, oldest first.
      </p>

      {empty && <p className="mt-8 text-slate-600">Queue is empty. 🎉</p>}

      {posts.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Posts ({posts.length})
          </h2>
          <ul className="mt-3 space-y-3">
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
        </section>
      )}

      {comments.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Comments ({comments.length})
          </h2>
          <ul className="mt-3 space-y-3">
            {comments.map((comment: any) => (
              <li
                key={comment.id}
                className="rounded-lg border border-stone-200 bg-white p-4"
              >
                <p className="whitespace-pre-wrap text-sm text-slate-800">
                  {comment.body}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <p className="mr-auto text-xs text-slate-600">
                    by {comment.profiles?.username ?? "unknown"} · on{" "}
                    {comment.posts?.slug ? (
                      <Link
                        to={`/posts/${comment.posts.slug}`}
                        className="text-violet-700 hover:underline"
                      >
                        {comment.posts?.title ?? "post"}
                      </Link>
                    ) : (
                      "post"
                    )}{" "}
                    · {postedString(comment.posted_label, comment.posted_date)}
                  </p>
                  <Form method="post">
                    <input type="hidden" name="id" value={comment.id} />
                    <button
                      type="submit"
                      name="intent"
                      value="approve_comment"
                      className="rounded bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-500"
                    >
                      Approve
                    </button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="id" value={comment.id} />
                    <button
                      type="submit"
                      name="intent"
                      value="reject_comment"
                      className="rounded border border-rose-300 px-3 py-1 text-xs text-rose-600 hover:bg-rose-50"
                    >
                      Reject
                    </button>
                  </Form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
