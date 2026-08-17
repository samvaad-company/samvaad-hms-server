/**
 * Hospital ↔ radiology center linking. A hospital admin requests a link to
 * a center by its code; the center's admin accepts or rejects it; either
 * side can revoke an accepted link later. This is the relationship radiology
 * order routing (a later phase) will read to decide whether a hospital's
 * studies can go to an outside center at all.
 */
import {
  hospitalRadiologyLinksRepo,
  hospitalsRepo,
  radiologyCentersRepo,
} from "@/server/repositories";
import { type HospitalRadiologyLinkRow } from "@/server/db/tables";
import { ForbiddenError, NotFoundError, ConflictError, BadRequestError } from "@/server/lib/errors";
import { validate } from "@/server/lib/validation";
import { displayDate, displayTime } from "@/server/services/helpers";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { requireHospitalId } from "@/server/services/hospital-scope";

const ACTIVE_STATUSES = ["Pending", "Active"];

function requireHospitalAdmin(actor: Session): number {
  const hospitalId = requireHospitalId(actor);
  if (!can(actor.role, "admin", "write")) {
    throw new ForbiddenError("You don't have permission to manage radiology links");
  }
  return hospitalId;
}

function requireCenterAdmin(actor: Session): number {
  if (actor.radiologyCenterId == null) {
    throw new ForbiddenError("Only a radiology center account can do this");
  }
  if (!can(actor.role, "radiology", "write")) {
    throw new ForbiddenError("You don't have permission to manage radiology links");
  }
  return actor.radiologyCenterId;
}

async function toLinkDTO(row: HospitalRadiologyLinkRow) {
  const [hospital, center] = await Promise.all([
    hospitalsRepo.getRow(row.hospital_id),
    radiologyCentersRepo.getRow(row.radiology_center_id),
  ]);
  return {
    id: row.id,
    status: row.status,
    hospitalId: row.hospital_id,
    hospitalName: hospital?.name ?? "Unknown hospital",
    radiologyCenterId: row.radiology_center_id,
    radiologyCenterName: center?.name ?? "Unknown center",
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    respondedBy: row.responded_by || null,
    respondedAt: row.responded_at || null,
    revokedBy: row.revoked_by || null,
    revokedAt: row.revoked_at || null,
  };
}

/** Every link visible to the caller's own tenant; Platform Admin sees all. */
export async function listLinks(actor: Session) {
  let rows: HospitalRadiologyLinkRow[];
  if (actor.role === "Platform Admin") {
    ({ rows } = await hospitalRadiologyLinksRepo.listRows({ unpaged: true }));
  } else if (actor.hospitalId != null) {
    ({ rows } = await hospitalRadiologyLinksRepo.listRows({
      unpaged: true,
      filters: [{ column: "hospital_id", op: "eq", value: actor.hospitalId }],
    }));
  } else if (actor.radiologyCenterId != null) {
    ({ rows } = await hospitalRadiologyLinksRepo.listRows({
      unpaged: true,
      filters: [{ column: "radiology_center_id", op: "eq", value: actor.radiologyCenterId }],
    }));
  } else {
    rows = [];
  }
  return Promise.all(rows.map(toLinkDTO));
}

const requestSchema = {
  radiologyCenterCode: { type: "string", required: true, min: 2, max: 40 },
} as const;

/** A hospital admin requests a link to a center, identified by its code. */
export async function requestLink(input: unknown, actor: Session) {
  const hospitalId = requireHospitalAdmin(actor);
  const data = validate(requestSchema, input);

  const center = await radiologyCentersRepo.findRow([
    { column: "code", op: "eq", value: data.radiologyCenterCode.trim().toUpperCase() },
  ]);
  if (!center || center.status !== "Active") {
    throw new NotFoundError("Radiology center");
  }

  const { rows: existing } = await hospitalRadiologyLinksRepo.listRows({
    unpaged: true,
    filters: [
      { column: "hospital_id", op: "eq", value: hospitalId },
      { column: "radiology_center_id", op: "eq", value: center.id },
    ],
  });
  if (existing.some((r) => ACTIVE_STATUSES.includes(r.status))) {
    throw new ConflictError("A link with this center is already pending or active");
  }

  const row = await hospitalRadiologyLinksRepo.create({
    hospital_id: hospitalId,
    radiology_center_id: center.id,
    status: "Pending",
    requested_by: actor.name,
    requested_at: `${displayDate()}, ${displayTime()}`,
    responded_by: "",
    responded_at: "",
    revoked_by: "",
    revoked_at: "",
  });
  await audit(actor, "request", "radiology-link", row.id, { centerId: center.id });
  return toLinkDTO(row as HospitalRadiologyLinkRow);
}

const decisionSchema = {
  decision: { type: "enum", required: true, values: ["accept", "reject"] },
} as const;

/** The center's admin accepts or rejects a pending request. */
export async function respondToLink(id: number, input: unknown, actor: Session) {
  const centerId = requireCenterAdmin(actor);
  const { decision } = validate(decisionSchema, input);

  const existing = await hospitalRadiologyLinksRepo.getRow(id);
  if (!existing || existing.radiology_center_id !== centerId) {
    throw new NotFoundError("Radiology link");
  }
  if (existing.status !== "Pending") {
    throw new ConflictError(`This request is already ${existing.status.toLowerCase()}`);
  }

  const row = await hospitalRadiologyLinksRepo.update(id, {
    status: decision === "accept" ? "Active" : "Rejected",
    responded_by: actor.name,
    responded_at: `${displayDate()}, ${displayTime()}`,
  });
  await audit(actor, decision === "accept" ? "accept" : "reject", "radiology-link", id);
  return toLinkDTO(row as HospitalRadiologyLinkRow);
}

/** Either side of an accepted (or still-pending) link can revoke it; so can a Platform Admin. */
export async function revokeLink(id: number, actor: Session) {
  const existing = await hospitalRadiologyLinksRepo.getRow(id);
  if (!existing) throw new NotFoundError("Radiology link");

  if (actor.role === "Platform Admin") {
    // no ownership check
  } else if (actor.hospitalId != null) {
    if (existing.hospital_id !== actor.hospitalId || !can(actor.role, "admin", "write")) {
      throw new NotFoundError("Radiology link");
    }
  } else if (actor.radiologyCenterId != null) {
    if (existing.radiology_center_id !== actor.radiologyCenterId || !can(actor.role, "radiology", "write")) {
      throw new NotFoundError("Radiology link");
    }
  } else {
    throw new ForbiddenError("You don't have permission to manage radiology links");
  }

  if (!ACTIVE_STATUSES.includes(existing.status)) {
    throw new BadRequestError(`Cannot revoke a link that is already ${existing.status.toLowerCase()}`);
  }

  const row = await hospitalRadiologyLinksRepo.update(id, {
    status: "Revoked",
    revoked_by: actor.name,
    revoked_at: `${displayDate()}, ${displayTime()}`,
  });
  await audit(actor, "revoke", "radiology-link", id);
  return toLinkDTO(row as HospitalRadiologyLinkRow);
}
