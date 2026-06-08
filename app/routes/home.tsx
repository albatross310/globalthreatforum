import { data, Link } from "react-router";
import type { Route } from "./+types/home";
import { createSupabase } from "../lib/supabase.server";
import { canonical } from "../lib/seo";

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
    .select("id, title, slug, excerpt, published_at, profiles ( username )")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(30);

  return data({ posts: posts ?? [] }, { headers });
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { posts } = loaderData;

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-white">
        Latest analysis
      </h1>
      <p className="mt-2 text-slate-400">
        Every post is reviewed by a moderator before publication.
      </p>

      {posts.length === 0 ? (
        <div className="mt-12 rounded-lg border border-dashed border-slate-700 p-12 text-center text-slate-500">
          No posts published yet.{" "}
          <Link to="/write" className="text-emerald-400 hover:underline">
            Write the first one
          </Link>
          .
        </div>
      ) : (
        <ul className="mt-8 space-y-6">
          {posts.map((post: any) => (
            <li
              key={post.id}
              className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 transition-colors hover:border-slate-700"
            >
              <Link to={`/posts/${post.slug}`}>
                <h2 className="text-xl font-semibold text-white hover:text-emerald-400">
                  {post.title}
                </h2>
              </Link>
              <p className="mt-2 line-clamp-3 text-sm text-slate-400">
                {post.excerpt}
              </p>
              <p className="mt-3 text-xs text-slate-600">
                by {post.profiles?.username ?? "unknown"} ·{" "}
                {formatDate(post.published_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
