import { data, Form, Link, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/admin-review-post";
import { createSupabase, requireAdmin } from "../lib/supabase.server";
import { renderPostHtml } from "../lib/render.server";

export function meta() {
  return [{ title: "Review post — Global Threat Forum" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabase(request);
  await requireAdmin(supabase, request);

  const { data: post } = await supabase
    .from("posts")
    .select("id, title, content, status, updated_at, profiles ( username )")
    .eq("id", params.id)
    .single();

  if (!post) throw data("Post not found", { status: 404 });

  return data(
    {
      post: {
        id: post.id,
        title: post.title,
        status: post.status,
        author: (post.profiles as any)?.username ?? "unknown",
        updated_at: post.updated_at,
        html: renderPostHtml(post.content),
      },
    },
    { headers }
  );
}

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase, headers } = createSupabase(request);
  await requireAdmin(supabase, request);

  const form = await request.formData();
  const intent = String(form.get("intent"));
  const note = String(form.get("note") ?? "").trim();

  if (intent === "approve") {
    const { error } = await supabase
      .from("posts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        review_note: note || null,
      })
      .eq("id", params.id);
    if (error) {
      return data({ error: error.message }, { status: 400, headers });
    }
  } else if (intent === "reject") {
    if (!note) {
      return data(
        { error: "Please give the author a reason for the rejection." },
        { status: 400, headers }
      );
    }
    const { error } = await supabase
      .from("posts")
      .update({ status: "rejected", review_note: note })
      .eq("id", params.id);
    if (error) {
      return data({ error: error.message }, { status: 400, headers });
    }
  }

  return redirect("/admin/review", { headers });
}

export default function AdminReviewPost({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { post } = loaderData;
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  return (
    <div>
      <Link
        to="/admin/review"
        className="text-sm text-slate-500 hover:text-slate-300"
      >
        ← Back to queue
      </Link>

      <div className="mt-4 rounded border border-slate-800 bg-slate-900/40 p-3 text-sm text-slate-400">
        Reviewing submission by <strong>{post.author}</strong> · status:{" "}
        {post.status.replace("_", " ")} · last updated{" "}
        {new Date(post.updated_at).toLocaleString("en-GB")}
      </div>

      <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">
        {post.title}
      </h1>
      <div
        className="prose prose-invert prose-slate mt-6 max-w-none"
        dangerouslySetInnerHTML={{ __html: post.html }}
      />

      <Form
        method="post"
        className="mt-10 space-y-3 border-t border-slate-800 pt-6"
      >
        <label className="block">
          <span className="text-sm text-slate-400">
            Note to the author (required when rejecting)
          </span>
          <textarea
            name="note"
            rows={3}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
          />
        </label>

        {actionData?.error && (
          <p className="text-sm text-red-400">{actionData.error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            name="intent"
            value="approve"
            disabled={busy}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Approve &amp; publish
          </button>
          <button
            type="submit"
            name="intent"
            value="reject"
            disabled={busy}
            className="rounded bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            Reject with note
          </button>
        </div>
      </Form>
    </div>
  );
}
