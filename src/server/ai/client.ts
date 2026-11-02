/**
 * Claude client (server-side only). Structured outputs via Zod; refusal fallbacks opted in
 * (`fallbacks: "default"`); effort set explicitly. The model is configurable (AI_MODEL).
 *
 * Prompt-injection posture: job ads and the CV are passed as quoted DATA inside tagged blocks; the model
 * has no tools, and its output only ever becomes draft text or scores that are shown to the owner.
 * Nothing the model returns can send anything or change settings.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { env } from "../env.ts";
import { recordUsage } from "../jobs/budget.ts";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured (ANTHROPIC_API_KEY is missing).");
  }
}
export class AiRefusalError extends Error {
  constructor(public category: string | null) {
    super(`The model declined the task${category ? ` (${category})` : ""}.`);
  }
}
export class AiOutputError extends Error {}
export class AiUnavailableError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
  ) {
    super(message);
  }
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  const key = env().ANTHROPIC_API_KEY;
  if (!key) throw new AiNotConfiguredError();
  if (!client) client = new Anthropic({ apiKey: key, maxRetries: 2, timeout: 120_000 });
  return client;
}

export function aiConfigured(): boolean {
  return Boolean(env().ANTHROPIC_API_KEY);
}

export type StructuredResult<T> = { data: T; model: string; inputTokens: number; outputTokens: number };

export async function structured<S extends z.ZodType>(
  schema: S,
  opts: {
    system: string;
    user: string;
    effort?: "low" | "medium" | "high" | "xhigh" | "max";
    model?: string;
    maxTokens?: number;
    /** Optional files (images / PDFs) placed before the text. */
    files?: { mediaType: string; data: Buffer }[];
    /** Label in the usage ledger. Recorded as "ui:<operation>": work you started yourself. */
    operation?: string;
    /** false when the caller accounts for the usage itself (budgeted background work). */
    record?: boolean;
  },
): Promise<StructuredResult<z.infer<S>>> {
  const c = getClient();
  try {
    const res = await c.beta.messages.parse({
      model: opts.model ?? env().AI_MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [...(opts.files ?? []).map(fileBlock), { type: "text" as const, text: opts.user }],
        },
      ],
      output_config: { effort: opts.effort ?? "high", format: betaZodOutputFormat(schema) },
    });
    if (opts.record !== false) {
      await recordUsage({
        provider: "anthropic",
        operation: `ui:${opts.operation ?? "ai"}`,
        credits: (res.usage.input_tokens + res.usage.output_tokens) / 1000,
        detail: res.model,
      }).catch(() => undefined);
    }
    if (res.stop_reason === "refusal") throw new AiRefusalError(res.stop_details?.category ?? null);
    if (res.stop_reason === "max_tokens")
      throw new AiOutputError("The model's answer was cut off (token limit).");
    if (!res.parsed_output) throw new AiOutputError("The model did not return a valid structure.");
    return {
      data: res.parsed_output as z.infer<S>,
      model: res.model,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    };
  } catch (e) {
    if (e instanceof AiRefusalError || e instanceof AiOutputError) throw e;
    if (e instanceof Anthropic.AuthenticationError)
      throw new AiUnavailableError("The Anthropic API key is not valid.", false);
    if (e instanceof Anthropic.RateLimitError)
      throw new AiUnavailableError("Too many requests to the model; try again in a moment.", true);
    if (e instanceof Anthropic.BadRequestError)
      throw new AiUnavailableError(`Bad request to the model: ${e.message.slice(0, 200)}`, false);
    if (e instanceof Anthropic.APIError)
      throw new AiUnavailableError(`The AI service is unavailable (${e.status ?? "network"}).`, true);
    throw e;
  }
}

function fileBlock(f: { mediaType: string; data: Buffer }): Anthropic.Beta.BetaContentBlockParam {
  if (f.mediaType === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: f.data.toString("base64") },
    };
  }
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: f.mediaType as "image/jpeg" | "image/png" | "image/webp",
      data: f.data.toString("base64"),
    },
  };
}
