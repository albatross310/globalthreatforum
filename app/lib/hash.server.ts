/**
 * Deterministic SHA-256 of a post's identifying content. This is the value we
 * anchor to OpenTimestamps, so it must be stable: same inputs → same hash.
 * Note it commits only to the BINNED posted time, never an exact instant.
 */
export async function contentHash(input: {
  title: string;
  content: unknown;
  authorId: string;
  postedAt: string;
  postedLabel: string;
  postedDate: string;
}): Promise<string> {
  // Stable key order; JSON.stringify of the content tree is deterministic for
  // the editor's output (object key order is preserved on round-trip).
  const canonical = JSON.stringify({
    title: input.title,
    content: input.content,
    author: input.authorId,
    postedAt: input.postedAt,
    postedLabel: input.postedLabel,
    postedDate: input.postedDate,
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical)
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
