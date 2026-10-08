import { collectionRoute } from "@/http/crud";
import {
  listTasks,
  createTask,
  TASKS_LIST_CONFIG,
} from "@/services/tasks-service";

export const { GET, POST } = collectionRoute({
  resource: "tasks",
  listConfig: TASKS_LIST_CONFIG,
  list: listTasks,
  create: createTask,
});
