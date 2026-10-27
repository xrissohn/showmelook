// Photo-based personal color estimate for the signed-in user.
// The photo is forwarded to the AI gateway only for this request: it is never stored or logged.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAnalysis, SEASONS, RETAKE_REASONS } from "../_shared/personalColor.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAILY_LIMIT = 5;
const MAX_BASE64 = 7_000_000; // ~5MB
const MODEL = "google/gemini-3.8-flash";
// The page gives up after 60s; stop the AI call shortly before so abandoned requests do not pile up.
const AI_TIMEOUT_MS = 55_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM_PROMPT = `You estimate a person's seasonal personal color (spring_warm, summer_cool, autumn_warm, winter_cool) from ONE photo, for fashion color suggestions only.
Rules:
- First check photo quality. Return status "retake" if: no clearly visible face (no_face), more than one face (multiple_faces), strong colored/tinted lighting (strong_color_light), beauty filter or heavy makeup hiding natural skin tone (filter_or_heavy_makeup), too dark (too_dark), blurry/low resolution (blurry), face mostly covered (face_covered).
- Only judge visible color qualities: skin undertone (warm/yellow vs cool/pink), hair and eye color depth, and overall contrast. Describe them in plain color terms.
- NEVER infer or mention ethnicity, race, nationality, age, health, attractiveness or any other personal attribute.
- Never give accuracy percentages. confidence is one of low/medium/high and must be low when lighting is uncertain.
- palette: 6 flattering clothing colors as {name, hex}. avoid: 3 colors to keep away from the face as {name, hex}.
- tips: 3 short practical styling tips. Write summary and tips in the requested language.
Reply with JSON only:
{"status":"ok"|"retake","retake_reasons":[...],"season":"...","confidence":"low|medium|high","summary":"1-2 sentences about the visible color qualities","palette":[{"name":"","hex":"#RRGGBB"}],"avoid":[{"name":"","hex":"#RRGGBB"}],"tips":["..."]}
Allowed seasons: ${SEASONS.join(", ")}. Allowed retake_reasons: ${RETAKE_REASONS.join(", ")}.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error_code: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ success: false, error_code: "auth_required" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    let userId: string | undefined;
    const { data: userData } = await anon.auth.getUser(token);
    userId = userData?.user?.id;
    if (!userId) {
      const { data: claimsData } = await anon.auth.getClaims(token);
      userId = claimsData?.claims?.sub as string | undefined;
    }
    if (!userId) return json({ success: false, error_code: "auth_required" }, 401);

    let body: { image_data?: unknown; language?: unknown; consent?: unknown };
    try { body = await req.json(); } catch { return json({ success: false, error_code: "invalid_request" }, 400); }
    if (body.consent !== true) return json({ success: false, error_code: "consent_required" }, 400);
    const imageData = typeof body.image_data === "string" ? body.image_data : "";
    const match = imageData.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return json({ success: false, error_code: "invalid_image" }, 400);
    if (match[2].length > MAX_BASE64) return json({ success: false, error_code: "image_too_large" }, 400);
    const language = body.language === "en" ? "en" : "ko";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ success: false, error_code: "not_configured" }, 500);

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: count, error: usageErr } = await admin.rpc("increment_personal_color_usage", { _user_id: userId, _usage_date: today });
      if (usageErr) return json({ success: false, error_code: "server_error" }, 500);
      if ((count as number) > DAILY_LIMIT) return json({ success: false, error_code: "daily_limit", limit: DAILY_LIMIT }, 429);
    }

    const aiAbort = new AbortController();
    const aiTimer = setTimeout(() => aiAbort.abort(), AI_TIMEOUT_MS);
    let aiRes: Response;
    try {
    aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: aiAbort.signal,
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: `Analyze this photo and reply in JSON. Language for summary and tips: ${language === "en" ? "English" : "Korean"}.` },
              { type: "image_url", image_url: { url: imageData } },
            ],
          },
        ],
        max_tokens: 1200,
      }),
    });
    } catch (fetchErr) {
      clearTimeout(aiTimer);
      if (aiAbort.signal.aborted) return json({ success: false, error_code: "timeout" }, 504);
      throw fetchErr;
    }

    if (!aiRes.ok) {
      clearTimeout(aiTimer);
      console.error(`[analyze-personal-color] gateway status ${aiRes.status}`); // no photo, no body
      if (aiRes.status === 429) return json({ success: false, error_code: "busy" }, 429);
      if (aiRes.status === 402 || aiRes.status === 403) return json({ success: false, error_code: "ai_unavailable" }, 503);
      return json({ success: false, error_code: "ai_error" }, 502);
    }

    let result: any;
    try { result = await aiRes.json(); }
    catch { clearTimeout(aiTimer); return json({ success: false, error_code: aiAbort.signal.aborted ? "timeout" : "analysis_failed" }, aiAbort.signal.aborted ? 504 : 502); }
    clearTimeout(aiTimer);
    const text: string = result.choices?.[0]?.message?.content?.trim() ?? "";
    let parsed: unknown = null;
    try {
      const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
      parsed = m ? JSON.parse(m[1]) : null;
    } catch { parsed = null; }

    const outcome = validateAnalysis(parsed);
    console.log(`[analyze-personal-color] outcome=${outcome.kind}`);
    if (outcome.kind === "invalid") return json({ success: false, error_code: "analysis_failed" }, 502);
    if (outcome.kind === "retake") return json({ success: true, status: "retake", reasons: outcome.reasons });
    return json({ success: true, status: "ok", result: outcome.result });
  } catch (e) {
    console.error("[analyze-personal-color] error", e instanceof Error ? e.message : "unknown");
    return json({ success: false, error_code: "server_error" }, 500);
  }
});
