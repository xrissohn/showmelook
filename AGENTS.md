# AGENTS.md

Subdirectories under `supabase/functions/` have their own `AGENTS.md`; read it before changing files there.
<!-- LOVABLE:BEGIN -->
## Pitch
- Keep dated catalog counts and proposed roadmap stages in `src/lib/pitchFacts.ts`, distinguishing total, active and DNA counts. Why: all slides need a verified baseline, not implied live counts or guaranteed dates.
- Derive pitch membership benefits from shared service facts. Why: pitch copy must not promise different or unenforced benefits.
<!-- LOVABLE:END -->
## Service facts (`supabase/functions/_shared/serviceFacts.ts`)

- Tier numbers, ongoing bonuses, time-limited promotions, official service copy and the service policy list (which Shomi treats as overriding any other knowledge) live only in this file; `src/lib/tierConfig.ts`, the About and /policy pages and `shomi-chat` (knowledge + FAQ) all derive from it. Rationale: a price or promo change edited once reaches the pricing page and Shomi together.
- `shomi-chat` hashes its full system prompt and clears `shomi_answer_cache` when the hash in `shomi_meta` changes. Rationale: saved answers must never repeat outdated prices.
- Pricing is a purchase-tier system (tier rises with cumulative purchase amount), never a subscription: no plans, billing cycles or `user_subscriptions` logic. Benefits are computed from the purchase tier only (`src/lib/tierBenefits.ts`, `useTierBenefits`); do not reintroduce a plan table. Rationale: a second, subscription-based source left paying tiers on free behavior (watermark, recommend-first, queue priority).
- Only advertise perks that are actually enforced: daily generations, watermark removal (Bronze+), recommend-first (Silver+), extra model profiles and priority queue (Platinum). `monthlyLimit`, `galleryLimit`, `hdDownload` and `historyDays` in `TIER_FACTS` are NOT enforced, so no page, tier card or Shomi answer may mention them until enforcement exists (`src/lib/serviceFacts.test.ts` guards this). Rationale: the chat and pricing page must never promise what the service does not do.

## Personal color (`analyze-personal-color`, `_shared/personalColor.ts`, `/personal-color`)

- Tone rules (seasons, reference palettes, AI-result validation, soft recommendation bonus) live only in `_shared/personalColor.ts`, used by the edge functions and the web app. Rationale: one definition for analysis, UI and recommendation.
- `analyze-personal-color` requires sign-in and explicit consent, caps non-admins per day via `increment_personal_color_usage`, forwards the photo only to the AI gateway and never stores or logs it; malformed AI output is an error, never a filled-in result. Rationale: cost/abuse control and privacy.
- `profiles.personal_color` belongs to the main user only; `style-recommend` reads it from the verified user's row only when the client sends `applyPersonalColor: true` (never for family profiles). Explicit colors or photo requests switch the tone to prompt-reference only; product colors are never altered. Rationale: the user's request always wins and family models stay separate.

## Look feedback and learning (`submit-look-feedback`, `feedback-learning-report`)

- Each generated look can get a rating (좋아요 / 보통 / 별로예요) and an optional free-text comment. Writes go only through `submit-look-feedback` (service role); users can read just their own `look_feedback` rows. Rationale: moderation status and admin decisions must not be user-writable.
- Comments are moderated by rules plus AI (`_shared/feedbackLearning.ts`). Sensitive ones (sexual, religious, political, hateful, violent, illegal, personal info, profanity, spam) are held as `flagged`: never used for learning, never shown to other users, and decided by an admin in Admin → 피드백·학습 (approve = usable from the next run, reject = excluded). The user is not told the result. Report emails carry category counts only, never the raw comment text. Fashion critique ("노출이 많아요", "누드톤") must not be flagged.
- Thumbs up/down also write `product_feedback` (`style_like` / `style_dislike`, re-written per look so nothing is double counted); the score trigger counts them, so `product_feedback_scores` and the ranking learn from them. A user's own feedback additionally feeds a per-user taste profile (`_shared/tasteProfile.ts`) in `style-recommend` and the loading ads.
- `feedback-learning-report` (pg_cron once a day; throttled to once per 6 hours; does nothing without new feedback) summarizes usable comments into `recommendation_insights` (active by default, admins can switch any off). `style-recommend` appends active insights to the stage-2 prompt as reference only; the user's current request always wins. Each run saves a `feedback_reports` row and emails it via `admin_email_outbox` to admin users plus `FEEDBACK_REPORT_EMAILS`.
- `feedback-learning-report` creates recommendation insights only from usable comments of the last 14 days, and only when there are at least 5 of them from at least 3 different users (below that the report is still saved, with `insightsSkipped`). Rationale: one user's comment must never steer every user's recommendations.
- Comments flagged as personal info are stored redacted (`redactPersonalInfo`), and re-sending the same comment keeps the admin's earlier decision. Admins read flagged comments through `admin_flagged_look_feedback()` (security definer), not by selecting the moderation columns. Rationale: users must not see moderation results, and raw phone numbers must not sit in the table.
- `feedback-learning-report` accepts only the daily cron (`x-cron-token` header, matched against the service-role-only `internal_cron_tokens` table; the cron command reads the token from that table, never embeds it), the service role key and admin users; everything else gets 401. Rationale: any signed-in user could otherwise trigger real reports and admin emails early.
- Loading ads while generating are ranked per user (`src/lib/adPersonalization.ts`: feedback, liked products, profile style preferences, the current request, budget) with brand/category caps and exploration slots so tastes do not lock in. Disliked products never appear.

## Cross-function rules

- Shared-look search data is built in `src/lib/sharedLookSearchData.ts` as an editorial ItemList of merchant links, never Product/Offer data. Why: affiliate outfit pages do not sell products or establish merchant shipping, returns or stock.

- The user's requested look always wins over the profile gender and the on-screen selection: the clothing gender in the request text (`detectRequestedClothingGender` in `_shared/productFilters.ts`: 남성복·여성복, 원피스 and other gendered items, 젠더리스/유니섹스, 여장/남장, gift recipients; `resolveClothingGender`) is applied in `style-recommend` (filters, prompts, cache key; response `appliedGender`) and on the style page (`requestGender` → ads, alternatives, history). Kids mode is never overridden; the profile gender only describes the model's body in `generate-style`. Rationale: what someone wants to wear is their taste, not their profile.
- Auth functions always return `error_code` (plus the legacy `error` string); the client shows text from `src/lib/authErrors.ts`, never raw server text. Password rules live in `src/lib/passwordPolicy.ts` and `_shared/passwordPolicy.ts` and must match the auth server's policy. Rationale: one translated message set, and old clients keep working.
