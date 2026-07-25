import type Anthropic from "@anthropic-ai/sdk";

/**
 * Builds a fully-typed, minimal-but-valid `Anthropic.Message` for tests, so
 * response-parsing logic can be exercised against realistic fixture objects
 * without ever calling the network. Only `content` varies per test; every
 * other field is filled with a representative constant.
 */
export function fixtureMessage(content: Anthropic.ContentBlock[]): Anthropic.Message {
  return {
    id: "msg_fixture_0001",
    container: null,
    content,
    model: "claude-sonnet-5",
    role: "assistant",
    stop_details: null,
    stop_reason: content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn",
    stop_sequence: null,
    type: "message",
    usage: {
      cache_creation: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      inference_geo: null,
      input_tokens: 100,
      output_tokens: 50,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: "standard",
    },
  };
}

export function fixtureToolUseBlock(name: string, input: unknown): Anthropic.ToolUseBlock {
  return {
    type: "tool_use",
    id: "toolu_fixture_0001",
    name,
    input,
    caller: { type: "direct" },
  };
}

export function fixtureTextBlock(text: string): Anthropic.TextBlock {
  return { type: "text", text, citations: null };
}
