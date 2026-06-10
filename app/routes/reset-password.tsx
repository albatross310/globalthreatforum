import { data, Form, Link, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/reset-password";
import { createSupabase, getSessionUser } from "../lib/supabase.server";

export function meta() {
  return [{ title: "Set a new password — Global Threat Forum" }];
}

const MIN_PASSWORD = 8;

/**
 * The recovery email link lands here. Supabase appends either a PKCE `code`
 * (default for the cookie-based SSR client) or a `token_hash`+`type=recovery`
 * (if the email template uses the token-hash flow). Either one is redeemed for
 * a short-lived recovery session whose cookies we forward via `headers`; the
 * form's action then calls updateUser with that session.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabase(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  // Already carrying a (recovery) session — let them set a new password.
  const existing = await getSessionUser(supabase);
  if (existing) return data({ ready: true, error: null }, { headers });

  let error: string | null = null;
  if (code) {
    const res = await supabase.auth.exchangeCodeForSession(code);
    error = res.error?.message ?? null;
  } else if (tokenHash && type === "recovery") {
    const res = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });
    error = res.error?.message ?? null;
  } else {
    error = "missing";
  }

  if (error) {
    return data(
      {
        ready: false,
        error:
          error === "missing"
            ? "This page is reached from the link in your password-reset email."
            : "This reset link is invalid or has expired. Request a new one — and be sure to open it in the same browser you requested it from.",
      },
      { status: 400, headers }
    );
  }
  return data({ ready: true, error: null }, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabase(request);
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  // The recovery session set by the loader must still be present.
  const user = await getSessionUser(supabase);
  if (!user) {
    return data(
      {
        error:
          "Your reset link has expired. Request a new one from the forgot-password page.",
        done: false,
      },
      { status: 400, headers }
    );
  }

  if (password.length < MIN_PASSWORD) {
    return data(
      { error: `Password must be at least ${MIN_PASSWORD} characters.`, done: false },
      { status: 400, headers }
    );
  }
  if (password !== confirm) {
    return data(
      { error: "The two passwords don't match.", done: false },
      { status: 400, headers }
    );
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return data({ error: error.message, done: false }, { status: 400, headers });
  }

  // Password changed; the recovery session is now a normal session, so send
  // them to the home page logged in.
  return redirect("/", { headers });
}

export default function ResetPassword({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();

  if (!loaderData.ready) {
    return (
      <div className="mx-auto max-w-sm text-center">
        <h1 className="text-2xl font-bold text-violet-950">
          Reset link problem
        </h1>
        <p className="mt-4 text-slate-600">{loaderData.error}</p>
        <p className="mt-4 text-sm text-slate-600">
          <Link
            to="/forgot-password"
            className="text-violet-700 hover:underline"
          >
            Request a new link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold text-violet-950">Set a new password</h1>
      <Form method="post" className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-slate-600">New password</span>
          <input
            type="password"
            name="password"
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
            className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-slate-900 focus:border-violet-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">Confirm new password</span>
          <input
            type="password"
            name="confirm"
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
            className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-slate-900 focus:border-violet-500 focus:outline-none"
          />
        </label>
        {actionData?.error && (
          <p className="text-sm text-rose-600">{actionData.error}</p>
        )}
        <button
          type="submit"
          disabled={navigation.state !== "idle"}
          className="w-full rounded bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {navigation.state === "idle" ? "Update password" : "Updating…"}
        </button>
      </Form>
    </div>
  );
}
