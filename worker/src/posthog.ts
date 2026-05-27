import { PostHog } from "posthog-node";
import type { Env } from "./types";

let _client: PostHog | null = null;
let _apiKey: string | null = null;

export function getPostHog(env: Env): PostHog | null {
  if (!env.POSTHOG_KEY || !env.POSTHOG_HOST) return null;
  if (_client && _apiKey === env.POSTHOG_KEY) return _client;
  _apiKey = env.POSTHOG_KEY;
  _client = new PostHog(env.POSTHOG_KEY, {
    host: env.POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
  return _client;
}
