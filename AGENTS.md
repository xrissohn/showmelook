# AGENTS.md

## Shomi chat (`supabase/functions/shomi-chat`)

- Answer frequent questions from the prewritten FAQ layer (`faq.ts`) before calling the model. Only questions that match nothing, or that carry personal body info (height/weight/age), may reach the AI. Rationale: a model call costs ~10x more than a local answer.
- Keep the system prompt byte-identical for every language. Language instructions go in as a trailing message after the conversation, never inside the system prompt. Rationale: the prompt cache keys on the exact prefix, so a per-language system prompt forces one cache write per language (a write costs ~10x a read).
- Reuse earlier AI answers from `shomi_answer_cache` (trigram similarity on normalized question, per language) before calling the model; only first-turn, short, non-personal questions are stored or served. Rationale: repeat questions then cost no AI credits, and context-dependent or personal answers never leak to other users.
- New or changed files in the Google Drive knowledge folder are summarized by `shomi-knowledge-sync` (hourly cron) into `shomi_knowledge_files`; `shomi-chat` appends active notes after the static knowledge and the answer cache is cleared on change. Rationale: knowledge stays current without redeploys, and files already folded into `knowledge.ts` are marked baseline so they are not duplicated.
- Send only the most recent few turns of history from the client. Rationale: the knowledge block already dominates the input, so extra turns are pure cost.
- Keep investment/financial figures, internal operations detail, and personal contact info out of `knowledge.ts` and `faq.ts`. Rationale: the chat is public and the model will repeat what it is given.
