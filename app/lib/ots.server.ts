import OpenTimestamps from "opentimestamps";

// Server-only: anchors a content hash to the Bitcoin blockchain via
// OpenTimestamps. The proof is stored as base64; it starts "pending" (calendar
// servers have it) and becomes "confirmed" once a Bitcoin block includes it.

const { DetachedTimestampFile, Ops, Context } = OpenTimestamps;

function hexToBytes(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}

function detachedFromHash(hashHex: string) {
  return DetachedTimestampFile.fromHash(new Ops.OpSHA256(), hexToBytes(hashHex));
}

function serialize(detached: any): string {
  const ctx = new Context.StreamSerialization();
  detached.serialize(ctx);
  return Buffer.from(ctx.getOutput()).toString("base64");
}

function deserialize(proofB64: string) {
  return DetachedTimestampFile.deserialize(
    new Context.StreamDeserialization(Buffer.from(proofB64, "base64"))
  );
}

/** Submit a hash to the OpenTimestamps calendars; returns a base64 pending proof. */
export async function stampHash(hashHex: string): Promise<string> {
  const detached = detachedFromHash(hashHex);
  await OpenTimestamps.stamp(detached);
  return serialize(detached);
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
  const detached = deserialize(proofB64);
  let changed = false;
  try {
    changed = await OpenTimestamps.upgrade(detached);
  } catch {
    changed = false;
  }

  const proof = changed ? serialize(detached) : proofB64;

  // Best-effort: extract the Bitcoin block time if the proof is now confirmed.
  let attestedUnix: number | null = null;
  try {
    const original = detachedFromHash(hashHex);
    const result: any = await OpenTimestamps.verify(detached, original);
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
