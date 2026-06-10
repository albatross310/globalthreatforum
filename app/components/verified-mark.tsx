// Small dark-green marker shown next to a post/comment's time once its
// OpenTimestamps proof is confirmed on the Bitcoin blockchain. It marks that
// the content was *anchored* in Bitcoin — i.e. provably existed by the block
// time — not that the displayed posting time itself is chain-certified.
export function VerifiedMark({ status }: { status: string | null }) {
  if (status !== "confirmed") return null;
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800"
      title="The exact content was hashed into the Bitcoin blockchain, proving it existed by the confirmed block time."
    >
      ✓ Bitcoin-anchored
    </span>
  );
}
