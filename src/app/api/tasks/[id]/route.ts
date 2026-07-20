import { itemRoute } from "@/server/http/crud";
import {
  getTask,
  updateTask,
  deleteTask,
} from "@/server/services/tasks-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "tasks",
  get: getTask,
  update: updateTask,
  remove: deleteTask,
});
