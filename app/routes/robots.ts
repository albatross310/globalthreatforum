import type { Route } from "./+types/robots";

// Tells crawlers everything is fair game and where to find the sitemap.
export function loader({ request }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
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
