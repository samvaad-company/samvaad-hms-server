/**
 * Task board service — admins set goals and assign tasks to staff; assignees
 * move them across the To Do → In Progress → Blocked → Done workflow.
 */
import { tasksRepo, staffRepo } from "@/server/repositories";
import { toTaskDTO } from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import { type TaskRow } from "@/server/db/tables";
import { NotFoundError } from "@/server/lib/errors";
import { validate, validatePartial } from "@/server/lib/validation";
import { displayDate, isoDate } from "@/server/services/helpers";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";

export const TASK_STATUSES = ["To Do", "In Progress", "Blocked", "Done"] as const;
export const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

const taskSchema = {
  title: { type: "string", required: true, min: 3, max: 160 },
  description: { type: "string", required: false, max: 1000, default: "" },
  goal: { type: "string", required: false, max: 160, default: "" },
  assigneeId: { type: "number", required: false, min: 1 },
  assigneeName: { type: "string", required: false, max: 120, default: "" },
  priority: { type: "enum", required: false, values: TASK_PRIORITIES, default: "Medium" },
  status: { type: "enum", required: false, values: TASK_STATUSES, default: "To Do" },
  dueDate: { type: "string", required: false, max: 40, default: "" },
} as const;

export const TASKS_LIST_CONFIG = {
  searchColumns: ["title", "description", "goal", "assignee_name"],
  filterable: ["status", "priority", "assignee_id"],
  sortable: ["due_date", "priority", "status", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listTasks(options: QueryOptions) {
  return tasksRepo.list(options);
}

export async function getTask(id: number) {
  const t = await tasksRepo.get(id);
  if (!t) throw new NotFoundError("Task");
  return t;
}

async function resolveAssigneeName(
  assigneeId: number | undefined,
  fallback: string | undefined,
): Promise<string> {
  if (assigneeId) {
    const staff = await staffRepo.getRow(assigneeId);
    if (staff) return staff.name;
  }
  return fallback ?? "Unassigned";
}

export async function createTask(input: unknown, actor: Session) {
  const data = validate(taskSchema, input);
  const assigneeName = await resolveAssigneeName(data.assigneeId, data.assigneeName);
  const row = await tasksRepo.create({
    title: data.title,
    description: data.description,
    goal: data.goal,
    assignee_id: data.assigneeId ?? null,
    assignee_name: assigneeName,
    assigned_by: actor.name,
    priority: data.priority,
    status: data.status,
    due_date: isoDate(data.dueDate) || isoDate(new Date()),
  });
  await audit(actor, "create", "task", row.id);
  return toTaskDTO(row as TaskRow);
}

export async function updateTask(id: number, input: unknown, actor: Session) {
  const existing = await tasksRepo.getRow(id);
  if (!existing) throw new NotFoundError("Task");
  const data = validatePartial(taskSchema, input);
  const patch: Record<string, unknown> = {};
  if ("title" in data) patch.title = data.title;
  if ("description" in data) patch.description = data.description;
  if ("goal" in data) patch.goal = data.goal;
  if ("assigneeId" in data) {
    patch.assignee_id = data.assigneeId ?? null;
    patch.assignee_name = await resolveAssigneeName(data.assigneeId, data.assigneeName);
  } else if ("assigneeName" in data) {
    patch.assignee_name = data.assigneeName;
  }
  if ("priority" in data) patch.priority = data.priority;
  if ("status" in data) patch.status = data.status;
  if ("dueDate" in data) patch.due_date = isoDate(data.dueDate);
  const row = await tasksRepo.update(id, patch);
  await audit(actor, "update", "task", id, patch);
  return toTaskDTO(row as TaskRow);
}

export async function deleteTask(id: number, actor: Session) {
  const ok = await tasksRepo.remove(id);
  if (!ok) throw new NotFoundError("Task");
  await audit(actor, "delete", "task", id);
}
