import { useRef, useState } from "react";
import { data, Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/post";
import { createSupabase, getSessionUser, requireUser } from "../lib/supabase.server";
import { firstImageSrc, renderPostHtml } from "../lib/render.server";
import { canonical } from "../lib/seo";
import { binSubmission, postedString, wordCount } from "../lib/posted-time";
import { contentHash } from "../lib/hash.server";
import { anchorOnSubmit, isOvernight } from "../lib/ots.server";

const COMMENT_MIN_WORDS = 250;
const COMMENT_MAX_WORDS = 750;

export function meta({ data }: Route.MetaArgs) {
  if (!data?.post) return [{ title: "Post — Global Threat Forum" }];
  const { post, url } = data;
  const tags = [
    { title: `${post.title} — Global Threat Forum` },
    { name: "description", content: post.excerpt },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: "article" },
    { property: "og:site_name", content: "Global Threat Forum" },
    { property: "og:title", content: post.title },
    { property: "og:description", content: post.excerpt },
    { property: "og:url", content: url },
    { name: "twitter:title", content: post.title },
    { name: "twitter:description", content: post.excerpt },
    {
      name: "twitter:card",
      content: post.ogImage ? "summary_large_image" : "summary",
    },
  ];
  if (post.ogImage) {
    tags.push({ property: "og:image", content: post.ogImage });
    tags.push({ name: "twitter:image", content: post.ogImage });
  }
  return tags;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabase(request);
  const user = await getSessionUser(supabase);

  const { data: post } = await supabase
    .from("posts")
    .select(
      "id, title, slug, content, excerpt, status, posted_label, posted_date, content_hash, ots_status, anchored_at, profiles ( username )"
    )
    .eq("slug", params.slug)
    .single();

  if (!post) throw data("Post not found", { status: 404 });

  const { data: comments } = await supabase
    .from("comments")
    .select(
      "id, body, posted_label, posted_date, content_hash, ots_status, anchored_at, profiles ( username )"
    )
    .eq("post_id", post.id)
    .order("posted_at", { ascending: true });

  return data(
    {
      user,
      url: canonical(`/posts/${post.slug}`),
      post: {
        id: post.id,
        title: post.title,
        excerpt: post.excerpt,
        status: post.status,
        postedLabel: post.posted_label,
        postedDate: post.posted_date,
        slug: post.slug,
        contentHash: post.content_hash,
        otsStatus: post.ots_status,
        anchoredAt: post.anchored_at,
        author: (post.profiles as any)?.username ?? "unknown",
        ogImage: firstImageSrc(post.content),
        html: renderPostHtml(post.content),
      },
      comments: comments ?? [],
    },
    { headers }
  );
}

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase, headers } = createSupabase(request);
  const user = await requireUser(supabase, request);

  const form = await request.formData();
  const body = String(form.get("body") ?? "").trim();
  const postId = String(form.get("postId") ?? "");

  if (!body) {
    return data({ error: "Comment cannot be empty." }, { status: 400, headers });
  }

  const words = wordCount(body);
  if (words < COMMENT_MIN_WORDS || words > COMMENT_MAX_WORDS) {
    return data(
      {
        error: `Comments must be ${COMMENT_MIN_WORDS}–${COMMENT_MAX_WORDS} words (yours is ${words}).`,
      },
      { status: 400, headers }
    );
  }

  // Same binning + Bitcoin anchoring pipeline as posts.
  const tz = String(form.get("tz") || "UTC");
  const bin = binSubmission(new Date(), tz);
  const postedAtIso = bin.postedAt.toISOString();
  const hash = await contentHash({
    title: "comment",
    content: body,
    authorId: user.id,
    postedAt: postedAtIso,
    postedLabel: bin.postedLabel,
    postedDate: bin.postedDate,
  });
  const ots = await anchorOnSubmit(hash, isOvernight(bin.postedLabel));

  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    author_id: user.id,
    body,
    posted_at: postedAtIso,
    posted_label: bin.postedLabel,
    posted_date: bin.postedDate,
    content_hash: hash,
    ...ots,
    created_at: postedAtIso,
  });
  if (error) {
    return data({ error: error.message }, { status: 400, headers });
  }
  return data({ error: null }, { headers });
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function TimestampBadge({
  status,
  anchoredAt,
  downloadHref,
  hash,
  compact = false,
}: {
  status: string | null;
  anchoredAt: string | null;
  downloadHref: string;
  hash: string | null;
  compact?: boolean;
}) {
  if (!status || status === "none") return null;

  const confirmed = status === "confirmed";
  const hasProof = confirmed || status === "pending";

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded border px-3 py-2 ${
        compact ? "mt-2 text-[11px]" : "mt-3 text-xs"
      } ${
        confirmed
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-stone-300 bg-white/70 text-slate-500"
      }`}
    >
      <span className="font-medium">
        {confirmed
          ? `⏱ Timestamp verified in Bitcoin${
              anchoredAt ? ` — existed by ${formatDate(anchoredAt)}` : ""
            }`
          : "⏱ Timestamp pending Bitcoin confirmation"}
      </span>
      {hasProof && (
        <a href={downloadHref} className="underline hover:text-slate-900" download>
          download .ots proof
        </a>
      )}
      {hash && (
        <a
          href="https://opentimestamps.org"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-900"
          title={`SHA-256: ${hash}`}
        >
          how to verify
        </a>
      )}
    </div>
  );
}

function CommentForm({
  postId,
  error,
  busy,
}: {
  postId: string;
  error: string | null;
  busy: boolean;
}) {
  const [body, setBody] = useState("");
  const tzRef = useRef<HTMLInputElement>(null);
  const words = wordCount(body);
  const ok = words >= COMMENT_MIN_WORDS && words <= COMMENT_MAX_WORDS;

  return (
    <Form
      method="post"
      className="mt-6"
      onSubmit={() => {
        if (tzRef.current) {
          tzRef.current.value =
            Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        }
      }}
    >
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="tz" ref={tzRef} />
      <textarea
        name="body"
        required
        rows={6}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={`Add a comment (${COMMENT_MIN_WORDS}–${COMMENT_MAX_WORDS} words)…`}
        className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-violet-500 focus:outline-none"
      />
      <div className="mt-1 flex items-center justify-between">
        <span className={`text-xs ${ok ? "text-emerald-600" : "text-amber-700"}`}>
          {words} {words === 1 ? "word" : "words"} · need {COMMENT_MIN_WORDS}–
          {COMMENT_MAX_WORDS}
        </span>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
      <button
        type="submit"
        disabled={busy}
        className="mt-2 rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
      >
        Comment
      </button>
    </Form>
  );
}

export default function Post({ loaderData, actionData }: Route.ComponentProps) {
  const { user, post, comments } = loaderData;
  const navigation = useNavigation();

  return (
    <article>
      {post.status !== "published" && (
        <div className="mb-6 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          This post is <strong>{post.status.replace("_", " ")}</strong> — only
          you and moderators can see it.
        </div>
      )}

      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        {post.title}
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        by {post.author} · {postedString(post.postedLabel, post.postedDate)}
      </p>

      <TimestampBadge
        status={post.otsStatus}
        anchoredAt={post.anchoredAt}
        downloadHref={`/api/timestamp/${post.slug}`}
        hash={post.contentHash}
      />

      <div
        className="prose prose-slate mt-8 max-w-none"
        dangerouslySetInnerHTML={{ __html: post.html }}
      />

      {post.status === "published" && (
        <section className="mt-12 border-t border-stone-200 pt-8">
          <h2 className="text-xl font-semibold text-slate-900">
            Comments ({comments.length})
          </h2>

          <ul className="mt-6 space-y-4">
            {comments.map((comment: any) => (
              <li
                key={comment.id}
                className="rounded-lg border border-stone-200 bg-white p-4"
              >
                <p className="whitespace-pre-wrap text-sm text-slate-700">
                  {comment.body}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {comment.profiles?.username ?? "unknown"} ·{" "}
                  {postedString(comment.posted_label, comment.posted_date)}
                </p>
                <TimestampBadge
                  status={comment.ots_status}
                  anchoredAt={comment.anchored_at}
                  downloadHref={`/api/timestamp/comment/${comment.id}`}
                  hash={comment.content_hash}
                  compact
                />
              </li>
            ))}
          </ul>

          {user ? (
            <CommentForm
              key={comments.length /* remount to clear after submit */}
              postId={post.id}
              error={actionData?.error ?? null}
              busy={navigation.state !== "idle"}
            />
          ) : (
            <p className="mt-6 text-sm text-slate-500">
              <Link to="/login" className="text-violet-700 hover:underline">
                Log in
              </Link>{" "}
              to join the discussion.
            </p>
          )}
        </section>
      )}
    </article>
  );
}
