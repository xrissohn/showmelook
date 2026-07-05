import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_public_looks",
  title: "List public looks",
  description:
    "List recent public AI-generated looks from the ShowMeLook community gallery, sorted by most recent by default.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max looks to return, default 10."),
    sort: z.enum(["recent", "popular"]).optional().describe("Sort order (default recent)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, sort }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    let q = supabase
      .from("generated_looks_public")
      .select("id,image_url,caption,tags,like_count,view_count,created_at,product_ids")
      .limit(limit ?? 10);
    q = sort === "popular" ? q.order("like_count", { ascending: false }) : q.order("created_at", { ascending: false });

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { looks: data ?? [] },
    };
  },
});
