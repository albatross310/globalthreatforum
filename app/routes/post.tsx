import { data, Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/post";
import { createSupabase, getSessionUser, requireUser } from "../lib/supabase.server";
import { firstImageSrc, renderPostHtml } from "../lib/render.server";
import { canonical } from "../lib/seo";
import { postedString } from "../lib/posted-time";

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
    .select("id, body, created_at, profiles ( username )")
    .eq("post_id", post.id)
    .order("created_at", { ascending: true });

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

  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    author_id: user.id,
    body,
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
  slug,
  hash,
}: {
  status: string | null;
  anchoredAt: string | null;
  slug: string;
  hash: string | null;
}) {
  if (!status || status === "none") return null;

  const confirmed = status === "confirmed";
  const hasProof = confirmed || status === "pending";

  return (
    <div
      className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded border px-3 py-2 text-xs ${
        confirmed
          ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
          : "border-slate-700 bg-slate-900/60 text-slate-400"
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
        <a
          href={`/api/timestamp/${slug}`}
          className="underline hover:text-white"
          download
        >
          download .ots proof
        </a>
      )}
      {hash && (
        <a
          href="https://opentimestamps.org"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white"
          title={`SHA-256: ${hash}`}
        >
          how to verify
        </a>
      )}
    </div>
  );
}

export default function Post({ loaderData, actionData }: Route.ComponentProps) {
  const { user, post, comments } = loaderData;
  const navigation = useNavigation();

  return (
    <article>
      {post.status !== "published" && (
        <div className="mb-6 rounded border border-amber-700 bg-amber-950/50 p-3 text-sm text-amber-300">
          This post is <strong>{post.status.replace("_", " ")}</strong> — only
          you and moderators can see it.
        </div>
      )}

      <h1 className="text-3xl font-bold tracking-tight text-white">
        {post.title}
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        by {post.author} · {postedString(post.postedLabel, post.postedDate)}
      </p>

      <TimestampBadge
        status={post.otsStatus}
        anchoredAt={post.anchoredAt}
        slug={post.slug}
        hash={post.contentHash}
      />

      <div
        className="prose prose-invert prose-slate mt-8 max-w-none"
        dangerouslySetInnerHTML={{ __html: post.html }}
      />

      {post.status === "published" && (
        <section className="mt-12 border-t border-slate-800 pt-8">
          <h2 className="text-xl font-semibold text-white">
            Comments ({comments.length})
          </h2>

          <ul className="mt-6 space-y-4">
            {comments.map((comment: any) => (
              <li
                key={comment.id}
                className="rounded-lg border border-slate-800 bg-slate-900/50 p-4"
              >
                <p className="text-sm text-slate-300">{comment.body}</p>
                <p className="mt-2 text-xs text-slate-600">
                  {comment.profiles?.username ?? "unknown"} ·{" "}
                  {formatDate(comment.created_at)}
                </p>
              </li>
            ))}
          </ul>

          {user ? (
            <Form method="post" className="mt-6">
              <input type="hidden" name="postId" value={post.id} />
              <textarea
                name="body"
                required
                rows={3}
                placeholder="Add a comment…"
                key={comments.length /* reset after successful submit */}
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
              {actionData?.error && (
                <p className="mt-1 text-sm text-red-400">{actionData.error}</p>
              )}
              <button
                type="submit"
                disabled={navigation.state !== "idle"}
                className="mt-2 rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Comment
              </button>
            </Form>
          ) : (
            <p className="mt-6 text-sm text-slate-500">
              <Link to="/login" className="text-emerald-400 hover:underline">
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
