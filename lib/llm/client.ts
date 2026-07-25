import Anthropic from "@anthropic-ai/sdk";

/**
 * Single shared source for the Anthropic model id used by every LLM-edge
 * module (extract.ts, ecg.ts, sbar.ts). If a model id ever needs correcting,
 * change it here — nowhere else hardcodes one.
 *
 * `claude-sonnet-5` is confirmed as of this writing (per
 * platform.claude.com/docs/en/about-claude/models/overview and
 * .../models/whats-new-sonnet-5, and reflected in the installed
 * @anthropic-ai/sdk@0.115.0 `Model` union type) to be the current, GA,
 * dateless canonical Claude API model id — not an alias that silently
 * repoints, and not a guess. `ANTHROPIC_MODEL` overrides this without a
 * redeploy if that ever changes.
 */
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";

export function getAnthropicModel(): string {
  const override = process.env.ANTHROPIC_MODEL?.trim();
  return override && override.length > 0 ? override : DEFAULT_ANTHROPIC_MODEL;
}

/**
 * Constructs a real Anthropic client, or null if ANTHROPIC_API_KEY is
 * absent. Never throws — callers (extract.ts, ecg.ts, sbar.ts) treat null
 * as "Claude unavailable" and degrade to a safe empty/neutral result rather
 * than crash, so a teammate without an API key can still run `npm run dev`.
 *
 * Every LLM-edge module accepts this client as an injectable dependency
 * (default parameter) precisely so unit tests can supply a fake and never
 * make a real network call.
 */
export function createAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn(
      "[llm] ANTHROPIC_API_KEY is not set — Claude calls are disabled and callers will receive a null client.",
    );
    return null;
  }

  return new Anthropic({ apiKey });
}
