/**
 * The images kept for signing forms: each doctor's signature and stamp, and the hospital's stamp (kept by its top admin). Doctors and the
 * admin set their own; nobody can read or change anyone else's. The images are copied onto a form at the moment it is signed or stamped.
 */
import { signatureAssetsRepo, usersRepo } from "@/repositories";
import type { SignatureAssetRow, UserRow } from "@/db/tables";
import { type Session } from "@/auth/session";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { requireHospitalId } from "@/services/hospital-scope";
import { audit } from "@/services/audit";
import type { SignatureAssetsDTO } from "@shared/types/preauth";

export type AssetKind = "doctor_signature" | "doctor_stamp" | "hospital_stamp";
const KINDS: AssetKind[] = ["doctor_signature", "doctor_stamp", "hospital_stamp"];
const IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_CHARS = 450_000;

/** Whose image this kind is, or a refusal if this person may not keep it. */
function ownerFor(kind: AssetKind, actor: Session): number {
  if (kind === "hospital_stamp") {
    if (actor.role !== "Super Admin") throw new ForbiddenError("Only the hospital's admin keeps the hospital stamp.");
    return 0;
  }
  if (actor.role !== "Doctor") throw new ForbiddenError("Only a doctor keeps a signature or stamp for signing forms.");
  return actor.userId;
}

export async function findAsset(hospitalId: number, kind: AssetKind, ownerId: number): Promise<SignatureAssetRow | null> {
  const { rows } = await signatureAssetsRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: hospitalId }, { column: "kind", op: "eq", value: kind }, { column: "owner_id", op: "eq", value: ownerId }] } as never);
  return (rows as SignatureAssetRow[])[0] ?? null;
}

/** The caller's own images. */
export async function myAssets(actor: Session): Promise<SignatureAssetsDTO> {
  const hid = requireHospitalId(actor);
  const isDoctor = actor.role === "Doctor", isAdmin = actor.role === "Super Admin";
  const sig = isDoctor ? await findAsset(hid, "doctor_signature", actor.userId) : null;
  return {
    doctorSignature: sig?.image ?? null,
    autoSign: !!sig?.auto_sign,
    doctorStamp: isDoctor ? (await findAsset(hid, "doctor_stamp", actor.userId))?.image ?? null : null,
    hospitalStamp: isAdmin ? (await findAsset(hid, "hospital_stamp", 0))?.image ?? null : null,
  };
}

/** `{ kind, image }`: replaces what is kept. */
export async function setAsset(input: unknown, actor: Session): Promise<SignatureAssetsDTO> {
  const hid = requireHospitalId(actor);
  const body = (typeof input === "object" && input !== null ? input : {}) as { kind?: unknown; image?: unknown };
  if (!KINDS.includes(body.kind as AssetKind)) throw new ValidationError([{ field: "kind", message: "that isn't something that can be kept" }]);
  const kind = body.kind as AssetKind;
  const owner = ownerFor(kind, actor);
  if (typeof body.image !== "string" || !IMAGE.test(body.image)) throw new ValidationError([{ field: "image", message: "use a PNG, JPEG or WebP picture" }]);
  if (body.image.length > MAX_CHARS) throw new ValidationError([{ field: "image", message: "that picture is too large: keep it under about 300 KB" }]);
  const existing = await findAsset(hid, kind, owner);
  if (existing) await signatureAssetsRepo.update(existing.id, { image: body.image, updated_by: actor.name });
  else await signatureAssetsRepo.create({ hospital_id: hid, kind, owner_id: owner, image: body.image, updated_by: actor.name });
  await audit(actor, "signature_asset.set", "signature_asset", kind, { owner });
  return myAssets(actor);
}

/** `{ enabled }`: a doctor turns automatic signing on or off. It needs a saved signature, and goes off if the signature is removed. */
export async function setAutoSign(input: unknown, actor: Session): Promise<SignatureAssetsDTO> {
  const hid = requireHospitalId(actor);
  if (actor.role !== "Doctor") throw new ForbiddenError("Only a doctor can turn on automatic signing.");
  const enabled = (typeof input === "object" && input !== null ? (input as { enabled?: unknown }).enabled : undefined);
  if (typeof enabled !== "boolean") throw new ValidationError([{ field: "enabled", message: "say whether automatic signing is on or off" }]);
  const sig = await findAsset(hid, "doctor_signature", actor.userId);
  if (!sig) throw new ValidationError([{ field: "signature", message: "add your signature first, then you can turn on automatic signing" }]);
  await signatureAssetsRepo.update(sig.id, { auto_sign: enabled, updated_by: actor.name });
  await audit(actor, enabled ? "signature_asset.auto_sign_on" : "signature_asset.auto_sign_off", "signature_asset", "doctor_signature");
  return myAssets(actor);
}

/** The login of this doctor who has automatic signing on (and a signature saved), or null. */
export async function autoSigner(hospitalId: number, doctorId: number): Promise<{ user: UserRow; signature: SignatureAssetRow } | null> {
  const { rows } = await usersRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: hospitalId }, { column: "doctor_id", op: "eq", value: doctorId }] } as never);
  for (const user of rows as UserRow[]) {
    if (user.status === "Inactive" || user.role !== "Doctor") continue;
    const signature = await findAsset(hospitalId, "doctor_signature", user.id);
    if (signature?.auto_sign) return { user, signature };
  }
  return null;
}

export async function removeAsset(kindRaw: string | null, actor: Session): Promise<SignatureAssetsDTO> {
  const hid = requireHospitalId(actor);
  if (!KINDS.includes(kindRaw as AssetKind)) throw new ValidationError([{ field: "kind", message: "that isn't something that can be kept" }]);
  const kind = kindRaw as AssetKind;
  const existing = await findAsset(hid, kind, ownerFor(kind, actor));
  if (existing) await signatureAssetsRepo.remove(existing.id);
  await audit(actor, "signature_asset.remove", "signature_asset", kind);
  return myAssets(actor);
}
