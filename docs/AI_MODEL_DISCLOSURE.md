# AI Model and Tool Disclosure

Last reviewed: 2026-07-17

## Contest reference scope: ShowMeLook MCP

The contest-ready core in `src/lib/mcp` does **not** embed, fine-tune, or train an AI model. It is a model-agnostic MCP connector that exposes three read-only tools over product and public-look data. The host AI client is selected and operated by the user; the connector itself does not call a model API.

| Item | Disclosure |
|---|---|
| AI development type | Not applicable; no embedded, fine-tuned, or self-trained model |
| Model weights | Not applicable |
| Training data | Not applicable |
| Inference code | MCP tool handlers in `src/lib/mcp` |
| Source license | MIT |
| Key dependencies | `@lovable.dev/mcp-js` (MIT), `@supabase/supabase-js` (MIT), `zod` (MIT) |

This scope is intended to align with the competition rule that permits MCP, connector, and plug-in software that builds an AI integration ecosystem. Final eligibility remains subject to the organizer's interpretation.

## Optional hosted demo routes

The full hosted ShowMeLook application contains optional style recommendation, image analysis, and image generation routes that call commercial models through the Lovable AI Gateway. Source references currently include Google Gemini and OpenAI GPT model identifiers.

These API-only model routes are **not presented as open-weight models** and are excluded from the contest reference scope. They should not be claimed as satisfying the competition's open-weight requirement. A future contest submission that makes these routes part of its evaluated core must replace them with independently runnable open-weight models and document each model's weights, license, source, and runtime.

## AI-assisted development

Repository history indicates extensive Lovable/gpt-engineer-assisted generation and editing. Open-source documentation and contest-readiness changes were additionally prepared with OpenAI Codex. AI output is treated as draft code or text: the maintainer is responsible for reviewing behavior, licenses, security, and accuracy before release or submission.

No reliable percentage of AI-authored source is asserted because the history does not provide an auditable line-level attribution method.
