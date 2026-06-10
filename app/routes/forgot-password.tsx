import { data, Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/forgot-password";
import { createSupabase } from "../lib/supabase.server";

export function meta() {
  return [{ title: "Reset your password — Global Threat Forum" }];
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabase(request);
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();

  if (!email) {
    return data(
      { error: "Enter the email address for your account.", sent: false },
      { status: 400, headers }
    );
  }

  // Where Supabase sends the user after they click the email link. Prefer an
  // explicit SITE_URL (set in prod) but fall back to this request's origin so
  // it also works in local dev. resetPasswordForEmail sets a PKCE code-verifier
  // cookie via `headers`, which /reset-password reads back to finish the flow.
  const origin = process.env.SITE_URL ?? new URL(request.url).origin;
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });

  // Always report success: never reveal whether an account exists for an email.
  return data({ error: null, sent: true }, { headers });
}

export default function ForgotPassword({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();

  if (actionData?.sent) {
    return (
      <div className="mx-auto max-w-sm text-center">
        <h1 className="text-2xl font-bold text-violet-950">Check your email</h1>
        <p className="mt-4 text-slate-600">
          If an account exists for that address, we've sent a link to reset your
          password. Open it on this device, in this browser, to continue.
        </p>
        <p className="mt-4 text-sm text-slate-600">
          <Link to="/login" className="text-violet-700 hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold text-violet-950">Reset your password</h1>
      <p className="mt-2 text-sm text-slate-600">
        Enter your email and we'll send you a link to set a new password.
      </p>
      <Form method="post" className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-slate-600">Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
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
          {navigation.state === "idle" ? "Send reset link" : "Sending…"}
        </button>
      </Form>
      <p className="mt-4 text-sm text-slate-600">
        Remembered it?{" "}
        <Link to="/login" className="text-violet-700 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
