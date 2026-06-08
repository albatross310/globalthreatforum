import "dotenv/config";
import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "react-router";
import ws from "ws";

export type SessionUser = {
  id: string;
  email: string | undefined;
  username: string;
  role: "member" | "admin";
};

/**
 * Cookie-based Supabase client for loaders/actions. Always forward `headers`
 * in the response so refreshed auth cookies reach the browser.
 */
export function createSupabase(request: Request) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project credentials."
    );
  }

  const headers = new Headers();
  const supabase = createServerClient(url, anonKey, {
    // We never use realtime, but supabase-js still constructs the client;
    // Node < 22 has no native WebSocket, so hand it one.
    realtime: { transport: ws as unknown as typeof WebSocket },
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("Cookie") ?? "").map(
          ({ name, value }) => ({ name, value: value ?? "" })
        );
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          headers.append(
            "Set-Cookie",
            serializeCookieHeader(name, value, options)
          );
        }
      },
    },
  });

  return { supabase, headers };
}

/** Verified user (server-side check against Supabase Auth) plus profile. */
export async function getSessionUser(
  supabase: SupabaseClient
): Promise<SessionUser | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, role")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email,
    username: profile?.username ?? "unknown",
    role: profile?.role === "admin" ? "admin" : "member",
  };
}

export async function requireUser(
  supabase: SupabaseClient,
  request: Request
): Promise<SessionUser> {
  const user = await getSessionUser(supabase);
  if (!user) {
    const next = new URL(request.url).pathname;
    throw redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  return user;
}

export async function requireAdmin(
  supabase: SupabaseClient,
  request: Request
): Promise<SessionUser> {
  const user = await requireUser(supabase, request);
  if (user.role !== "admin") throw redirect("/");
  return user;
}
