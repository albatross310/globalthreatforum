import { useRef, useState } from "react";
import { data, Form, redirect, useNavigation } from "react-router";
import type { JSONContent } from "@tiptap/core";
import type { Route } from "./+types/write";
import { createSupabase, requireUser } from "../lib/supabase.server";
import { makeExcerpt, postWordCount, slugify } from "../lib/render.server";
import { binSubmission } from "../lib/posted-time";
import { contentHash } from "../lib/hash.server";
import { anchorOnSubmit, isOvernight } from "../lib/ots.server";

const MIN_WORDS = 500;
const MAX_WORDS = 1500;
import { PostEditor } from "../components/editor";

export function meta() {
  return [{ title: "Write — Global Threat Forum" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabase(request);
  await requireUser(supabase, request);

  if (!params.id) {
    return data({ post: null }, { headers });
  }

  // RLS guarantees authors only see their own unpublished posts here.
  const { data: post } = await supabase
    .from("posts")
    .select("id, title, content, status, review_note")
    .eq("id", params.id)
    .single();

  if (!post) throw data("Post not found", { status: 404 });
  if (post.status === "published") {
    throw data("Published posts can no longer be edited.", { status: 403 });
  }
  return data({ post }, { headers });
}

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase, headers } = createSupabase(request);
  const user = await requireUser(supabase, request);

  const form = await request.formData();
  const intent = String(form.get("intent"));
  const title = String(form.get("title") ?? "").trim();
  let content: JSONContent;
  try {
    content = JSON.parse(String(form.get("content") ?? ""));
  } catch {
    return data({ error: "Post content was malformed." }, { status: 400, headers });
  }

  if (!title) {
    return data({ error: "A title is required." }, { status: 400, headers });
  }

  // Word limits apply when submitting for review (drafts can be any length).
  if (intent === "submit") {
    const words = postWordCount(content);
    if (words < MIN_WORDS || words > MAX_WORDS) {
      return data(
        {
          error: `Posts must be ${MIN_WORDS}–${MAX_WORDS} words to submit (yours is ${words}).`,
        },
        { status: 400, headers }
      );
    }
  }

  // Bin the submission time in the author's timezone — exact instant is never
  // stored. The content hash commits to this binned time, not a precise one.
  const tz = String(form.get("tz") || "UTC");
  const bin = binSubmission(new Date(), tz);
  const postedAtIso = bin.postedAt.toISOString();

  const status = intent === "submit" ? "pending_review" : "draft";
  const hash = await contentHash({
    title,
    content,
    authorId: user.id,
    postedAt: postedAtIso,
    postedLabel: bin.postedLabel,
    postedDate: bin.postedDate,
  });

  // OpenTimestamps anchoring (only when submitting; drafts aren't anchored).
  // Any prior proof is discarded because a content/time change invalidates it.
  const ots =
    intent === "submit"
      ? await anchorOnSubmit(hash, isOvernight(bin.postedLabel))
      : { ots_status: "none", ots_proof: null, anchored_at: null };

  const fields = {
    title,
    content,
    excerpt: makeExcerpt(content),
    status,
    // Timezone is used to compute the bin, then discarded — never stored, so
    // it can't leak the author's region even though anon can read the row.
    posted_at: postedAtIso,
    posted_label: bin.postedLabel,
    posted_date: bin.postedDate,
    content_hash: hash,
    ...ots,
    // Resubmissions clear the previous rejection note.
    review_note: null,
  };

  if (params.id) {
    const { error } = await supabase
      .from("posts")
      .update(fields)
      .eq("id", params.id);
    if (error) {
      return data({ error: error.message }, { status: 400, headers });
    }
  } else {
    const { error } = await supabase.from("posts").insert({
      ...fields,
      author_id: user.id,
      slug: slugify(title),
      // Store binned times only — no exact creation instant.
      created_at: postedAtIso,
      updated_at: postedAtIso,
    });
    if (error) {
      return data({ error: error.message }, { status: 400, headers });
    }
  }

  return redirect("/me/posts", { headers });
}

export default function Write({ loaderData, actionData }: Route.ComponentProps) {
  const { post } = loaderData;
  const navigation = useNavigation();
  const contentRef = useRef<JSONContent | null>(post?.content ?? null);
  const [title, setTitle] = useState(post?.title ?? "");
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const tzInputRef = useRef<HTMLInputElement>(null);

  const busy = navigation.state !== "idle";

  return (
    <div>
      <h1 className="text-2xl font-bold text-violet-950">
        {post ? "Edit post" : "Write a post"}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Save drafts as often as you like. Submitting sends the post to the
        moderators for review before it appears publicly.
      </p>

      {post?.status === "rejected" && post.review_note && (
        <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <strong>Moderator feedback:</strong> {post.review_note}
        </div>
      )}

      <Form
        method="post"
        className="mt-6 space-y-4"
        onSubmit={() => {
          if (hiddenInputRef.current) {
            hiddenInputRef.current.value = JSON.stringify(
              contentRef.current ?? { type: "doc", content: [] }
            );
          }
          if (tzInputRef.current) {
            tzInputRef.current.value =
              Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
          }
        }}
      >
        <input
          type="text"
          name="title"
          required
          placeholder="Post title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-lg font-semibold text-violet-950 focus:border-violet-500 focus:outline-none"
        />

        <PostEditor
          initialContent={post?.content ?? null}
          onChange={(json) => {
            contentRef.current = json;
          }}
        />
        <input ref={hiddenInputRef} type="hidden" name="content" />
        <input ref={tzInputRef} type="hidden" name="tz" />

        {actionData?.error && (
          <p className="text-sm text-rose-600">{actionData.error}</p>
        )}

        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠ Once a moderator publishes it, a post is <strong>permanent</strong> —
          it can't be edited or deleted. (Drafts can be deleted any time before
          then.)
        </p>

        <div className="flex gap-3">
          <button
            type="submit"
            name="intent"
            value="draft"
            disabled={busy}
            className="rounded border border-stone-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-violet-100 disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="submit"
            name="intent"
            value="submit"
            disabled={busy}
            className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Submit for review
          </button>
        </div>
      </Form>
    </div>
  );
}
