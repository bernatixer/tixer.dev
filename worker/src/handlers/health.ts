import type { Context } from "hono";
import type { Env } from "../types";

export function health(c: Context<{ Bindings: Env }>) {
  return c.json({
    status: "ok",
    commit: c.env.COMMIT_SHA ?? "dev",
  });
}
