/**
 * Training & tours: each person's progress through the guided lessons, and how the team is getting on.
 *
 * The lessons themselves (what they teach, who they're recommended to) are in the shared catalogue; this keeps the record —
 * started, how far, finished and how many times — one row per person per lesson. A lesson that was finished stays finished when
 * it is replayed. Accounts that belong to no hospital (partner centres) have nowhere to keep progress, so for them it is simply
 * not recorded and the lessons still run.
 */
import { trainingProgressRepo, usersRepo } from "@/repositories";
import { isDuplicateKeyError } from "@/services/teleconsult-ledger";
import type { TrainingProgressRow, UserRow } from "@/db/tables";
import { validate } from "@/lib/validation";
import { ValidationError } from "@/lib/errors";
import { withKeyLocks } from "@/lib/key-lock";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital } from "@/services/hospital-scope";
import { lessonById, recommendedFor } from "@shared/types/training";

export interface TrainingProgressDTO { lessonId: string; status: "In progress" | "Completed"; stepsSeen: number; completions: number; startedAt: string; completedAt: string | null }
export interface TrainingMineDTO { role: string; lessons: TrainingProgressDTO[]; recommended: string[]; done: number }
export interface TeamMemberDTO { userId: number; name: string; role: string; recommended: number; done: number; pct: number; lastActive: string | null; completed: string[]; inProgress: string[] }
export interface TrainingTeamDTO { members: TeamMemberDTO[]; average: number }

const toDTO = (r: TrainingProgressRow): TrainingProgressDTO => ({ lessonId: r.lesson_id, status: r.status as TrainingProgressDTO["status"], stepsSeen: r.steps_seen, completions: r.completions, startedAt: r.started_at, completedAt: r.completed_at });
const mine = async (actor: Session): Promise<TrainingProgressRow[]> =>
  actor.hospitalId == null ? [] : (await trainingProgressRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "user_id", op: "eq", value: actor.userId }] }, actor))).rows;

export async function getMine(actor: Session): Promise<TrainingMineDTO> {
  const rows = await mine(actor);
  const recommended = recommendedFor(actor.role).map((l) => l.id);
  return { role: actor.role, lessons: rows.map(toDTO), recommended, done: rows.filter((r) => r.status === "Completed" && recommended.includes(r.lesson_id)).length };
}

const EVENTS = ["start", "step", "complete", "skip"] as const;

/** One thing that happened in a tour: it started, reached a step, was finished, or was left. */
export async function record(body: unknown, actor: Session): Promise<TrainingProgressDTO | null> {
  const data = validate({ lessonId: { type: "string", required: true, max: 60 }, event: { type: "enum", required: true, values: [...EVENTS] }, step: { type: "number", required: false, min: 0, max: 200 } } as const, body);
  const lesson = lessonById(data.lessonId);
  if (!lesson) throw new ValidationError([{ field: "lessonId", message: "There's no such lesson" }]);
  if (actor.hospitalId == null) return null;
  const hospitalId = actor.hospitalId;
  return withKeyLocks([`training:${hospitalId}:${actor.userId}:${lesson.id}`], async () => {
    const now = new Date().toISOString();
    const step = Math.trunc(data.step ?? 0);
    const existing = (await mine(actor)).find((r) => r.lesson_id === lesson.id);
    let row = existing;
    if (!row) {
      try {
        row = await trainingProgressRepo.create({ hospital_id: hospitalId, user_id: actor.userId, user_name: actor.name, role: actor.role, lesson_id: lesson.id, status: "In progress", steps_seen: 0, completions: 0, started_at: now, completed_at: null });
      } catch (err) {
        // Another API process created the row an instant earlier (the database allows one per person and lesson): use theirs.
        if (!isDuplicateKeyError(err)) throw err;
        row = (await mine(actor)).find((r) => r.lesson_id === lesson.id);
        if (!row) throw err;
      }
    }
    const patch: Record<string, unknown> = { user_name: actor.name, role: actor.role };
    if (data.event === "start") {
      patch.started_at = now;
      await audit(actor, "update", "training-tour", actor.userId, { summary: `Started the "${lesson.id}" guided tour`, lesson: lesson.title });
    } else if (data.event === "complete") {
      patch.status = "Completed"; patch.completed_at = now; patch.completions = row.completions + 1; patch.steps_seen = Math.max(row.steps_seen, step);
      await audit(actor, "update", "training-tour", actor.userId, { summary: `Completed the "${lesson.id}" guided tour`, lesson: lesson.title });
    } else patch.steps_seen = Math.max(row.steps_seen, step);
    return toDTO((await trainingProgressRepo.update(row.id, patch)) as TrainingProgressRow);
  });
}

/** "Start over": forget my progress, so every lesson is new again. */
export async function reset(actor: Session): Promise<{ cleared: number }> {
  const rows = await mine(actor);
  for (const r of rows) await trainingProgressRepo.remove(r.id);
  if (rows.length) await audit(actor, "update", "training-tour", actor.userId, { summary: "Started the training over", lessons: rows.length });
  return { cleared: rows.length };
}

/** Everyone in the hospital against the lessons recommended to their role. */
export async function getTeam(actor: Session): Promise<TrainingTeamDTO> {
  if (actor.hospitalId == null) return { members: [], average: 0 };
  const [users, rows] = await Promise.all([
    usersRepo.listRows(scopeToHospital({ unpaged: true }, actor)).then((r) => r.rows as UserRow[]),
    trainingProgressRepo.listRows(scopeToHospital({ unpaged: true }, actor)).then((r) => r.rows),
  ]);
  const members = users.filter((u) => u.status !== "Inactive").map((u): TeamMemberDTO => {
    const recommended = recommendedFor(u.role).map((l) => l.id);
    const theirs = rows.filter((r) => r.user_id === u.id);
    const done = theirs.filter((r) => r.status === "Completed" && recommended.includes(r.lesson_id)).length;
    const last = theirs.map((r) => r.updated_at).sort().pop() ?? null;
    return {
      userId: u.id, name: u.name, role: u.role, recommended: recommended.length, done, pct: recommended.length ? Math.round((done / recommended.length) * 100) : 100,
      lastActive: last, completed: theirs.filter((r) => r.status === "Completed").map((r) => r.lesson_id), inProgress: theirs.filter((r) => r.status === "In progress").map((r) => r.lesson_id),
    };
  }).sort((a, b) => a.pct - b.pct || a.name.localeCompare(b.name));
  return { members, average: members.length ? Math.round(members.reduce((n, m) => n + m.pct, 0) / members.length) : 0 };
}
