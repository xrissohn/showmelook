import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "search_products",
  title: "Search products",
  description:
    "Search the ShowMeLook product catalog by keyword, category, gender, and price range. Returns active in-stock items.",
  inputSchema: {
    query: z.string().optional().describe("Free-text keyword to match against product name, brand, or tags."),
    category: z
      .enum(["상의", "하의", "아우터", "가방", "신발", "액세서리", "원피스", "홈웨어", "수영복"])
      .optional()
      .describe("Standard fashion category."),
    gender: z.enum(["female", "male", "kids", "unisex"]).optional(),
    min_price: z.number().int().nonnegative().optional(),
    max_price: z.number().int().nonnegative().optional(),
    limit: z.number().int().min(1).max(50).optional().describe("Max results, default 10."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, category, gender, min_price, max_price, limit }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    let q = supabase
      .from("products_cache")
      .select("id,name,brand,category,sub_category,gender,price,original_price,color,image_url,product_url,style_tags")
      .eq("is_active", true)
      .eq("is_in_stock", true)
      .limit(limit ?? 10);

    if (category) q = q.eq("category", category);
    if (gender) q = q.eq("gender", gender);
    if (typeof min_price === "number") q = q.gte("price", min_price);
    if (typeof max_price === "number") q = q.lte("price", max_price);
    if (query && query.trim()) {
      const like = `%${query.trim().replace(/[%_]/g, "")}%`;
      q = q.or(`name.ilike.${like},brand.ilike.${like}`);
    }

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { products: data ?? [] },
    };
  },
});
