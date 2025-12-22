import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    console.log(`Cleaning up cache entries older than: ${thirtyDaysAgo.toISOString()}`);

    // Get old cache entries to delete their images from storage
    const { data: oldEntries, error: fetchError } = await supabase
      .from('style_cache')
      .select('id, image_url')
      .lt('last_used_at', thirtyDaysAgo.toISOString());

    if (fetchError) {
      console.error('Error fetching old cache entries:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${oldEntries?.length || 0} old cache entries to delete`);

    // Delete images from storage
    if (oldEntries && oldEntries.length > 0) {
      const filePaths = oldEntries
        .map(entry => {
          const url = entry.image_url;
          const match = url.match(/generated-looks\/(.+)$/);
          return match ? match[1] : null;
        })
        .filter(Boolean) as string[];

      if (filePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('generated-looks')
          .remove(filePaths);

        if (storageError) {
          console.error('Error deleting storage files:', storageError);
        } else {
          console.log(`Deleted ${filePaths.length} files from storage`);
        }
      }
    }

    // Delete old cache entries from database
    const { data: deleted, error: deleteError } = await supabase
      .from('style_cache')
      .delete()
      .lt('last_used_at', thirtyDaysAgo.toISOString())
      .select('id');

    if (deleteError) {
      console.error('Error deleting cache entries:', deleteError);
      throw deleteError;
    }

    const deletedCount = deleted?.length || 0;
    console.log(`Successfully deleted ${deletedCount} cache entries`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cleaned up ${deletedCount} old cache entries`,
        deletedCount 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Cache cleanup error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
