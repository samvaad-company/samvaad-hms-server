/**
 * Authentication service: credential verification and session-user assembly.
 */
import { usersRepo, hospitalsRepo } from "@/server/repositories";
import { verifyPassword } from "@/server/auth/password";
import { permissionsFor } from "@/server/auth/rbac";
import { type Session } from "@/server/auth/session";
import { UnauthorizedError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { displayDate, displayTime } from "@/server/services/helpers";
import { type SessionUserDTO } from "@/types/api";

export async function login(
  email: string,
  password: string,
): Promise<Session> {
  const user = await usersRepo.findRow([
    { column: "email", op: "eq", value: email.toLowerCase().trim() },
  ]);

  // Fall back to case-insensitive match if the store preserves case.
  const matched =
    user ??
    (await usersRepo.findRow([{ column: "email", op: "ilike", value: email.trim() }]));

  if (!matched) throw new UnauthorizedError("Invalid email or password");

  if (matched.status !== "Active") {
    throw new UnauthorizedError("This account is inactive");
  }

  // A hospital's own staff are locked out while their tenant is paused or
  // removed by a platform admin, even if their individual account is Active.
  if (matched.hospital_id != null) {
    const hospital = await hospitalsRepo.getRow(matched.hospital_id);
    if (hospital && hospital.status !== "Active") {
      throw new UnauthorizedError(
        hospital.status === "Paused"
          ? "This hospital's account is paused. Contact your platform administrator."
          : "This hospital's account is no longer active.",
      );
    }
  }

  const valid = await verifyPassword(password, matched.password_hash);
  if (!valid) throw new UnauthorizedError("Invalid email or password");

  // Fire-and-forget: this shouldn't add a round trip to the critical login path.
  usersRepo
    .update(matched.id, { last_login_at: `${displayDate()}, ${displayTime()}` })
    .catch((err) => logger.warn("auth.last_login_update_failed", { error: err instanceof Error ? err.message : String(err) }));

  return {
    userId: matched.id,
    name: matched.name,
    email: matched.email,
    role: matched.role,
    hospitalId: matched.hospital_id ?? null,
    radiologyCenterId: matched.radiology_center_id ?? null,
    labCenterId: matched.lab_center_id ?? null,
    doctorId: matched.doctor_id ?? null,
  };
}

export function sessionUser(session: Session): SessionUserDTO {
  return {
    id: session.userId,
    name: session.name,
    email: session.email,
    role: session.role,
    hospitalId: session.hospitalId,
    radiologyCenterId: session.radiologyCenterId,
    labCenterId: session.labCenterId,
    doctorId: session.doctorId,
    permissions: permissionsFor(session.role),
  };
}
