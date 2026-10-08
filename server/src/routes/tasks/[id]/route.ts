import { itemRoute } from "@/http/crud";
import {
  getTask,
  updateTask,
  deleteTask,
} from "@/services/tasks-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "tasks",
  get: getTask,
  update: updateTask,
  remove: deleteTask,
});
