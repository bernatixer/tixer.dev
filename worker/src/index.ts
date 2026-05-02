import { Hono } from "hono";
import { cors } from "hono/cors";
import { requireAuth } from "./auth";
import { health } from "./handlers/health";
import { dailyStandup, parseTask } from "./handlers/ai";
import {
  createTag,
  deleteTag,
  listTags,
} from "./handlers/tags";
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} from "./handlers/tasks";
import type { Env, Variables } from "./types";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const ALLOWED_ORIGINS = new Set([
  "https://tixer.dev",
  "https://www.tixer.dev",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

app.use(
  "*",
  cors({
    origin: (origin) => (origin && ALLOWED_ORIGINS.has(origin) ? origin : null),
    credentials: true,
    allowHeaders: ["authorization", "content-type"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.get("/api/health", health);

const protectedApp = new Hono<{ Bindings: Env; Variables: Variables }>();
protectedApp.use("*", requireAuth);
protectedApp.get("/tasks", listTasks);
protectedApp.post("/tasks", createTask);
protectedApp.get("/tasks/:id", getTask);
protectedApp.put("/tasks/:id", updateTask);
protectedApp.delete("/tasks/:id", deleteTask);
protectedApp.get("/tags", listTags);
protectedApp.post("/tags", createTag);
protectedApp.delete("/tags/:id", deleteTag);
protectedApp.post("/ai/parse-task", parseTask);
protectedApp.post("/ai/daily-standup", dailyStandup);

app.route("/api", protectedApp);

export default app;
