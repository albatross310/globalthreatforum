/**
 * Privacy-preserving "posted" times.
 *
 * Exact submission instants are never stored or shown. Instead we bin the
 * author's LOCAL submission time into coarse buckets:
 *   - 08:00–20:00  → rounded down to the hour ("around 3pm")
 *   - 20:00–24:00  → "late evening"   (official time = 08:00 next morning)
 *   - 00:00–08:00  → "early morning"  (official time = 08:00 same morning)
 *
 * `postedAt` is the coarse OFFICIAL instant (8am, or the rounded hour) used for
 * ordering and, later, the OpenTimestamps anchor. It is safe to expose because
 * it carries no finer-than-the-bin precision.
 */

const WINDOW_START = 8; // 08:00 local
const WINDOW_END = 20; // 20:00 local

export type Binned = {
  postedAt: Date;
  postedLabel: string;
  postedDate: string; // YYYY-MM-DD in the author's local date
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function hour12(h: number): string {
  const period = h >= 12 ? "pm" : "am";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${period}`;
}

/** Wall-clock parts of `instant` as seen in `tz`. */
function wallClock(instant: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(instant).map((p) => [p.type, p.value])
  );
  return {
    y: Number(parts.year),
    M: Number(parts.month),
    d: Number(parts.day),
    h: Number(parts.hour),
    min: Number(parts.minute),
  };
}

/** Convert local wall-clock components in `tz` back to a UTC instant. */
function zonedToUtc(
  y: number,
  M: number,
  d: number,
  h: number,
  min: number,
  tz: string
): Date {
  const guess = Date.UTC(y, M - 1, d, h, min);
  const wall = wallClock(new Date(guess), tz);
  const wallAsUtc = Date.UTC(wall.y, wall.M - 1, wall.d, wall.h, wall.min);
  const offset = wallAsUtc - guess; // tz offset at this instant
  return new Date(guess - offset);
}

function nextDay(y: number, M: number, d: number) {
  const dt = new Date(Date.UTC(y, M - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return { y: dt.getUTCFullYear(), M: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** Bin a submission instant (usually `new Date()`) using the author's timezone. */
export function binSubmission(now: Date, tz: string): Binned {
  let zone = tz;
  try {
    // Validate the timezone; fall back to UTC if the client sent junk.
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
  } catch {
    zone = "UTC";
  }

  const w = wallClock(now, zone);
  const dateStr = `${w.y}-${pad(w.M)}-${pad(w.d)}`;

  if (w.h >= WINDOW_START && w.h < WINDOW_END) {
    return {
      postedAt: zonedToUtc(w.y, w.M, w.d, w.h, 0, zone),
      postedLabel: `around ${hour12(w.h)}`,
      postedDate: dateStr,
    };
  }

  if (w.h >= WINDOW_END) {
    const n = nextDay(w.y, w.M, w.d);
    return {
      postedAt: zonedToUtc(n.y, n.M, n.d, WINDOW_START, 0, zone),
      postedLabel: "late evening",
      postedDate: dateStr,
    };
  }

  // 00:00–08:00
  return {
    postedAt: zonedToUtc(w.y, w.M, w.d, WINDOW_START, 0, zone),
    postedLabel: "early morning",
    postedDate: dateStr,
  };
}

/** Count words in plain text (used for post/comment length limits). */
export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Format a stored YYYY-MM-DD date for display, e.g. "9 June 2026". */
export function formatPostedDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Combined human string, e.g. "9 June 2026, late evening". */
export function postedString(
  label: string | null,
  dateStr: string | null
): string {
  const date = formatPostedDate(dateStr);
  if (!label) return date;
  return date ? `${date}, ${label}` : label;
}
