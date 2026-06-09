import { data, Link } from "react-router";
import type { Route } from "./+types/home";
import { createSupabase } from "../lib/supabase.server";
import { canonical } from "../lib/seo";
import { postedString } from "../lib/posted-time";

const DESCRIPTION =
  "Community-written, moderator-reviewed analysis of global threats.";

export function meta() {
  const url = canonical("/");
  return [
    { title: "Global Threat Forum" },
    { name: "description", content: DESCRIPTION },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Global Threat Forum" },
    { property: "og:title", content: "Global Threat Forum" },
    { property: "og:description", content: DESCRIPTION },
    { property: "og:url", content: url },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: "Global Threat Forum" },
    { name: "twitter:description", content: DESCRIPTION },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabase(request);
  const { data: posts } = await supabase
    .from("posts")
    .select(
      "id, title, slug, excerpt, posted_label, posted_date, profiles ( username )"
    )
    .eq("status", "published")
    .order("posted_at", { ascending: false })
    .limit(30);

  return data({ posts: posts ?? [] }, { headers });
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { posts } = loaderData;

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Latest Ideas
      </h1>
      <p className="mt-2 text-slate-500">
        Every post is reviewed by a moderator before publication.
      </p>

      {posts.length === 0 ? (
        <div className="mt-12 rounded-lg border border-dashed border-stone-300 p-12 text-center text-slate-500">
          No posts published yet.{" "}
          <Link to="/write" className="text-violet-700 hover:underline">
            Write the first one
          </Link>
          .
        </div>
      ) : (
        <ul className="mt-8 space-y-6">
          {posts.map((post: any) => (
            <li
              key={post.id}
              className="rounded-lg border border-stone-200 bg-white p-5 transition-colors hover:border-stone-300"
            >
              <Link to={`/posts/${post.slug}`}>
                <h2 className="text-xl font-semibold text-slate-900 hover:text-violet-700">
                  {post.title}
                </h2>
              </Link>
              <p className="mt-2 line-clamp-3 text-sm text-slate-500">
                {post.excerpt}
              </p>
              <p className="mt-3 text-xs text-slate-500">
                by {post.profiles?.username ?? "unknown"} ·{" "}
                {postedString(post.posted_label, post.posted_date)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
