import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Starting scheduled product collection for all merchants...');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get all active merchants
    const { data: merchants, error: merchantError } = await supabase
      .from('merchants')
      .select('id, name')
      .eq('is_active', true);

    if (merchantError) {
      throw new Error(`Failed to fetch merchants: ${merchantError.message}`);
    }

    console.log(`Found ${merchants?.length || 0} active merchants`);

    const results: { merchant_id: string; success: boolean; collected: number; error?: string }[] = [];

    // Collect products from each merchant
    for (const merchant of merchants || []) {
      console.log(`Collecting products from ${merchant.name} (${merchant.id})...`);
      
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/collect-products`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            merchant_id: merchant.id,
            limit: 30, // Collect 30 products per merchant
          }),
        });

        const data = await response.json();
        
        results.push({
          merchant_id: merchant.id,
          success: data.success || false,
          collected: data.collected || 0,
          error: data.error,
        });

        console.log(`${merchant.id}: ${data.success ? 'Success' : 'Failed'} - ${data.collected || 0} products`);
        
        // Small delay between merchants to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        console.error(`Error collecting from ${merchant.id}:`, errorMsg);
        results.push({
          merchant_id: merchant.id,
          success: false,
          collected: 0,
          error: errorMsg,
        });
      }
    }

    const totalCollected = results.reduce((sum, r) => sum + r.collected, 0);
    const successCount = results.filter(r => r.success).length;

    console.log(`CRON collection completed: ${successCount}/${merchants?.length || 0} merchants, ${totalCollected} total products`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Scheduled collection completed',
        summary: {
          total_merchants: merchants?.length || 0,
          successful: successCount,
          total_products: totalCollected,
        },
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('CRON collection error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
