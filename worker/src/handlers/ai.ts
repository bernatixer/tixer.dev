// AI proxy handlers — call z.ai chat completions with `response_format: json_object`
// and forward the parsed JSON. Prompts copied verbatim from back/src/handlers/ai.rs.

import type { Context } from "hono";
import { getPostHog } from "../posthog";
import type { Env, Variables } from "../types";

type Ctx = Context<{ Bindings: Env; Variables: Variables }>;

const ZAI_ENDPOINT = "https://api.z.ai/api/paas/v4/chat/completions";
const ZAI_MODEL = "glm-4.5-flash";

interface ZaiResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

async function callZaiJson(
  apiKey: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const resp = await fetch(ZAI_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ZAI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: maxTokens,
      thinking: { type: "disabled" },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`z.ai returned ${resp.status}: ${text}`);
  }

  const parsed = (await resp.json()) as ZaiResponse;
  const content = parsed.choices?.[0]?.message?.content;
  if (!content) throw new Error("z.ai returned no choices");
  return content;
}

const STANDUP_SYSTEM_PROMPT =
  "You write concise daily standup messages for a software professional to post in Slack.\n" +
  "Given a list of completed task titles, write a brief, human first-person summary.\n" +
  "\n" +
  "Style rules:\n" +
  "- 2-5 short bullet points, each starting with '• ' (Unicode bullet).\n" +
  "- Past tense, first person. Polish the wording — don't just repeat task titles.\n" +
  "- Group closely related tasks into a single bullet when it improves clarity.\n" +
  "- No filler ('Great day!', 'Crushed it', etc). No emojis. No closing sign-off.\n" +
  "- Start the message with a heading like 'Done — <date>:' on its own line.\n" +
  "\n" +
  "Return ONLY a JSON object with this exact key:\n" +
  "  - message: string. The full Slack-ready text (heading + bullets, separated by newlines).";

interface StandupRequest {
  dateLabel: string;
  taskTitles: string[];
}

export async function dailyStandup(c: Ctx) {
  if (!c.env.ZAI_API_KEY) {
    return c.json({ error: "ZAI_API_KEY not configured on server" }, 503);
  }
  const userId = c.get("userId");
  let body: StandupRequest;
  try {
    body = await c.req.json<StandupRequest>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!Array.isArray(body.taskTitles) || body.taskTitles.length === 0) {
    return c.json({ error: "taskTitles must not be empty" }, 400);
  }

  const userPrompt =
    `Date: ${body.dateLabel}\n\nCompleted tasks:\n` +
    body.taskTitles.map((t) => `- ${t}`).join("\n");

  let content: string;
  try {
    content = await callZaiJson(c.env.ZAI_API_KEY, STANDUP_SYSTEM_PROMPT, userPrompt, 400);
  } catch (e) {
    const posthog = getPostHog(c.env);
    if (posthog) posthog.captureException(e, userId, { endpoint: "ai/daily-standup" });
    return c.json({ error: (e as Error).message }, 502);
  }

  try {
    const result = JSON.parse(content);
    const posthog = getPostHog(c.env);
    if (posthog) {
      posthog.capture({
        distinctId: userId,
        event: "ai daily standup",
        properties: {
          task_count: body.taskTitles.length,
        },
      });
    }
    return c.json(result);
  } catch (e) {
    return c.json(
      { error: `z.ai JSON parse error: ${(e as Error).message} - content: ${content}` },
      502,
    );
  }
}
