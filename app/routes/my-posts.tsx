import { data, Form, Link } from "react-router";
import type { Route } from "./+types/my-posts";
import { createSupabase, requireUser } from "../lib/supabase.server";

export function meta() {
  return [{ title: "My posts — Global Threat Forum" }];
}

const STATUS_BADGES: Record<string, string> = {
  draft: "bg-stone-200 text-stone-700",
  pending_review: "bg-amber-100 text-amber-800",
  published: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-700",
};

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabase(request);
  const user = await requireUser(supabase, request);

  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, slug, status, review_note, updated_at")
    .eq("author_id", user.id)
    .order("updated_at", { ascending: false });

  return data({ posts: posts ?? [] }, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabase(request);
  await requireUser(supabase, request);

  const form = await request.formData();
  const intent = String(form.get("intent"));
  const id = String(form.get("id"));

  // RLS restricts both operations to the author's own unpublished posts.
  if (intent === "delete") {
    await supabase.from("posts").delete().eq("id", id);
  } else if (intent === "submit") {
    await supabase
      .from("posts")
      .update({ status: "pending_review", review_note: null })
      .eq("id", id);
  }
  return data({ ok: true }, { headers });
}

export default function MyPosts({ loaderData }: Route.ComponentProps) {
  const { posts } = loaderData;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-violet-950">My posts</h1>
        <Link
          to="/write"
          className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          New post
        </Link>
      </div>

      {posts.length === 0 ? (
        <p className="mt-8 text-slate-600">
          Nothing yet — write your first post.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {posts.map((post: any) => (
            <li
              key={post.id}
              className="rounded-lg border border-stone-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center gap-3">
                {post.status === "published" ? (
                  <Link
                    to={`/posts/${post.slug}`}
                    className="font-medium text-violet-950 hover:text-violet-700"
                  >
                    {post.title}
                  </Link>
                ) : (
                  <span className="font-medium text-violet-950">{post.title}</span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[post.status] ?? ""}`}
                >
                  {post.status.replace("_", " ")}
                </span>

                <div className="ml-auto flex items-center gap-2">
                  {post.status !== "published" && (
                    <Link
                      to={`/write/${post.id}`}
                      className="rounded border border-stone-300 px-3 py-1 text-xs text-slate-800 hover:bg-violet-100"
                    >
                      Edit
                    </Link>
                  )}
                  {(post.status === "draft" || post.status === "rejected") && (
                    <Form method="post">
                      <input type="hidden" name="id" value={post.id} />
                      <button
                        type="submit"
                        name="intent"
                        value="submit"
                        className="rounded bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-600"
                      >
                        Submit for review
                      </button>
                    </Form>
                  )}
                  {post.status !== "published" && (
                    <Form
                      method="post"
                      onSubmit={(e) => {
                        if (!confirm("Delete this post?")) e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="id" value={post.id} />
                      <button
                        type="submit"
                        name="intent"
                        value="delete"
                        className="rounded border border-rose-300 px-3 py-1 text-xs text-rose-600 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </Form>
                  )}
                </div>
              </div>

              {post.status === "rejected" && post.review_note && (
                <p className="mt-2 text-sm text-amber-700">
                  Moderator: {post.review_note}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
