import type { Route } from "./+types/sitemap";
import { createSupabase } from "../lib/supabase.server";
import { SITE_URL } from "../lib/seo";

// Lists the homepage + every published post so Google can discover them all.
export async function loader({ request }: Route.LoaderArgs) {
  const origin = SITE_URL;
  const { supabase } = createSupabase(request);

  const { data: posts } = await supabase
    .from("posts")
    .select("slug, updated_at, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  const entries = [
    { loc: `${origin}/`, lastmod: null as string | null },
    ...(posts ?? []).map((p) => ({
      loc: `${origin}/posts/${p.slug}`,
      lastmod: p.updated_at ?? p.published_at,
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) =>
      `  <url><loc>${e.loc}</loc>${
        e.lastmod
          ? `<lastmod>${new Date(e.lastmod).toISOString().slice(0, 10)}</lastmod>`
          : ""
      }</url>`
  )
  .join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
