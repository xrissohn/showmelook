# AGENTS.md

## Shomi chat (`supabase/functions/shomi-chat`)

- Answer frequent questions from the prewritten FAQ layer (`faq.ts`) before calling the model. Only questions that match nothing, or that carry personal body info (height/weight/age), may reach the AI. Rationale: a model call costs ~10x more than a local answer.
- Keep the system prompt byte-identical for every language. Language instructions go in as a trailing message after the conversation, never inside the system prompt. Rationale: the prompt cache keys on the exact prefix, so a per-language system prompt forces one cache write per language (a write costs ~10x a read).
- Reuse earlier AI answers from `shomi_answer_cache` (trigram similarity on normalized question, per language) before calling the model; only first-turn, short, non-personal questions are stored or served. Rationale: repeat questions then cost no AI credits, and context-dependent or personal answers never leak to other users.
- New or changed files in the Google Drive knowledge folder are summarized by `shomi-knowledge-sync` (hourly cron) into `shomi_knowledge_files`; `shomi-chat` appends active notes after the static knowledge and the answer cache is cleared on change. Rationale: knowledge stays current without redeploys, and files already folded into `knowledge.ts` are marked baseline so they are not duplicated.
- Send only the most recent few turns of history from the client. Rationale: the knowledge block already dominates the input, so extra turns are pure cost.
- Keep investment/financial figures, internal operations detail, and personal contact info out of `knowledge.ts` and `faq.ts`. Rationale: the chat is public and the model will repeat what it is given.

- `shomi-chat` refuses sensitive-personal-info and non-fashion questions before the FAQ/model, and buffers each AI answer to drop any discount/coupon/refund promise not backed by an active promotion. Rationale: the chat must never contradict the service policy, so checks run in code, not only in the prompt.

## Service facts (`supabase/functions/_shared/serviceFacts.ts`)

- Tier numbers, ongoing bonuses, time-limited promotions, official service copy and the service policy list (which Shomi treats as overriding any other knowledge) live only in this file; `src/lib/tierConfig.ts`, the About and /policy pages and `shomi-chat` (knowledge + FAQ) all derive from it. Rationale: a price or promo change edited once reaches the pricing page and Shomi together.
- `shomi-chat` hashes its full system prompt and clears `shomi_answer_cache` when the hash in `shomi_meta` changes. Rationale: saved answers must never repeat outdated prices.

## Email sign-up (`supabase/functions/complete-signup`)

- Email accounts are created only on the server by `complete-signup` (admin createUser with email confirmed) after a one-time, recent `email_verifications` row is consumed; the browser never calls `auth.signUp`. Rationale: "Confirm email" stays on to block sign-ups that skip the code, while verified users still get a session.
- Account lookups by email use the service-role-only SQL function `get_auth_user_id_by_email`, never `auth.admin.listUsers()`. Rationale: listUsers is paginated and silently misses users beyond the first page.
- Auth functions always return `error_code` (plus the legacy `error` string); the client shows text from `src/lib/authErrors.ts`, never raw server text. Password rules live in `src/lib/passwordPolicy.ts` and `_shared/passwordPolicy.ts` and must match the auth server's policy. Rationale: one translated message set, and old clients keep working.
