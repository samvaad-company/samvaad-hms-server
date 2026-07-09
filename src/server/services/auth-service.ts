/**
 * Authentication service: credential verification and session-user assembly.
 */
import { usersRepo } from "@/server/repositories";
import { verifyPassword } from "@/server/auth/password";
import { permissionsFor } from "@/server/auth/rbac";
import { type Session } from "@/server/auth/session";
import { UnauthorizedError } from "@/server/lib/errors";
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

  const valid = await verifyPassword(password, matched.password_hash);
  if (!valid) throw new UnauthorizedError("Invalid email or password");

  await usersRepo.update(matched.id, {
    last_login_at: `${displayDate()}, ${displayTime()}`,
  });

  return {
    userId: matched.id,
    name: matched.name,
    email: matched.email,
    role: matched.role,
    doctorId: matched.doctor_id ?? null,
  };
}

export function sessionUser(session: Session): SessionUserDTO {
  return {
    id: session.userId,
    name: session.name,
    email: session.email,
    role: session.role,
    doctorId: session.doctorId,
    permissions: permissionsFor(session.role),
  };
}
