import type { Context } from "hono";

export function health(c: Context) {
  return c.json({ status: "ok", version: "0.1.0" });
}
