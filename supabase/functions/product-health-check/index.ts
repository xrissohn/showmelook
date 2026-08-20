import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 100;
const MAX_ITERATIONS_PER_CALL = 5; // ~500 products per invocation (fits in ~50s)
const HEAD_TIMEOUT = 5000;
const CONCURRENCY = 10;

interface SingleCheckRequest {
  url: string;
  productId: string;
}

async function checkUrl(url: string): Promise<{ alive: boolean; status: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEAD_TIMEOUT);

  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    const dead = [404, 410].includes(res.status) || res.status >= 500;
    return { alive: !dead, status: res.status };
  } catch {
    clearTimeout(timeout);

    const controller2 = new AbortController();
    const timeout2 = setTimeout(() => controller2.abort(), HEAD_TIMEOUT);
    try {
      const res = await fetch(url, {
        method: "GET",
        signal: controller2.signal,
        redirect: "follow",
        headers: { Range: "bytes=0-0" },
      });
      clearTimeout(timeout2);
      await res.text();
      const dead = [404, 410].includes(res.status) || res.status >= 500;
      return { alive: !dead, status: res.status };
    } catch {
      clearTimeout(timeout2);
      return { alive: true, status: 0 };
    }
  }
}

// Auth helper: require admin user OR service-role key
async function requireAdminOrService(
  req: Request,
  supabaseUrl: string,
  serviceKey: string,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const authHeader = req.headers.get("Authorization") || "";
  const deny = (msg: string, status: number) => ({
    ok: false as const,
    response: new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }),
  });

  if (!authHeader.startsWith("Bearer ")) return deny("Unauthorized", 401);
  const token = authHeader.replace("Bearer ", "").trim();
  if (token === serviceKey) return { ok: true };

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  let userId: string | null = claimsData?.claims?.sub ?? null;
  if (claimsError || !userId) {
    const { data: { user } } = await userClient.auth.getUser();
    userId = user?.id ?? null;
  }
  if (!userId) return deny("Unauthorized", 401);

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: role } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) return deny("Admin access required", 403);

  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const auth = await requireAdminOrService(req, supabaseUrl, serviceRoleKey);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();

    // === Single-item check (Layer 2) ===
    if (body.url && body.productId) {
      const { productId } = body as SingleCheckRequest;

      // Never fetch a caller-supplied URL (SSRF): always use the stored product_url
      const { data: product, error: productError } = await supabase
        .from("products_cache")
        .select("id, product_url")
        .eq("id", productId)
        .maybeSingle();

      if (productError || !product?.product_url) {
        return new Response(
          JSON.stringify({ error: "Product not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const result = await checkUrl(product.product_url);

      if (!result.alive) {
        const { error } = await supabase
          .from("products_cache")
          .delete()
          .eq("id", productId);

        return new Response(
          JSON.stringify({
            alive: false,
            status: result.status,
            deleted: !error,
            message: "상품이 더 이상 판매되지 않아 삭제되었습니다.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ alive: true, status: result.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === Batch check (Layer 3) with auto-chain ===
    if (body.batch === true) {
      const offset = body.offset ?? 0;
      const cumulativeChecked = body.cumulativeChecked ?? 0;
      const cumulativeDeleted = body.cumulativeDeleted ?? 0;

      let totalChecked = 0;
      let totalDeleted = 0;
      let iteration = 0;
      let hasMore = false;

      while (iteration < MAX_ITERATIONS_PER_CALL) {
        iteration++;
        const rangeStart = offset + (iteration - 1) * BATCH_SIZE;
        const rangeEnd = rangeStart + BATCH_SIZE - 1;

        const { data: products, error } = await supabase
          .from("products_cache")
          .select("id, product_url")
          .eq("is_active", true)
          .range(rangeStart, rangeEnd);

        if (error) {
          console.error("Query error:", error);
          break;
        }

        if (!products || products.length === 0) break;

        const deadIds: string[] = [];

        for (let i = 0; i < products.length; i += CONCURRENCY) {
          const chunk = products.slice(i, i + CONCURRENCY);
          const results = await Promise.allSettled(
            chunk.map(async (p) => {
              const result = await checkUrl(p.product_url);
              return { id: p.id, alive: result.alive };
            })
          );

          for (const r of results) {
            if (r.status === "fulfilled" && !r.value.alive) {
              deadIds.push(r.value.id);
            }
          }
        }

        totalChecked += products.length;

        if (deadIds.length > 0) {
          const { error: delError } = await supabase
            .from("products_cache")
            .delete()
            .in("id", deadIds);

          if (!delError) {
            totalDeleted += deadIds.length;
          }
        }

        console.log(
          `Batch offset=${rangeStart}: checked=${products.length}, dead=${deadIds.length}`
        );

        if (products.length < BATCH_SIZE) {
          break;
        }

        // If this is the last iteration of this call, there's more to process
        if (iteration === MAX_ITERATIONS_PER_CALL) {
          hasMore = true;
        }
      }

      const grandChecked = cumulativeChecked + totalChecked;
      const grandDeleted = cumulativeDeleted + totalDeleted;
      const startTime = body.startTime ?? Date.now();

      // Auto-chain: self-invoke for remaining products
      if (hasMore) {
        const nextOffset = offset + iteration * BATCH_SIZE;
        console.log(
          `Self-chaining: nextOffset=${nextOffset}, checked so far=${grandChecked}, deleted so far=${grandDeleted}`
        );

        // Fire-and-forget: don't await to avoid cascading timeout
        fetch(`${supabaseUrl}/functions/v1/product-health-check`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            batch: true,
            offset: nextOffset,
            cumulativeChecked: grandChecked,
            cumulativeDeleted: grandDeleted,
            startTime,
            runType: body.runType || "batch",
          }),
        }).catch((e) => console.error("Chain invoke error:", e));
      } else {
        // Final chain — log to health_check_logs
        const durationSeconds = Math.round((Date.now() - startTime) / 1000);
        await supabase.from("health_check_logs").insert({
          run_type: body.runType || "batch",
          checked_count: grandChecked,
          deleted_count: grandDeleted,
          error_count: 0,
          duration_seconds: durationSeconds,
        });
        console.log(`Health check complete: checked=${grandChecked}, deleted=${grandDeleted}, duration=${durationSeconds}s`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          checked: totalChecked,
          deleted: totalDeleted,
          totalChecked: grandChecked,
          totalDeleted: grandDeleted,
          iterations: iteration,
          hasMore,
          message: hasMore
            ? `${grandChecked}개 검사 완료, ${grandDeleted}개 삭제. 나머지 자동 처리 중...`
            : `완료: ${grandChecked}개 검사, ${grandDeleted}개 삭제.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid request" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("product-health-check error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
