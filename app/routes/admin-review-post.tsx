import { data, Form, Link, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/admin-review-post";
import { createSupabase, requireAdmin } from "../lib/supabase.server";
import { renderPostHtml } from "../lib/render.server";
import { postedString } from "../lib/posted-time";

export function meta() {
  return [{ title: "Review post — Global Threat Forum" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabase(request);
  await requireAdmin(supabase, request);

  const { data: post } = await supabase
    .from("posts")
    .select(
      "id, title, content, status, posted_label, posted_date, profiles ( username )"
    )
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
        postedLabel: post.posted_label,
        postedDate: post.posted_date,
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
    // Coarsen the publish time to the hour — no exact instant stored.
    const publishedHour = new Date();
    publishedHour.setMinutes(0, 0, 0);
    const { error } = await supabase
      .from("posts")
      .update({
        status: "published",
        published_at: publishedHour.toISOString(),
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
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        ← Back to queue
      </Link>

      <div className="mt-4 rounded border border-stone-200 bg-white p-3 text-sm text-slate-500">
        Reviewing submission by <strong>{post.author}</strong> · status:{" "}
        {post.status.replace("_", " ")} · posted{" "}
        {postedString(post.postedLabel, post.postedDate)}
      </div>

      <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
        {post.title}
      </h1>
      <div
        className="prose prose-slate mt-6 max-w-none"
        dangerouslySetInnerHTML={{ __html: post.html }}
      />

      <Form
        method="post"
        className="mt-10 space-y-3 border-t border-stone-200 pt-6"
      >
        <label className="block">
          <span className="text-sm text-slate-500">
            Note to the author (required when rejecting)
          </span>
          <textarea
            name="note"
            rows={3}
            className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-violet-500 focus:outline-none"
          />
        </label>

        {actionData?.error && (
          <p className="text-sm text-rose-600">{actionData.error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            name="intent"
            value="approve"
            disabled={busy}
            className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Approve &amp; publish
          </button>
          <button
            type="submit"
            name="intent"
            value="reject"
            disabled={busy}
            className="rounded bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            Reject with note
          </button>
        </div>
      </Form>
    </div>
  );
}
