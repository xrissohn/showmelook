// Sends one-off service emails queued in public.admin_email_outbox, from
// noreply@showmelook.com via Resend.
//
// Anyone may call this endpoint (verify_jwt = false): it never takes a recipient
// or content from the request. It only sends rows that were already queued with
// service-role / database access, and it answers with counts only.
//
// Queue an email (SQL, service role):
//   insert into public.admin_email_outbox (to_email, subject, html, text_body, reply_to, note)
//   values (...);
// then POST to /functions/v1/send-outbox-email (e.g. with pg_net's net.http_post).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM = "쇼미룩 <noreply@showmelook.com>";
const MAX_ATTEMPTS = 3;
const BATCH = 5;

type OutboxRow = {
  id: string;
  to_email: string;
  subject: string;
  html: string;
  text_body: string | null;
  reply_to: string | null;
  attempts: number;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return json({ error: "Email is not configured" }, 500);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await admin.rpc("claim_admin_email_outbox", { _limit: BATCH });
  if (error) {
    console.error("send-outbox-email: claim failed", error.message);
    return json({ error: "Could not read the outbox" }, 500);
  }

  const rows = (data ?? []) as OutboxRow[];
  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    let failure: string | null = null;
    let providerId: string | null = null;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [row.to_email],
          subject: row.subject,
          html: row.html,
          ...(row.text_body ? { text: row.text_body } : {}),
          ...(row.reply_to ? { reply_to: row.reply_to } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) providerId = typeof body?.id === "string" ? body.id : null;
      else failure = String(body?.message ?? `HTTP ${res.status}`);
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
    }

    if (failure === null) {
      sent++;
      await admin
        .from("admin_email_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString(), provider_id: providerId, error: null })
        .eq("id", row.id);
    } else {
      failed++;
      console.error("send-outbox-email: send failed", row.id, failure);
      // attempts was already incremented by the claim; retry later until MAX_ATTEMPTS.
      await admin
        .from("admin_email_outbox")
        .update({ status: row.attempts >= MAX_ATTEMPTS ? "failed" : "pending", error: failure.slice(0, 500) })
        .eq("id", row.id);
    }
  }

  return json({ processed: rows.length, sent, failed });
});
