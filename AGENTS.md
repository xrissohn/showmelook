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
