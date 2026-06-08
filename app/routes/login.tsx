import { data, Form, Link, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/login";
import { createSupabase } from "../lib/supabase.server";

export function meta() {
  return [{ title: "Log in — Global Threat Forum" }];
}

export function loader({ request }: Route.LoaderArgs) {
  return { next: new URL(request.url).searchParams.get("next") ?? "/" };
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabase(request);
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    return data({ error: error.message }, { status: 400, headers });
  }
  // Only allow internal redirect targets.
  const to = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return redirect(to, { headers });
}

export default function Login({ actionData, loaderData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const { next } = loaderData;

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold text-white">Log in</h1>
      <Form method="post" className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <label className="block">
          <span className="text-sm text-slate-400">Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-400">Password</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
          />
        </label>
        {actionData?.error && (
          <p className="text-sm text-red-400">{actionData.error}</p>
        )}
        <button
          type="submit"
          disabled={navigation.state !== "idle"}
          className="w-full rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {navigation.state === "idle" ? "Log in" : "Logging in…"}
        </button>
      </Form>
      <p className="mt-4 text-sm text-slate-500">
        No account?{" "}
        <Link to="/register" className="text-emerald-400 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
