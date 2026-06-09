import { data, Link } from "react-router";
import type { Route } from "./+types/about.archive";
import { createSupabase } from "../lib/supabase.server";

export function meta() {
  return [{ title: "About archive — Global Threat Forum" }];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabase(request);
  const { data: versions } = await supabase
    .from("about_versions")
    .select("id, created_at")
    .order("created_at", { ascending: false });

  return data({ versions: versions ?? [] }, { headers });
}

export default function AboutArchive({ loaderData }: Route.ComponentProps) {
  const { versions } = loaderData;

  return (
    <div>
      <Link to="/about" className="text-sm text-slate-600 hover:text-violet-950">
        ← Back to About
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-violet-950">
        About — version history
      </h1>
      <p className="mt-2 text-slate-600">
        Every change to the About page is kept here, so what we've said over time
        stays on the record.
      </p>

      <ul className="mt-6 space-y-2">
        {versions.map((v: any, i: number) => (
          <li
            key={v.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3"
          >
            <Link
              to={i === 0 ? "/about" : `/about/archive/${v.id}`}
              className="font-medium text-violet-950 hover:text-violet-700"
            >
              {formatDate(v.created_at)}
            </Link>
            {i === 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                current
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
