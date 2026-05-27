import { Hono } from "hono";
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
import {
  createWeeklyGoal,
  deleteWeeklyGoal,
  listWeeklyGoals,
  updateWeeklyGoal,
} from "./handlers/weeklyGoals";
import {
  bankStatus,
  deleteBankSession,
  finalizeBankAuth,
  importBankSession,
  listBankAccounts,
  listBankSessions,
  listBankTransactions,
  startBankAuth,
  syncBank,
  updateBankTransaction,
} from "./handlers/bank";
import type { Env, Variables } from "./types";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const ALLOWED_ORIGINS = new Set([
  "https://focus.tixer.dev",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

// Allow any ngrok dev tunnel during local development. ngrok rotates the
// subdomain each session so we can't pin a specific one.
function isAllowedOrigin(origin: string | undefined): origin is string {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.ngrok-free\.(dev|app)$/.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.ngrok\.io$/.test(origin)) return true;
  return false;
}

// Custom CORS so we can also emit `Access-Control-Allow-Private-Network`,
// which Chrome's Private Network Access spec requires when an HTTPS origin
// (e.g. an ngrok tunnel) calls a private-network resource (localhost:5555).
// Hono's stock cors() middleware doesn't expose this header.
app.use("*", async (c, next) => {
  const origin = c.req.header("origin");
  const allowedOrigin = isAllowedOrigin(origin) ? origin : "";

  if (c.req.method === "OPTIONS") {
    const reqHeaders =
      c.req.header("access-control-request-headers") ?? "authorization, content-type";
    const headers: Record<string, string> = {
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": reqHeaders,
      "Access-Control-Max-Age": "86400",
      Vary: "Origin, Access-Control-Request-Headers",
    };
    if (allowedOrigin) {
      headers["Access-Control-Allow-Origin"] = allowedOrigin;
      headers["Access-Control-Allow-Credentials"] = "true";
    }
    if (c.req.header("access-control-request-private-network") === "true") {
      headers["Access-Control-Allow-Private-Network"] = "true";
    }
    return new Response(null, { status: 204, headers });
  }

  await next();
  if (allowedOrigin) {
    c.res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    c.res.headers.set("Access-Control-Allow-Credentials", "true");
    c.res.headers.append("Vary", "Origin");
  }
});

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
protectedApp.get("/weekly-goals", listWeeklyGoals);
protectedApp.post("/weekly-goals", createWeeklyGoal);
protectedApp.put("/weekly-goals/:id", updateWeeklyGoal);
protectedApp.delete("/weekly-goals/:id", deleteWeeklyGoal);
protectedApp.get("/bank/status", bankStatus);
protectedApp.get("/bank/sessions", listBankSessions);
protectedApp.post("/bank/sessions/import", importBankSession);
protectedApp.delete("/bank/sessions/:id", deleteBankSession);
protectedApp.post("/bank/auth/start", startBankAuth);
protectedApp.post("/bank/auth/finalize", finalizeBankAuth);
protectedApp.get("/bank/accounts", listBankAccounts);
protectedApp.post("/bank/sync", syncBank);
protectedApp.get("/bank/transactions", listBankTransactions);
protectedApp.put("/bank/transactions/:id", updateBankTransaction);
protectedApp.post("/ai/parse-task", parseTask);
protectedApp.post("/ai/daily-standup", dailyStandup);

app.route("/api", protectedApp);

export default app;
