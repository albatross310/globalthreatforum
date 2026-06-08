import { data, Form, Link, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/register";
import { createSupabase } from "../lib/supabase.server";

export function meta() {
  return [{ title: "Sign up — Global Threat Forum" }];
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabase(request);
  const form = await request.formData();
  const username = String(form.get("username") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (username.length < 3 || username.length > 32) {
    return data(
      { error: "Username must be 3–32 characters.", confirm: false },
      { status: 400, headers }
    );
  }

  const { data: signUpData, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) {
    return data({ error: error.message, confirm: false }, { status: 400, headers });
  }

  // If email confirmation is enabled in Supabase, there is no session yet.
  if (!signUpData.session) {
    return data({ error: null, confirm: true }, { headers });
  }
  return redirect("/", { headers });
}

export default function Register({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();

  if (actionData?.confirm) {
    return (
      <div className="mx-auto max-w-sm text-center">
        <h1 className="text-2xl font-bold text-white">Check your email</h1>
        <p className="mt-4 text-slate-400">
          We sent you a confirmation link. Click it, then{" "}
          <Link to="/login" className="text-emerald-400 hover:underline">
            log in
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold text-white">Sign up</h1>
      <p className="mt-2 text-sm text-slate-500">
        Create an account to comment and submit posts for review.
      </p>
      <Form method="post" className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-slate-400">Username</span>
          <input
            type="text"
            name="username"
            required
            minLength={3}
            maxLength={32}
            autoComplete="username"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
          />
        </label>
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
            minLength={8}
            autoComplete="new-password"
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
          {navigation.state === "idle" ? "Create account" : "Creating…"}
        </button>
      </Form>
      <p className="mt-4 text-sm text-slate-500">
        Already have an account?{" "}
        <Link to="/login" className="text-emerald-400 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
