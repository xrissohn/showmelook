import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 100;
const MAX_ITERATIONS = 50;
const HEAD_TIMEOUT = 5000;
const CONCURRENCY = 10;

interface SingleCheckRequest {
  url: string;
  productId: string;
}

interface BatchCheckRequest {
  batch: true;
}

async function checkUrl(url: string): Promise<{ alive: boolean; status: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEAD_TIMEOUT);

  try {
    // Try HEAD first
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    const dead = [404, 410].includes(res.status) || res.status >= 500;
    return { alive: !dead, status: res.status };
  } catch (headErr) {
    clearTimeout(timeout);

    // Some servers block HEAD, fall back to GET with range
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
      // Consume body to prevent leak
      await res.text();
      const dead = [404, 410].includes(res.status) || res.status >= 500;
      return { alive: !dead, status: res.status };
    } catch {
      clearTimeout(timeout2);
      // Network error / timeout → treat as alive (don't delete on transient errors)
      return { alive: true, status: 0 };
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();

    // === Single-item check (Layer 2) ===
    if (body.url && body.productId) {
      const { url, productId } = body as SingleCheckRequest;
      const result = await checkUrl(url);

      if (!result.alive) {
        // Delete the dead product
        const { error } = await supabase
          .from("products_cache")
          .delete()
          .eq("id", productId);

        if (error) {
          console.error("Delete error:", error);
        }

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

    // === Batch check (Layer 3) ===
    if (body.batch === true) {
      let totalChecked = 0;
      let totalDeleted = 0;
      let iteration = 0;

      while (iteration < MAX_ITERATIONS) {
        iteration++;

        // Get a batch of active products
        const { data: products, error } = await supabase
          .from("products_cache")
          .select("id, product_url")
          .eq("is_active", true)
          .range((iteration - 1) * BATCH_SIZE, iteration * BATCH_SIZE - 1);

        if (error) {
          console.error("Query error:", error);
          break;
        }

        if (!products || products.length === 0) break;

        // Check URLs in parallel with concurrency limit
        const deadIds: string[] = [];

        for (let i = 0; i < products.length; i += CONCURRENCY) {
          const chunk = products.slice(i, i + CONCURRENCY);
          const results = await Promise.allSettled(
            chunk.map(async (p) => {
              const result = await checkUrl(p.product_url);
              return { id: p.id, alive: result.alive, status: result.status };
            })
          );

          for (const r of results) {
            if (r.status === "fulfilled" && !r.value.alive) {
              deadIds.push(r.value.id);
            }
          }
        }

        totalChecked += products.length;

        // Delete dead products
        if (deadIds.length > 0) {
          const { error: delError } = await supabase
            .from("products_cache")
            .delete()
            .in("id", deadIds);

          if (delError) {
            console.error("Batch delete error:", delError);
          } else {
            totalDeleted += deadIds.length;
          }
        }

        console.log(
          `Batch iteration ${iteration}: checked=${products.length}, dead=${deadIds.length}, totalDeleted=${totalDeleted}`
        );

        // If we got fewer than BATCH_SIZE, we've checked everything
        if (products.length < BATCH_SIZE) break;
      }

      return new Response(
        JSON.stringify({
          success: true,
          totalChecked,
          totalDeleted,
          iterations: iteration,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid request. Use {url, productId} or {batch: true}" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("product-health-check error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
