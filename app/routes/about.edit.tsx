import { useRef } from "react";
import { data, Form, redirect, useNavigation } from "react-router";
import type { JSONContent } from "@tiptap/core";
import type { Route } from "./+types/about.edit";
import { createSupabase, requireAdmin } from "../lib/supabase.server";
import { PostEditor } from "../components/editor";

export function meta() {
  return [{ title: "Edit about — Global Threat Forum" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabase(request);
  await requireAdmin(supabase, request);

  // Prefill the editor with the current version's content.
  const { data: versions } = await supabase
    .from("about_versions")
    .select("content")
    .order("created_at", { ascending: false })
    .limit(1);

  return data({ content: versions?.[0]?.content ?? null }, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabase(request);
  await requireAdmin(supabase, request);

  let content: JSONContent;
  try {
    const form = await request.formData();
    content = JSON.parse(String(form.get("content") ?? ""));
  } catch {
    return data({ error: "Content was malformed." }, { status: 400, headers });
  }

  // Append a new version — the previous one stays in the archive.
  const { error } = await supabase.from("about_versions").insert({ content });
  if (error) {
    return data({ error: error.message }, { status: 400, headers });
  }
  return redirect("/about", { headers });
}

export default function AboutEdit({ loaderData, actionData }: Route.ComponentProps) {
  const { content } = loaderData;
  const navigation = useNavigation();
  const contentRef = useRef<JSONContent | null>(content ?? null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <h1 className="text-2xl font-bold text-violet-950">Edit about page</h1>
      <p className="mt-1 text-sm text-slate-600">
        Publishing saves a new version. The current version is moved to the
        public archive — nothing is overwritten or lost.
      </p>

      <Form
        method="post"
        className="mt-6 space-y-4"
        onSubmit={() => {
          if (hiddenRef.current) {
            hiddenRef.current.value = JSON.stringify(
              contentRef.current ?? { type: "doc", content: [] }
            );
          }
        }}
      >
        <PostEditor
          initialContent={content ?? null}
          showWordMeter={false}
          onChange={(json) => {
            contentRef.current = json;
          }}
        />
        <input ref={hiddenRef} type="hidden" name="content" />

        {actionData?.error && (
          <p className="text-sm text-rose-600">{actionData.error}</p>
        )}

        <button
          type="submit"
          disabled={navigation.state !== "idle"}
          className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Publish update
        </button>
      </Form>
    </div>
  );
}
