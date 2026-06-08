import { useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { extensions, EMPTY_DOC } from "../lib/tiptap";
import { wordCount } from "../lib/posted-time";

const MIN_WORDS = 500;
const MAX_WORDS = 1500;

type ToolbarButtonProps = {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
};

function ToolbarButton({ onClick, active, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`rounded px-2 py-1 text-sm transition-colors ${
        active
          ? "bg-emerald-700 text-white"
          : "text-slate-300 hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadImage(file: File) {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body });
    if (!res.ok) {
      alert("Image upload failed. Are you logged in?");
      return;
    }
    const { url } = (await res.json()) as { url: string };
    editor.chain().focus().setImage({ src: url, alt: file.name }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-700 bg-slate-800/80 p-2">
      <ToolbarButton
        title="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton
        title="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        title="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </ToolbarButton>
      <ToolbarButton
        title="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        ••
      </ToolbarButton>
      <ToolbarButton
        title="Ordered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1.
      </ToolbarButton>
      <ToolbarButton
        title="Blockquote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        ❝
      </ToolbarButton>
      <ToolbarButton
        title="Code block"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        {"</>"}
      </ToolbarButton>
      <ToolbarButton title="Insert image" onClick={() => fileInputRef.current?.click()}>
        🖼 Image
      </ToolbarButton>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadImage(file);
          e.target.value = "";
        }}
      />
      <div className="ml-auto flex gap-1">
        <ToolbarButton title="Undo" onClick={() => editor.chain().focus().undo().run()}>
          ↺
        </ToolbarButton>
        <ToolbarButton title="Redo" onClick={() => editor.chain().focus().redo().run()}>
          ↻
        </ToolbarButton>
      </div>
    </div>
  );
}

function WordMeter({ words }: { words: number }) {
  const ok = words >= MIN_WORDS && words <= MAX_WORDS;
  return (
    <div className="flex justify-end border-t border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs">
      <span className={ok ? "text-emerald-400" : "text-amber-400"}>
        {words} {words === 1 ? "word" : "words"} · need {MIN_WORDS}–{MAX_WORDS}
      </span>
    </div>
  );
}

type PostEditorProps = {
  initialContent: JSONContent | null;
  onChange: (json: JSONContent) => void;
};

export function PostEditor({ initialContent, onChange }: PostEditorProps) {
  const editor = useEditor({
    extensions,
    content: initialContent ?? EMPTY_DOC,
    // Required for SSR: render only after hydration to avoid mismatches.
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-slate max-w-none min-h-[20rem] p-4 focus:outline-none",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getJSON());
    },
  });

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
      {editor ? (
        <>
          <Toolbar editor={editor} />
          <EditorContent editor={editor} />
          <WordMeter words={wordCount(editor.getText())} />
        </>
      ) : (
        <div className="min-h-[20rem] p-4 text-slate-600">Loading editor…</div>
      )}
    </div>
  );
}
