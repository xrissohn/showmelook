import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const lookId = url.searchParams.get("lookId");

    if (!lookId) {
      return new Response("Missing lookId", { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the look
    const { data: look, error } = await supabase
      .from("generated_looks")
      .select("*")
      .eq("id", lookId)
      .single();

    if (error || !look) {
      // Return default OG metadata
      return new Response(
        JSON.stringify({
          title: "쇼미룩 - AI 패션 스타일링",
          description: "AI가 추천하는 나만의 스타일을 확인해보세요!",
          image: "https://showmelook.com/og-image.png?v=20260207",
          url: `https://showmelook.com/look/${lookId}`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get signed URL for the image
    let imageUrl = "https://showmelook.com/og-image.png?v=20260207";
    if (look.image_url && look.image_url.includes("generated-looks/")) {
      const path = look.image_url.split("generated-looks/").pop();
      if (path) {
        const { data: signedData } = await supabase.storage
          .from("generated-looks")
          .createSignedUrl(path, 86400); // 24 hours
        if (signedData?.signedUrl) {
          imageUrl = signedData.signedUrl;
        }
      }
    }

    // Generate description from prompt and tags
    let description = "AI가 추천하는 나만의 스타일을 확인해보세요!";
    if (look.prompt_used) {
      description = look.prompt_used.slice(0, 100);
      if (look.prompt_used.length > 100) {
        description += "...";
      }
    }

    // Add tags to description
    if (look.tags && look.tags.length > 0) {
      const tagStr = look.tags.slice(0, 3).map((t: string) => `#${t}`).join(" ");
      description += ` ${tagStr}`;
    }

    const metadata = {
      title: "쇼미룩 AI 스타일 추천",
      description,
      image: imageUrl,
      url: `https://showmelook.com/look/${lookId}`,
    };

    return new Response(JSON.stringify(metadata), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        title: "쇼미룩 - AI 패션 스타일링",
        description: "AI가 추천하는 나만의 스타일을 확인해보세요!",
        image: "https://showmelook.com/og-image.png?v=20260207",
        url: "https://showmelook.com",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
