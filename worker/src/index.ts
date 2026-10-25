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
  getWeightDay,
  putDayReviews,
  putWeightEntry,
  putWeightGoal,
  putWeightPhase,
  putWeightProfile,
} from "./handlers/weight";
import {
  getTelegram,
  linkTelegram,
  sendReminders,
  telegramWebhook,
  unlinkTelegram,
  updateTelegram,
} from "./handlers/telegram";
import { deleteMeal, postMeal, putMeal } from "./handlers/meals";
import type { Env, Variables } from "./types";

export const app = new Hono<{ Bindings: Env; Variables: Variables }>();

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
// Telegram authenticates with its webhook secret, not a Clerk session.
app.post("/api/telegram/webhook", telegramWebhook);

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
protectedApp.get("/weight/days/:date", getWeightDay);
protectedApp.put("/weight/profile", putWeightProfile);
protectedApp.put("/weight/goals/:date", putWeightGoal);
protectedApp.put("/weight/day-reviews", putDayReviews);
protectedApp.put("/weight/entries/:date", putWeightEntry);
protectedApp.delete("/weight/entries/:date", deleteWeightEntry);
protectedApp.put("/weight/phases/:date", putWeightPhase);
protectedApp.delete("/weight/phases/:date", deleteWeightPhase);
protectedApp.post("/meals", postMeal);
protectedApp.put("/meals/:id", putMeal);
protectedApp.delete("/meals/:id", deleteMeal);
protectedApp.get("/telegram", getTelegram);
protectedApp.post("/telegram/link", linkTelegram);
protectedApp.put("/telegram", updateTelegram);
protectedApp.delete("/telegram", unlinkTelegram);

app.route("/api", protectedApp);

export default {
  fetch: app.fetch,
  scheduled: (_event: ScheduledController, env: Env, ctx: ExecutionContext) => ctx.waitUntil(sendReminders(env)),
} satisfies ExportedHandler<Env>;
