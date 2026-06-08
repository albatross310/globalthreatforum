import { generateHTML } from "@tiptap/html";
import type { JSONContent } from "@tiptap/core";
import { extensions } from "./tiptap";

/** Render stored tiptap JSON to HTML on the server (SEO-friendly). */
export function renderPostHtml(content: JSONContent): string {
  try {
    return generateHTML(content, extensions);
  } catch {
    return "<p><em>This post could not be rendered.</em></p>";
  }
}

/** Plain-text excerpt for list pages and meta descriptions. */
export function makeExcerpt(content: JSONContent, maxLength = 240): string {
  const text = renderPostHtml(content)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

/** First image URL in a post, used as the Open Graph preview image. */
export function firstImageSrc(content: JSONContent): string | null {
  let found: string | null = null;
  const walk = (node: JSONContent) => {
    if (found) return;
    if (node.type === "image" && typeof node.attrs?.src === "string") {
      found = node.attrs.src;
      return;
    }
    node.content?.forEach(walk);
  };
  walk(content);
  return found;
}

export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  // Random suffix guarantees uniqueness without a round trip.
  const suffix = crypto.randomUUID().slice(0, 6);
  return base ? `${base}-${suffix}` : suffix;
}
