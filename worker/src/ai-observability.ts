import { getPostHog } from "./posthog";
import type { Env } from "./types";

interface AIGeneration {
  distinctId?: string;
  provider: string;
  model: string;
  traceId: string;
  input: unknown[];
  output?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  httpStatus?: number;
  error?: unknown;
}

export function captureAIGeneration(env: Env, generation: AIGeneration) {
  if (!generation.distinctId) return;
  const posthog = getPostHog(env);
  if (!posthog) return;

  posthog.capture({
    distinctId: generation.distinctId,
    event: "$ai_generation",
    properties: {
      $ai_trace_id: generation.traceId,
      $ai_session_id: null,
      $ai_model: generation.model,
      $ai_provider: generation.provider,
      $ai_input: generation.input,
      ...(generation.output ? { $ai_output_choices: [{ role: "assistant", content: generation.output }] } : {}),
      ...(generation.inputTokens !== undefined ? { $ai_input_tokens: generation.inputTokens } : {}),
      ...(generation.outputTokens !== undefined ? { $ai_output_tokens: generation.outputTokens } : {}),
      $ai_latency: generation.latencyMs / 1000,
      ...(generation.httpStatus !== undefined ? { $ai_http_status: generation.httpStatus } : {}),
      ...(generation.error ? { $ai_is_error: true, $ai_error: String(generation.error) } : {}),
    },
  });
}
