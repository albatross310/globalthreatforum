import {
  data,
  Form,
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { createSupabase, getSessionUser } from "./lib/supabase.server";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabase(request);
  const user = await getSessionUser(supabase);
  return data({ user }, { headers });
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen bg-gradient-to-b from-amber-50 via-rose-100 to-orange-100 text-slate-900 antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-violet-100 text-violet-950"
      : "text-slate-600 hover:bg-violet-100 hover:text-slate-900"
  }`;
}

export default function App({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-stone-200 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/" className="mr-auto flex items-baseline gap-4">
            <span className="text-lg font-bold tracking-tight text-violet-950">
              Global Threat Forum
            </span>
            <span className="hidden text-xs italic text-slate-600 sm:inline">
              thinking creatively about existential risk beyond climate change
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass}>
              Posts
            </NavLink>
            <NavLink to="/about" className={navLinkClass}>
              About
            </NavLink>
            {user && (
              <>
                <NavLink to="/write" className={navLinkClass}>
                  Write
                </NavLink>
                <NavLink to="/me/posts" className={navLinkClass}>
                  My posts
                </NavLink>
              </>
            )}
            {user?.role === "admin" && (
              <NavLink to="/admin/review" className={navLinkClass}>
                Review
              </NavLink>
            )}
          </nav>

          {user ? (
            <Form
              method="post"
              action="/logout"
              className="flex items-center gap-3"
            >
              <span className="text-sm text-slate-600">{user.username}</span>
              <button
                type="submit"
                className="whitespace-nowrap rounded border border-stone-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-violet-100"
              >
                Log out
              </button>
            </Form>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="whitespace-nowrap rounded px-3 py-1.5 text-sm text-slate-800 hover:bg-violet-100"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="whitespace-nowrap rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-800 bg-slate-900 py-6 text-center text-xs text-slate-400">
        Global Threat Forum — open source; all posts reviewed before
        publishing.
      </footer>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="container mx-auto p-4 pt-16">
      <h1 className="text-2xl font-bold">{message}</h1>
      <p className="mt-2 text-slate-600">{details}</p>
      {stack && (
        <pre className="mt-4 w-full overflow-x-auto rounded bg-white p-4 text-sm">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
