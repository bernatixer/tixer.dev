// AI proxy handlers — call z.ai chat completions with `response_format: json_object`
// and forward the parsed JSON. Prompts copied verbatim from back/src/handlers/ai.rs.

import type { Context } from "hono";
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

function todayLabel(): string {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10);
  const weekday = now.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  return `${ymd} (${weekday})`;
}

function buildParseSystemPrompt(availableTags: string[]): string {
  const today = todayLabel();
  const tagsLine = availableTags.length === 0 ? "(no existing tags)" : availableTags.join(", ");
  return (
    "You parse free-form task descriptions into structured task data.\n" +
    `Today is ${today}.\n` +
    "Return ONLY a JSON object (no prose, no markdown) with these exact keys:\n  " +
    "- title: string. The cleaned, imperative form of the task. Strip date/priority/tag mentions.\n  " +
    "- description: string | null. Use only if the user clearly intends extra detail beyond the title.\n  " +
    '- priority: "low" | "medium" | "high" | "urgent". Default "medium". Words like "urgent", "asap", "critical" -> urgent. "important" -> high. "later", "someday" -> low.\n  ' +
    "- dueDate: string (YYYY-MM-DD) | null. Resolve relative dates from today. If no date is mentioned, return null.\n  " +
    "- tags: string[]. Pick zero or more from the existing tag list (case-insensitive match). Do NOT invent new tags.\n" +
    `Existing tags: ${tagsLine}.\n` +
    'If the input is empty or nonsense, still return the schema with sensible defaults (title=input, priority="medium", others null/empty).'
  );
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

interface ParseTaskRequest {
  text: string;
  availableTags?: string[];
}

interface StandupRequest {
  dateLabel: string;
  taskTitles: string[];
}

export async function parseTask(c: Ctx) {
  if (!c.env.ZAI_API_KEY) {
    return c.json({ error: "ZAI_API_KEY not configured on server" }, 503);
  }
  let body: ParseTaskRequest;
  try {
    body = await c.req.json<ParseTaskRequest>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const trimmed = (body.text ?? "").trim();
  if (!trimmed) return c.json({ error: "text must not be empty" }, 400);

  let content: string;
  try {
    content = await callZaiJson(
      c.env.ZAI_API_KEY,
      buildParseSystemPrompt(body.availableTags ?? []),
      trimmed,
      400,
    );
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }

  try {
    return c.json(JSON.parse(content));
  } catch (e) {
    return c.json(
      { error: `z.ai JSON parse error: ${(e as Error).message} - content: ${content}` },
      502,
    );
  }
}

export async function dailyStandup(c: Ctx) {
  if (!c.env.ZAI_API_KEY) {
    return c.json({ error: "ZAI_API_KEY not configured on server" }, 503);
  }
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
    return c.json({ error: (e as Error).message }, 502);
  }

  try {
    return c.json(JSON.parse(content));
  } catch (e) {
    return c.json(
      { error: `z.ai JSON parse error: ${(e as Error).message} - content: ${content}` },
      502,
    );
  }
}
