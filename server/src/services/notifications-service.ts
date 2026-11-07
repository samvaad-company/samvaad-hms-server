/**
 * Notifications: what a person sees under the bell. One row per recipient, so each person reads and clears their own. They are only
 * ever read by their own user, inside their own hospital.
 */
import { notificationsRepo, usersRepo } from "@/repositories";
import type { NotificationRow, UserRow } from "@/db/tables";
import { type Session } from "@/auth/session";
import { requireHospitalId } from "@/services/hospital-scope";
import type { NotificationDTO, NotificationListDTO } from "@shared/types/preauth";

const toDto = (r: NotificationRow): NotificationDTO => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, link: r.link, read: !!r.read_at, createdAt: r.created_at });

/** Tell these users something. Duplicates are ignored. */
export async function notifyUsers(hospitalId: number, userIds: number[], note: { kind: string; title: string; body?: string; link?: string }): Promise<void> {
  for (const userId of [...new Set(userIds)]) {
    await notificationsRepo.create({ hospital_id: hospitalId, user_id: userId, kind: note.kind, title: note.title, body: note.body ?? "", link: note.link ?? "", read_at: null });
  }
}

async function usersWhere(hospitalId: number, pick: (u: UserRow) => boolean): Promise<number[]> {
  const { rows } = await usersRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: hospitalId }] } as never);
  return (rows as UserRow[]).filter((u) => u.status !== "Inactive" && pick(u)).map((u) => u.id);
}
/** The login(s) of a doctor. */
export const doctorUserIds = (hospitalId: number, doctorId: number) => usersWhere(hospitalId, (u) => u.doctor_id === doctorId);
/** The hospital's own top admins. */
export const adminUserIds = (hospitalId: number) => usersWhere(hospitalId, (u) => u.role === "Super Admin");

/** Mark this user's unread notifications that point at a link as read: done when the thing they asked for has been done. */
export async function clearForLink(userId: number, link: string): Promise<void> {
  const { rows } = await notificationsRepo.listRows({ unpaged: true, filters: [{ column: "user_id", op: "eq", value: userId }] } as never);
  for (const r of rows as NotificationRow[]) if (!r.read_at && r.link === link) await notificationsRepo.update(r.id, { read_at: new Date().toISOString() });
}

async function mine(actor: Session): Promise<NotificationRow[]> {
  const hid = requireHospitalId(actor);
  const { rows } = await notificationsRepo.listRows({ unpaged: true, filters: [{ column: "user_id", op: "eq", value: actor.userId }, { column: "hospital_id", op: "eq", value: hid }] } as never);
  return (rows as NotificationRow[]).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
}

export async function myNotifications(actor: Session): Promise<NotificationListDTO> {
  const all = await mine(actor);
  return { unread: all.filter((n) => !n.read_at).length, items: all.slice(0, 40).map(toDto) };
}

/** `{ ids: [1, 2] }` or `{ all: true }`. */
export async function markRead(input: unknown, actor: Session): Promise<NotificationListDTO> {
  const body = (typeof input === "object" && input !== null ? input : {}) as { ids?: unknown; all?: unknown };
  const ids = Array.isArray(body.ids) ? new Set(body.ids.map(Number)) : new Set<number>();
  for (const r of await mine(actor)) if (!r.read_at && (body.all === true || ids.has(r.id))) await notificationsRepo.update(r.id, { read_at: new Date().toISOString() });
  return myNotifications(actor);
}
