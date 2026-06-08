/**
 * Canonical origin for the site — the single host every public URL uses.
 * The deployment redirects the apex to www, so www is the canonical host.
 * Centralised here so canonical tags, og:url, the sitemap, and robots.txt
 * never drift apart.
 */
export const SITE_URL = "https://www.globalthreatforum.com";

export function canonical(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
