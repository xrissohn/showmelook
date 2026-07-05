import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "get_product",
  title: "Get product",
  description:
    "Fetch full details for a ShowMeLook product by ID, including brand, price, image, style tags, and the purchase URL.",
  inputSchema: {
    product_id: z.string().uuid().describe("products_cache.id"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ product_id }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await supabase
      .from("products_cache")
      .select(
        "id,name,brand,category,sub_category,gender,price,original_price,color,image_url,product_url,style_tags,sizes,dna_text,is_active,is_in_stock",
      )
      .eq("id", product_id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Product not found." }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { product: data },
    };
  },
});
