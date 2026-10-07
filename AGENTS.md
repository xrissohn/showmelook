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
- Pricing is a purchase-tier system (tier rises with cumulative purchase amount), never a subscription: no plans, billing cycles or `user_subscriptions` logic. Benefits are computed from the purchase tier only (`src/lib/tierBenefits.ts`, `useTierBenefits`); do not reintroduce a plan table. Rationale: a second, subscription-based source left paying tiers on free behavior (watermark, recommend-first, queue priority).
- Only advertise perks that are actually enforced: daily generations, watermark removal (Bronze+), recommend-first (Silver+), extra model profiles and priority queue (Platinum). `monthlyLimit`, `galleryLimit`, `hdDownload` and `historyDays` in `TIER_FACTS` are NOT enforced, so no page, tier card or Shomi answer may mention them until enforcement exists (`src/lib/serviceFacts.test.ts` guards this). Rationale: the chat and pricing page must never promise what the service does not do.

## Email sign-up (`supabase/functions/complete-signup`)

- Email accounts are created only on the server by `complete-signup` (admin createUser with email confirmed) after a one-time, recent `email_verifications` row is consumed; the browser never calls `auth.signUp`. Rationale: "Confirm email" stays on to block sign-ups that skip the code, while verified users still get a session.
- Account lookups by email use the service-role-only SQL function `get_auth_user_id_by_email`, never `auth.admin.listUsers()`. Rationale: listUsers is paginated and silently misses users beyond the first page.
- Auth functions always return `error_code` (plus the legacy `error` string); the client shows text from `src/lib/authErrors.ts`, never raw server text. Password rules live in `src/lib/passwordPolicy.ts` and `_shared/passwordPolicy.ts` and must match the auth server's policy. Rationale: one translated message set, and old clients keep working.

## Look generation (`supabase/functions/generate-style`)

- When the client sends `saveLook: true` (with `lookMeta`), the function inserts the `generated_looks` row itself right after the image upload and usage count, and returns `lookId`; the client only inserts when `lookId` is missing. Rationale: a refresh, closed tab or back press during the ~70-second generation used to keep the credit but lose the look.
- Daily usage is incremented with the service-role-only SQL function `increment_daily_generation_usage` (one atomic upsert). Rationale: read-then-write lost counts when two tabs generated at once.
- For signed-in users an image-upload failure returns an error (`UPLOAD_ERROR`, no credit counted) instead of an unsaved inline image; the Cafe24 widget keeps the inline fallback.
- The style page keeps a `sml_pending_generation` marker in sessionStorage while generating; on reload it restores the prompt and opens the look the server saved meanwhile.

## Budget (`supabase/functions/style-recommend`)

- The budget is read from the request text (`parseBudgetFromRequest`: "20만원", "예산 20만", "10~20만원", "200,000원", "200k won"…). A `budget` field from the client is used only with `budgetIsExplicit: true`. Rationale: the page always sent 200000, so every row looked like a 200,000-won budget that was never applied.
- With a budget: per-category price caps on stage-2 candidates, a "total ≤ N원" rule in the stage-2 prompt, then a swap loop (most expensive item → cheaper item of the same `item_slot`, up to 6 rounds); after a swap the reasoning is rebuilt from the final products. The response carries `budget`, `overBudget`, `budgetAdjusted`; `recommendation_history.budget` stores the stated budget or NULL.
- Affiliate links are created once, in parallel, after the final products are fixed.


## One-off service emails (`supabase/functions/send-outbox-email`)

- To send a single service email (support notice, apology, account fix) from `noreply@showmelook.com`, insert a row into `admin_email_outbox` (service role / SQL only: `to_email`, `subject`, `html`, optional `text_body`, `reply_to`, `note`), then POST to `send-outbox-email` (for example with `net.http_post` from SQL). The function sends pending rows via Resend and writes back `status`, `provider_id` or `error`. Rationale: lets support mail go out from the service address without anyone handling the Resend key.
- The endpoint is public (`verify_jwt = false`) but takes nothing from the request: it only sends rows already queued with database access, at most 5 per call, and answers with counts only. Rows are claimed atomically (`claim_admin_email_outbox`), so overlapping calls never send twice. Use `reply_to: contact@showmelook.com` when the text invites a reply.
