/**
 * "My profile" — any signed-in user edits their own details. Role, status and
 * hospital are never editable here; those stay with administrators.
 */
import { usersRepo, staffRepo, doctorsRepo } from "@/repositories";
import { type Session } from "@/auth/session";
import { hashPassword, verifyPassword } from "@/auth/password";
import { BadRequestError, NotFoundError, ValidationError } from "@/lib/errors";
import { validatePartial } from "@/lib/validation";
import { audit } from "@/services/audit";
import { updateOwnDoctorRecord } from "@/services/doctors-service";

const schema = {
  name: { type: "string", required: false, min: 2, max: 120 },
  phone: { type: "string", required: false, max: 20 },
  specialty: { type: "string", required: false, max: 120 },
  experience: { type: "string", required: false, max: 40 },
  currentPassword: { type: "string", required: false, max: 100 },
  newPassword: { type: "string", required: false, min: 6, max: 100 },
} as const;

export interface MyProfile {
  name: string;
  email: string;
  role: string;
  phone: string;
  /** Present for doctors only. */
  specialty?: string;
  experience?: string;
  department?: string;
}

export async function getMyProfile(actor: Session): Promise<MyProfile> {
  const user = await usersRepo.getRow(actor.userId);
  if (!user) throw new NotFoundError("User");
  const profile: MyProfile = { name: user.name, email: user.email, role: user.role, phone: "" };
  if (user.doctor_id != null) {
    const d = await doctorsRepo.getRow(user.doctor_id);
    if (d) Object.assign(profile, { name: d.name, phone: d.phone, specialty: d.specialty, experience: d.experience, department: d.department });
  } else if (user.staff_id != null) {
    const st = await staffRepo.getRow(user.staff_id);
    if (st) profile.phone = st.phone;
  }
  return profile;
}

/** Returns the updated session (name may have changed) so the caller can refresh the cookie. */
export async function updateMyProfile(input: unknown, actor: Session): Promise<Session> {
  const body = (input ?? {}) as Record<string, unknown>;
  const data = validatePartial(schema, body);
  const user = await usersRepo.getRow(actor.userId);
  if (!user) throw new NotFoundError("User");

  if (typeof body.name === "string" && !body.name.trim()) throw new ValidationError([{ field: "name", message: "is required" }]);

  const userPatch: Record<string, unknown> = {};

  if ("newPassword" in data && data.newPassword) {
    if (!data.currentPassword) throw new BadRequestError("Enter your current password to set a new one");
    if (!(await verifyPassword(String(data.currentPassword), user.password_hash))) {
      throw new BadRequestError("Your current password is incorrect");
    }
    userPatch.password_hash = await hashPassword(String(data.newPassword));
  }

  let name = user.name;
  if (user.doctor_id != null) {
    // The doctor record is the source of truth for name/phone/specialty/experience; it also syncs the login's name.
    const fields: Record<string, unknown> = {};
    for (const k of ["name", "phone", "specialty", "experience"] as const) if (k in data) fields[k] = data[k];
    if (Object.keys(fields).length) {
      const d = await updateOwnDoctorRecord(user.doctor_id, fields, actor);
      name = d.name;
    }
  } else {
    if ("name" in data && data.name) {
      userPatch.name = data.name;
      name = String(data.name);
    }
    if ("phone" in data && user.staff_id != null) await staffRepo.update(user.staff_id, { phone: data.phone ?? "" });
  }

  if (Object.keys(userPatch).length) await usersRepo.update(user.id, userPatch);
  await audit(actor, "update", "profile", user.id, { fields: Object.keys(data).filter((k) => !/password/i.test(k)), passwordChanged: "password_hash" in userPatch });
  return { ...actor, name };
}
