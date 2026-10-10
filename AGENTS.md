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

## Look feedback and learning (`submit-look-feedback`, `feedback-learning-report`)

- Each generated look can get a rating (좋아요 / 보통 / 별로예요) and an optional free-text comment. Writes go only through `submit-look-feedback` (service role); users can read just their own `look_feedback` rows. Rationale: moderation status and admin decisions must not be user-writable.
- Comments are moderated by rules plus AI (`_shared/feedbackLearning.ts`). Sensitive ones (sexual, religious, political, hateful, violent, illegal, personal info, profanity, spam) are held as `flagged`: never used for learning, never shown to other users, and decided by an admin in Admin → 피드백·학습 (approve = usable from the next run, reject = excluded). The user is not told the result. Report emails carry category counts only, never the raw comment text. Fashion critique ("노출이 많아요", "누드톤") must not be flagged.
- Thumbs up/down also write `product_feedback` (`style_like` / `style_dislike`, re-written per look so nothing is double counted); the score trigger counts them, so `product_feedback_scores` and the ranking learn from them. A user's own feedback additionally feeds a per-user taste profile (`_shared/tasteProfile.ts`) in `style-recommend` and the loading ads.
- `feedback-learning-report` (pg_cron once a day; throttled to once per 6 hours; does nothing without new feedback) summarizes usable comments into `recommendation_insights` (active by default, admins can switch any off). `style-recommend` appends active insights to the stage-2 prompt as reference only; the user's current request always wins. Each run saves a `feedback_reports` row and emails it via `admin_email_outbox` to admin users plus `FEEDBACK_REPORT_EMAILS`.
- `feedback-learning-report` creates recommendation insights only from usable comments of the last 14 days, and only when there are at least 5 of them from at least 3 different users (below that the report is still saved, with `insightsSkipped`). Rationale: one user's comment must never steer every user's recommendations.
- Comments flagged as personal info are stored redacted (`redactPersonalInfo`), and re-sending the same comment keeps the admin's earlier decision. Admins read flagged comments through `admin_flagged_look_feedback()` (security definer), not by selecting the moderation columns. Rationale: users must not see moderation results, and raw phone numbers must not sit in the table.
- `feedback-learning-report` accepts only the daily cron (`x-cron-token` header, matched against the service-role-only `internal_cron_tokens` table; the cron command reads the token from that table, never embeds it), the service role key and admin users; everything else gets 401. Rationale: any signed-in user could otherwise trigger real reports and admin emails early.
- Loading ads while generating are ranked per user (`src/lib/adPersonalization.ts`: feedback, liked products, profile style preferences, the current request, budget) with brand/category caps and exploration slots so tastes do not lock in. Disliked products never appear.

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
- The user's requested look always wins over the profile gender and the on-screen selection: the clothing gender in the request text (`detectRequestedClothingGender` in `_shared/productFilters.ts`: 남성복·여성복, 원피스 and other gendered items, 젠더리스/유니섹스, 여장/남장, gift recipients; `resolveClothingGender`) is applied in `style-recommend` (filters, prompts, cache key; response `appliedGender`) and on the style page (`requestGender` → ads, alternatives, history). Kids mode is never overridden; the profile gender only describes the model's body in `generate-style`. Rationale: what someone wants to wear is their taste, not their profile.


## One-off service emails (`supabase/functions/send-outbox-email`)

- To send a single service email (support notice, apology, account fix) from `noreply@showmelook.com`, insert a row into `admin_email_outbox` (service role / SQL only: `to_email`, `subject`, `html`, optional `text_body`, `reply_to`, `note`), then POST to `send-outbox-email` (for example with `net.http_post` from SQL). The function sends pending rows via Resend and writes back `status`, `provider_id` or `error`. Rationale: lets support mail go out from the service address without anyone handling the Resend key.
- The endpoint is public (`verify_jwt = false`) but takes nothing from the request: it only sends rows already queued with database access, at most 5 per call, and answers with counts only. Rows are claimed atomically (`claim_admin_email_outbox`), so overlapping calls never send twice. Use `reply_to: contact@showmelook.com` when the text invites a reply.

## Base44 dev environment

- The app is a Vite + React frontend that connects to a remote Supabase instance. No local database is needed — the backend is hosted Supabase. The browser-safe Supabase credentials (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) are in the repo's `.env` file and loaded automatically by Vite.
- Vite 5.4.19 includes the `allowedHosts` security check (CVE-2025-31125 backport) and does NOT read the `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` env var (that's Vite 6.1+ only). Without configuration, the preview proxy's Host header gets a 403. The fix in `vite.config.ts` conditionally adds `allowedHosts: ['.${BASE44_SANDBOX_HOST_DOMAIN}']` when `BASE44_PREVIEW_MODE === "1"`. When the flag is unset or any other value, the original behavior is preserved.
- The dev server runs on port 8080 inside the container, mapped to host port 3000 via `docker-compose.base44.yml`. Dependencies are installed with `npm ci` on container startup (node_modules in an anonymous volume).
