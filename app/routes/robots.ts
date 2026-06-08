import { SITE_URL } from "../lib/seo";

// Tells crawlers everything is fair game and where to find the sitemap.
export function loader() {
  const origin = SITE_URL;
  const body = `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
