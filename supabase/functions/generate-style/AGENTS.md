## Look generation (`supabase/functions/generate-style`)

- When the client sends `saveLook: true` (with `lookMeta`), the function inserts the `generated_looks` row itself right after the image upload and usage count, and returns `lookId`; the client only inserts when `lookId` is missing. Rationale: a refresh, closed tab or back press during the ~70-second generation used to keep the credit but lose the look.
- Daily usage is incremented with the service-role-only SQL function `increment_daily_generation_usage` (one atomic upsert). Rationale: read-then-write lost counts when two tabs generated at once.
- For signed-in users an image-upload failure returns an error (`UPLOAD_ERROR`, no credit counted) instead of an unsaved inline image; the Cafe24 widget keeps the inline fallback.
- The style page keeps a `sml_pending_generation` marker in sessionStorage while generating; on reload it restores the prompt and opens the look the server saved meanwhile.
