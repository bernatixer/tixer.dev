import { PostHog } from "posthog-node";
import type { Context } from "hono";
import type { Env, Variables } from "./types";

// Cloudflare Workers are serverless — flush immediately after each event.
let _client: PostHog | null = null;
let _apiKey: string | null = null;

export function getPostHog(env: Env): PostHog | null {
  if (!env.POSTHOG_API_KEY) return null;
  if (_client && _apiKey === env.POSTHOG_API_KEY) return _client;

  _client = new PostHog(env.POSTHOG_API_KEY, {
    ...(env.POSTHOG_HOST ? { host: env.POSTHOG_HOST } : {}),
    flushAt: 1,
    flushInterval: 0,
    enableExceptionAutocapture: true,
  });
  _apiKey = env.POSTHOG_API_KEY;
  return _client;
}

// Read the PostHog session ID forwarded from the frontend via X-POSTHOG-SESSION-ID header.
export function getPhSessionId(c: Context<{ Bindings: Env; Variables: Variables }>): string | undefined {
  return c.req.header("x-posthog-session-id") ?? c.get("phSessionId") ?? undefined;
}
