// Small dark-green "Bitcoin-verified" marker shown next to a post/comment's
// time once its OpenTimestamps proof is confirmed on the Bitcoin blockchain.
export function VerifiedMark({ status }: { status: string | null }) {
  if (status !== "confirmed") return null;
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800"
      title="This timestamp is anchored in the Bitcoin blockchain"
    >
      ✓ Bitcoin-verified
    </span>
  );
}
