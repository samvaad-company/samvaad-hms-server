/**
 * Theatres and theatre equipment — the things a surgery is booked into and with — plus the one call the Book
 * dialog uses to fill its pickers. Managed under the "ot" permission.
 */
import { otRepo, otRoomsRepo, otEquipmentRepo, doctorsRepo, staffRepo } from "@/repositories";
import { toOtRoomDTO, toOtEquipmentDTO } from "@/repositories/mappers";
import { type OtRoomRow, type OtEquipmentRow } from "@/db/tables";
import { ConflictError } from "@/lib/errors";
import { validate, validatePartial } from "@/lib/validation";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";
import { CATEGORIES, TURNAROUND_MIN } from "@/services/ot-service";
import { type OtOptionsDTO } from "@shared/types/api";

const roomSchema = {
  name: { type: "string", required: true, min: 2, max: 60 },
  kind: { type: "enum", required: false, values: CATEGORIES, default: "Major" },
  active: { type: "boolean", required: false, default: true },
} as const;

const equipmentSchema = {
  name: { type: "string", required: true, min: 2, max: 120 },
  status: { type: "enum", required: false, values: ["Available", "Maintenance"], default: "Available" },
  note: { type: "string", required: false, max: 200, default: "" },
} as const;

async function bookingCounts(actor: Session): Promise<{ byRoom: Map<number, number>; byName: Map<string, number>; byEquipment: Map<number, number> }> {
  const { rows } = await otRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const live = rows.filter((r) => r.status !== "Cancelled");
  const byRoom = new Map<number, number>();
  const byName = new Map<string, number>();
  const byEquipment = new Map<number, number>();
  for (const r of live) {
    if (r.room_id != null) byRoom.set(r.room_id, (byRoom.get(r.room_id) ?? 0) + 1);
    byName.set(r.ot_room, (byName.get(r.ot_room) ?? 0) + 1);
    for (const e of r.equipment_ids ?? []) byEquipment.set(e, (byEquipment.get(e) ?? 0) + 1);
  }
  return { byRoom, byName, byEquipment };
}

// ── Rooms ────────────────────────────────────────────────────────────────────

/**
 * A hospital that has surgeries on record but no theatres list yet (it predates rooms) gets its theatres from the
 * names those surgeries already use, so they show up in the Day and Week grids and can be booked. Nothing is invented:
 * a hospital with no surgeries starts with an empty list and adds its own under Rooms.
 */
const adopting = new Map<number, Promise<void>>();

/** One adoption at a time per hospital: the page asks for rooms and options at once, and both would otherwise create the same theatres. */
function adoptTheatresFromBookings(actor: Session): Promise<void> {
  const hospitalId = actor.hospitalId;
  if (hospitalId == null) return Promise.resolve();
  const running = adopting.get(hospitalId);
  if (running) return running;
  const job = (async () => {
    const existing = await otRoomsRepo.listRows(scopeToHospital({ pageSize: 1 }, actor));
    if (existing.total > 0) return;
    const { rows } = await otRepo.listRows(scopeToHospital({ unpaged: true }, actor));
    const names = [...new Set(rows.map((r) => (r.ot_room ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    for (const name of names) {
      const room = await otRoomsRepo.create({ hospital_id: hospitalId, name, kind: "Major", active: true });
      await Promise.all(rows.filter((r) => (r.ot_room ?? "").trim() === name && r.room_id == null).map((r) => otRepo.update(r.id, { room_id: room.id })));
    }
  })().finally(() => adopting.delete(hospitalId));
  adopting.set(hospitalId, job);
  return job;
}

export async function listRooms(actor: Session) {
  await adoptTheatresFromBookings(actor);
  const [{ rows }, counts] = await Promise.all([
    otRoomsRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "id", direction: "asc" }] }, actor)),
    bookingCounts(actor),
  ]);
  return rows.map((r) => toOtRoomDTO(r, counts.byRoom.get(r.id) ?? counts.byName.get(r.name) ?? 0));
}

async function assertRoomNameFree(name: string, actor: Session, exceptId?: number) {
  const { rows } = await otRoomsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  if (rows.some((r) => r.id !== exceptId && r.name.trim().toLowerCase() === name.trim().toLowerCase())) {
    throw new ConflictError(`A theatre called "${name}" already exists`);
  }
}

export async function createRoom(input: unknown, actor: Session) {
  const data = validate(roomSchema, input);
  await assertRoomNameFree(data.name, actor);
  const row = await otRoomsRepo.create({ hospital_id: requireHospitalId(actor), name: data.name, kind: data.kind, active: data.active });
  await audit(actor, "create", "ot-room", row.id);
  return toOtRoomDTO(row as OtRoomRow);
}

export async function updateRoom(id: number, input: unknown, actor: Session) {
  const existing = await otRoomsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Theatre");
  const data = validatePartial(roomSchema, input);
  const patch: Record<string, unknown> = {};
  if ("kind" in data) patch.kind = data.kind;
  if ("active" in data) patch.active = data.active;
  if ("name" in data && data.name !== existing.name) {
    await assertRoomNameFree(data.name as string, actor, id);
    patch.name = data.name;
  }
  const row = await otRoomsRepo.update(id, patch);
  // Bookings carry the theatre's name for display, so a rename follows them.
  if (patch.name) {
    const { rows } = await otRepo.listRows({ unpaged: true, filters: [{ column: "room_id", op: "eq", value: id }] });
    await Promise.all(rows.map((b) => otRepo.update(b.id, { ot_room: patch.name })));
  }
  await audit(actor, "update", "ot-room", id, patch);
  return toOtRoomDTO(row as OtRoomRow);
}

export async function deleteRoom(id: number, actor: Session) {
  const existing = await otRoomsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Theatre");
  const { rows } = await otRepo.listRows({ unpaged: true, filters: [{ column: "room_id", op: "eq", value: id }] });
  if (rows.length > 0) throw new ConflictError(`${existing.name} has ${rows.length} surgeries on record — switch it off instead of deleting it`);
  await otRoomsRepo.remove(id);
  await audit(actor, "delete", "ot-room", id);
}

// ── Equipment ────────────────────────────────────────────────────────────────

export async function listEquipment(actor: Session) {
  const { rows } = await otEquipmentRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "name", direction: "asc" }] }, actor));
  return rows.map(toOtEquipmentDTO);
}

export async function createEquipment(input: unknown, actor: Session) {
  const data = validate(equipmentSchema, input);
  const row = await otEquipmentRepo.create({ hospital_id: requireHospitalId(actor), name: data.name, status: data.status, note: data.note });
  await audit(actor, "create", "ot-equipment", row.id);
  return toOtEquipmentDTO(row as OtEquipmentRow);
}

export async function updateEquipment(id: number, input: unknown, actor: Session) {
  const existing = await otEquipmentRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Equipment");
  const data = validatePartial(equipmentSchema, input);
  const patch: Record<string, unknown> = {};
  if ("name" in data) patch.name = data.name;
  if ("status" in data) patch.status = data.status;
  if ("note" in data) patch.note = data.note;
  const row = await otEquipmentRepo.update(id, patch);
  // Surgeries booked with it keep its name for display.
  if (patch.name) {
    const { rows } = await otRepo.listRows({ unpaged: true });
    await Promise.all(
      rows
        .filter((b) => (b.equipment_ids ?? []).includes(id) && b.hospital_id === existing.hospital_id)
        .map(async (b) => {
          const all = (await otEquipmentRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: existing.hospital_id }] })).rows;
          return otRepo.update(b.id, { equipment: all.filter((e) => (b.equipment_ids ?? []).includes(e.id)).map((e) => (e.id === id ? String(patch.name) : e.name)) });
        }),
    );
  }
  await audit(actor, "update", "ot-equipment", id, patch);
  return toOtEquipmentDTO(row as OtEquipmentRow);
}

export async function deleteEquipment(id: number, actor: Session) {
  const existing = await otEquipmentRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Equipment");
  const counts = await bookingCounts(actor);
  const n = counts.byEquipment.get(id) ?? 0;
  if (n > 0) throw new ConflictError(`${existing.name} is booked in ${n} ${n === 1 ? "surgery" : "surgeries"} — take it out of use instead of deleting it`);
  await otEquipmentRepo.remove(id);
  await audit(actor, "delete", "ot-equipment", id);
}

// ── Book-dialog options ──────────────────────────────────────────────────────

export async function getOtOptions(actor: Session): Promise<OtOptionsDTO> {
  const [rooms, equipment, doctors, staff] = await Promise.all([
    listRooms(actor),
    listEquipment(actor),
    doctorsRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "name", direction: "asc" }] }, actor)),
    staffRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "name", direction: "asc" }] }, actor)),
  ]);
  const active = staff.rows.filter((s) => s.status === "Active");
  const pick = (re: RegExp) => active.filter((s) => re.test(s.role)).map((s) => ({ id: s.id, name: s.name }));
  return {
    rooms: rooms.filter((r) => r.active),
    equipment,
    doctors: doctors.rows.map((d) => ({ id: d.id, name: d.name })),
    nurses: pick(/nurse/i),
    technicians: pick(/technician|technologist/i),
    bufferMin: TURNAROUND_MIN,
  };
}
