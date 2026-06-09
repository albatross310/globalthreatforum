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
    const hour = new Date();
    hour.setMinutes(0, 0, 0);
    return {
      ots_status: "pending",
      ots_proof: proof,
      anchored_at: hour.toISOString(),
    };
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
  let changed = false;
  try {
    changed = await Ot.upgrade(detached);
  } catch {
    changed = false;
  }

  const proof = changed ? serialize(Ot, detached) : proofB64;

  // Best-effort: extract the Bitcoin block time if the proof is now confirmed.
  let attestedUnix: number | null = null;
  try {
    const original = Ot.DetachedTimestampFile.fromHash(
      new Ot.Ops.OpSHA256(),
      hexToBytes(hashHex)
    );
    const result: any = await Ot.verify(detached, original);
    if (result) {
      const hit =
        result.bitcoin ??
        result.litecoin ??
        Object.values(result).find((v: any) => v && v.timestamp);
      if (hit && typeof hit.timestamp === "number") attestedUnix = hit.timestamp;
    }
  } catch {
    attestedUnix = null;
  }

  return { changed, proofB64: proof, attestedUnix };
}

/** Raw proof bytes for the downloadable .ots file. */
export function proofBytes(proofB64: string): Uint8Array {
  return new Uint8Array(Buffer.from(proofB64, "base64"));
}
