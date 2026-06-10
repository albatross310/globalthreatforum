// Server-only: anchors a content hash to the Bitcoin blockchain via
// OpenTimestamps. The proof is stored as base64; it starts "pending" (calendar
// servers have it) and becomes "confirmed" once a Bitcoin block includes it.
//
// opentimestamps is CommonJS, so we load it lazily (dynamic import) only when
// actually stamping — that keeps it out of the module graph for ordinary page
// renders, which the dev SSR runner can't evaluate (`require` is undefined).

let _ots: any;
async function getOts() {
  if (!_ots) {
    const mod: any = await import("opentimestamps");
    _ots = mod.default ?? mod;
  }
  return _ots;
}

function hexToBytes(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}

function serialize(Ot: any, detached: any): string {
  const ctx = new Ot.Context.StreamSerialization();
  detached.serialize(ctx);
  return Buffer.from(ctx.getOutput()).toString("base64");
}

/** Submit a hash to the OpenTimestamps calendars; returns a base64 pending proof. */
export async function stampHash(hashHex: string): Promise<string> {
  const Ot = await getOts();
  const detached = Ot.DetachedTimestampFile.fromHash(
    new Ot.Ops.OpSHA256(),
    hexToBytes(hashHex)
  );
  await Ot.stamp(detached);
  return serialize(Ot, detached);
}

export type AnchorFields = {
  ots_status: string;
  ots_proof: string | null;
  anchored_at: string | null;
};

/**
 * Anchoring decision at submission time, shared by posts and comments:
 * daytime → stamp inline now; overnight → queue for the daily 8am job (so the
 * proof never reads the late-night hour). Stamp failures fall back to queued.
 */
export async function anchorOnSubmit(
  hash: string,
  overnight: boolean
): Promise<AnchorFields> {
  if (overnight) return { ots_status: "queued", ots_proof: null, anchored_at: null };
  try {
    const proof = await stampHash(hash);
    // anchored_at stays null until Bitcoin confirms: it records the block time
    // the content "provably existed by", which doesn't exist while only the
    // calendars hold the proof. The pending badge never shows a date anyway.
    return { ots_status: "pending", ots_proof: proof, anchored_at: null };
  } catch {
    return { ots_status: "queued", ots_proof: null, anchored_at: null };
  }
}

export function isOvernight(postedLabel: string): boolean {
  return postedLabel === "evening" || postedLabel === "early morning";
}

export type UpgradeResult = {
  changed: boolean; // proof gained a Bitcoin attestation
  proofB64: string; // possibly-upgraded proof
  attestedUnix: number | null; // Bitcoin block time, best effort
};

/** Try to upgrade a pending proof to a confirmed Bitcoin attestation. */
export async function upgradeProof(
  proofB64: string,
  hashHex: string
): Promise<UpgradeResult> {
  const Ot = await getOts();
  const detached = Ot.DetachedTimestampFile.deserialize(
    new Ot.Context.StreamDeserialization(Buffer.from(proofB64, "base64"))
  );
  const original = Ot.DetachedTimestampFile.fromHash(
    new Ot.Ops.OpSHA256(),
    hexToBytes(hashHex)
  );

  // verify() pulls the Bitcoin path from the calendars (it upgrades the proof
  // in place) AND checks it against the chain in one pass, so we don't call
  // Ot.upgrade separately — that was a second, redundant calendar fetch. A
  // still-pending proof resolves to {} here, leaving the row untouched.
  let result: any = {};
  try {
    result = await Ot.verify(detached, original);
  } catch {
    result = {};
  }

  const hit =
    result &&
    (result.bitcoin ??
      result.litecoin ??
      Object.values(result).find(
        (v: any) => v && typeof v.timestamp === "number"
      ));
  const confirmed = !!(hit && typeof hit.timestamp === "number");

  // Only treat the proof as upgraded once Bitcoin actually attests it; then the
  // in-place-upgraded `detached` carries the full Bitcoin path to re-serialize.
  return {
    changed: confirmed,
    proofB64: confirmed ? serialize(Ot, detached) : proofB64,
    attestedUnix: confirmed ? (hit.timestamp as number) : null,
  };
}

/** Raw proof bytes for the downloadable .ots file. */
export function proofBytes(proofB64: string): Uint8Array {
  return new Uint8Array(Buffer.from(proofB64, "base64"));
}
