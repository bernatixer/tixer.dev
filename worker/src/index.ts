import { Hono } from "hono";
import { cors } from "hono/cors";
import { DEFAULT_AUTHORIZED_PARTIES, requireAuth, requireFinanceAuth } from "./auth";
import { health } from "./handlers/health";
import { getPostHog } from "./posthog";
import { dailyStandup } from "./handlers/ai";
import { deleteFinanceVault, getFinanceVault, putFinanceVault } from "./handlers/finance";
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
import {
  createWeeklyGoal,
  deleteWeeklyGoal,
  listWeeklyGoals,
  updateWeeklyGoal,
} from "./handlers/weeklyGoals";
import {
  deleteWeightEntry,
  deleteWeightPhase,
  getWeight,
  putWeightEntry,
  putWeightPhase,
} from "./handlers/weight";
import type { Env, Variables } from "./types";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const ALLOWED_ORIGINS = new Set<string>(DEFAULT_AUTHORIZED_PARTIES);
const isFinancePath = (path: string) => path === "/api/finance" || path.startsWith("/api/finance/");

app.use("*", async (c, next) => {
  if (isFinancePath(c.req.path)) c.header("Cache-Control", "no-store");
  await next();
});

app.use(
  "*",
  cors({
    origin: (origin) => (origin && ALLOWED_ORIGINS.has(origin) ? origin : null),
    credentials: true,
    allowHeaders: ["authorization", "content-type"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

// Keep pending PostHog event delivery alive past the response — Workers cancels
// in-flight fetches the moment the handler returns otherwise.
app.use("*", async (c, next) => {
  if (isFinancePath(c.req.path)) return next();
  await next();
  const posthog = getPostHog(c.env);
  if (posthog) c.executionCtx.waitUntil(posthog.flush());
});

app.get("/api/health", health);

const financeApp = new Hono<{ Bindings: Env; Variables: Variables }>();
financeApp.onError((_error, c) => c.json({ error: "Finance unavailable" }, 500));
financeApp.use("*", requireFinanceAuth);
financeApp.get("/vault", getFinanceVault);
financeApp.put("/vault", putFinanceVault);
financeApp.delete("/vault", deleteFinanceVault);
financeApp.all("/vault", c => c.json({ error: "Method not allowed" }, 405));
financeApp.all("*", c => c.json({ error: "Finance endpoint not found" }, 404));
app.route("/api/finance", financeApp);

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
protectedApp.get("/weekly-goals", listWeeklyGoals);
protectedApp.post("/weekly-goals", createWeeklyGoal);
protectedApp.put("/weekly-goals/:id", updateWeeklyGoal);
protectedApp.delete("/weekly-goals/:id", deleteWeeklyGoal);
protectedApp.post("/ai/daily-standup", dailyStandup);
protectedApp.get("/weight", getWeight);
protectedApp.put("/weight/entries/:date", putWeightEntry);
protectedApp.delete("/weight/entries/:date", deleteWeightEntry);
protectedApp.put("/weight/phases/:date", putWeightPhase);
protectedApp.delete("/weight/phases/:date", deleteWeightPhase);

app.route("/api", protectedApp);

export default app;
