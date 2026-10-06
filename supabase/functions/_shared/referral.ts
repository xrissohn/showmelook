// Applies a referral code for a freshly created user (same rules as apply-referral-code).
// deno-lint-ignore no-explicit-any
type Admin = any;

export type ReferralResult =
  | { applied: true; reward_type: "profile_slot" | "bonus_credits" }
  | { applied: false; reason: string };

export async function applyReferralForNewUser(
  supabase: Admin,
  newUserId: string,
  rawCode: string,
  newUserName: string,
): Promise<ReferralResult> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9_]{4,32}$/.test(code)) return { applied: false, reason: "invalid_code" };

  const { data: codeData } = await supabase
    .from("referral_codes").select("*").eq("code", code).eq("is_active", true).maybeSingle();
  if (!codeData) return { applied: false, reason: "invalid_code" };
  if (codeData.user_id === newUserId) return { applied: false, reason: "self_referral" };
  if (codeData.used_count >= codeData.max_uses) return { applied: false, reason: "max_uses" };

  const { data: existing } = await supabase
    .from("referral_rewards").select("id").eq("referee_user_id", newUserId).maybeSingle();
  if (existing) return { applied: false, reason: "already_used" };

  const { data: sub } = await supabase
    .from("user_subscriptions").select("plan").eq("user_id", codeData.user_id).maybeSingle();
  const rewardType = (sub?.plan || "free") === "premium" ? "profile_slot" : "bonus_credits";
  const isPermanent = rewardType === "profile_slot";
  const in30d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error: refErr } = await supabase.from("referral_rewards").insert({
    referrer_user_id: codeData.user_id,
    referee_user_id: newUserId,
    referral_code: code,
    reward_type: rewardType,
    amount: rewardType === "bonus_credits" ? 5 : 1,
    remaining_amount: rewardType === "bonus_credits" ? 5 : 1,
    expires_at: isPermanent ? null : in30d,
    is_permanent: isPermanent,
    is_active: true,
  });
  if (refErr) {
    console.error("referrer reward error", refErr);
    return { applied: false, reason: "server_error" };
  }

  const { error: welcomeErr } = await supabase.from("referral_rewards").upsert({
    referrer_user_id: newUserId,
    referee_user_id: codeData.user_id,
    referral_code: `WELCOME_${code}`,
    reward_type: "bonus_credits",
    amount: 5,
    remaining_amount: 5,
    expires_at: in30d,
    is_permanent: false,
    is_active: true,
  }, { onConflict: "referee_user_id", ignoreDuplicates: true });
  if (welcomeErr) console.error("referee reward error", welcomeErr);

  await supabase.from("referral_codes").update({ used_count: codeData.used_count + 1 }).eq("id", codeData.id);

  try {
    const { data: profile } = await supabase
      .from("profiles").select("full_name").eq("user_id", codeData.user_id).maybeSingle();
    const { data: refAuth } = await supabase.auth.admin.getUserById(codeData.user_id);
    const referrerEmail = refAuth?.user?.email;
    if (referrerEmail) {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-referral-success-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          referrer_email: referrerEmail,
          referrer_name: profile?.full_name || "회원",
          referee_name: newUserName || "새 회원",
          reward_type: rewardType,
        }),
      });
    }
  } catch (e) {
    console.error("referral email failed", e);
  }

  return { applied: true, reward_type: rewardType };
}
