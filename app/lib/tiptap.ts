import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";

/**
 * Single source of truth for the tiptap schema — used by the client editor
 * and the server-side HTML renderer. Keep both in sync by only editing here.
 */
export const extensions = [
  StarterKit.configure({
    link: {
      openOnClick: false,
      HTMLAttributes: { rel: "noopener noreferrer nofollow" },
    },
  }),
  Image.configure({
    HTMLAttributes: { class: "rounded-lg", loading: "lazy" },
  }),
];

export const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };
