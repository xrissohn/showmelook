import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CacheEntry {
  id: string;
  cache_key: string;
  image_url: string;
  use_count: number;
  last_used_at: string;
  style_trend_id: string | null;
  product_ids: string[];
}

interface CleanupStats {
  duplicatesRemoved: number;
  lowUsageRemoved: number;
  oldEntriesRemoved: number;
  storageFilesDeleted: number;
  storageBytesFreed: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const stats: CleanupStats = {
      duplicatesRemoved: 0,
      lowUsageRemoved: 0,
      oldEntriesRemoved: 0,
      storageFilesDeleted: 0,
      storageBytesFreed: 0
    };

    console.log('Starting multi-level cache cleanup...');

    // ============================================
    // STEP 1: Remove duplicate image URLs
    // (Multiple cache keys can point to the same image - keep only highest use_count)
    // ============================================
    console.log('Step 1: Checking for duplicate image URLs...');
    
    const { data: allEntries, error: fetchAllError } = await supabase
      .from('style_cache')
      .select('*')
      .order('use_count', { ascending: false });

    if (fetchAllError) {
      console.error('Error fetching cache entries:', fetchAllError);
      throw fetchAllError;
    }

    // Group by image_url and keep the entry with highest use_count
    const imageUrlMap = new Map<string, CacheEntry>();
    const duplicateIds: string[] = [];

    for (const entry of (allEntries as CacheEntry[]) || []) {
      const existingEntry = imageUrlMap.get(entry.image_url);
      
      if (existingEntry) {
        // This is a duplicate - keep the one with higher use_count
        // Since we sorted by use_count desc, the first one is always kept
        duplicateIds.push(entry.id);
      } else {
        imageUrlMap.set(entry.image_url, entry);
      }
    }

    if (duplicateIds.length > 0) {
      console.log(`Found ${duplicateIds.length} duplicate cache entries to merge`);
      
      // Aggregate use_count for duplicates before deleting
      for (const [imageUrl, primaryEntry] of imageUrlMap.entries()) {
        const duplicatesForImage = (allEntries as CacheEntry[])?.filter(
          e => e.image_url === imageUrl && e.id !== primaryEntry.id
        ) || [];
        
        if (duplicatesForImage.length > 0) {
          const totalUseCount = primaryEntry.use_count + 
            duplicatesForImage.reduce((sum, e) => sum + (e.use_count || 0), 0);
          
          // Update primary entry with aggregated use_count
          await supabase
            .from('style_cache')
            .update({ use_count: totalUseCount })
            .eq('id', primaryEntry.id);
        }
      }
      
      // Delete duplicates in batches of 100
      for (let i = 0; i < duplicateIds.length; i += 100) {
        const batch = duplicateIds.slice(i, i + 100);
        await supabase
          .from('style_cache')
          .delete()
          .in('id', batch);
      }
      
      stats.duplicatesRemoved = duplicateIds.length;
      console.log(`Removed ${duplicateIds.length} duplicate entries`);
    }

    // ============================================
    // STEP 2: Remove low-usage cache entries (use_count <= 1, older than 7 days)
    // ============================================
    console.log('Step 2: Removing low-usage cache entries...');
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: lowUsageEntries, error: lowUsageError } = await supabase
      .from('style_cache')
      .select('id, image_url')
      .lte('use_count', 1)
      .lt('last_used_at', sevenDaysAgo.toISOString());

    if (lowUsageError) {
      console.error('Error fetching low-usage entries:', lowUsageError);
    } else if (lowUsageEntries && lowUsageEntries.length > 0) {
      console.log(`Found ${lowUsageEntries.length} low-usage entries to remove`);
      
      // Collect unique image URLs to delete from storage
      const uniqueImageUrls = [...new Set(lowUsageEntries.map(e => e.image_url))];
      
      // Check if these images are still referenced by other cache entries
      const imagesToDelete: string[] = [];
      for (const imageUrl of uniqueImageUrls) {
        const { count } = await supabase
          .from('style_cache')
          .select('*', { count: 'exact', head: true })
          .eq('image_url', imageUrl)
          .not('id', 'in', `(${lowUsageEntries.map(e => `"${e.id}"`).join(',')})`);
        
        if (count === 0) {
          imagesToDelete.push(imageUrl);
        }
      }
      
      // Delete from storage
      if (imagesToDelete.length > 0) {
        const filePaths = imagesToDelete
          .map(url => {
            const match = url.match(/generated-looks\/(.+)$/);
            return match ? match[1] : null;
          })
          .filter(Boolean) as string[];
        
        if (filePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('generated-looks')
            .remove(filePaths);
          
          if (!storageError) {
            stats.storageFilesDeleted += filePaths.length;
            console.log(`Deleted ${filePaths.length} low-usage images from storage`);
          }
        }
      }
      
      // Delete cache entries
      const lowUsageIds = lowUsageEntries.map(e => e.id);
      for (let i = 0; i < lowUsageIds.length; i += 100) {
        const batch = lowUsageIds.slice(i, i + 100);
        await supabase
          .from('style_cache')
          .delete()
          .in('id', batch);
      }
      
      stats.lowUsageRemoved = lowUsageEntries.length;
    }

    // ============================================
    // STEP 3: Remove old cache entries (older than 30 days regardless of use)
    // ============================================
    console.log('Step 3: Removing old cache entries (30+ days)...');
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: oldEntries, error: fetchError } = await supabase
      .from('style_cache')
      .select('id, image_url')
      .lt('last_used_at', thirtyDaysAgo.toISOString());

    if (fetchError) {
      console.error('Error fetching old cache entries:', fetchError);
    } else if (oldEntries && oldEntries.length > 0) {
      console.log(`Found ${oldEntries.length} old cache entries to delete`);

      // Collect unique image URLs
      const uniqueOldImageUrls = [...new Set(oldEntries.map(e => e.image_url))];
      
      // Check which images can be deleted (not referenced elsewhere)
      const oldImagesToDelete: string[] = [];
      for (const imageUrl of uniqueOldImageUrls) {
        const { count } = await supabase
          .from('style_cache')
          .select('*', { count: 'exact', head: true })
          .eq('image_url', imageUrl)
          .gte('last_used_at', thirtyDaysAgo.toISOString());
        
        if (count === 0) {
          oldImagesToDelete.push(imageUrl);
        }
      }
      
      // Delete images from storage
      if (oldImagesToDelete.length > 0) {
        const filePaths = oldImagesToDelete
          .map(url => {
            const match = url.match(/generated-looks\/(.+)$/);
            return match ? match[1] : null;
          })
          .filter(Boolean) as string[];

        if (filePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('generated-looks')
            .remove(filePaths);

          if (!storageError) {
            stats.storageFilesDeleted += filePaths.length;
            console.log(`Deleted ${filePaths.length} old images from storage`);
          }
        }
      }

      // Delete old cache entries
      const oldIds = oldEntries.map(e => e.id);
      for (let i = 0; i < oldIds.length; i += 100) {
        const batch = oldIds.slice(i, i + 100);
        await supabase
          .from('style_cache')
          .delete()
          .in('id', batch);
      }

      stats.oldEntriesRemoved = oldEntries.length;
    }

    // ============================================
    // STEP 4: Clean orphaned storage files (not referenced in cache)
    // ============================================
    console.log('Step 4: Checking for orphaned storage files...');
    
    // Get all cached image URLs
    const { data: currentCache } = await supabase
      .from('style_cache')
      .select('image_url');
    
    const cachedImageUrls = new Set(currentCache?.map(e => e.image_url) || []);
    
    // List storage files (limit to first 1000 for performance)
    const { data: storageFiles } = await supabase.storage
      .from('generated-looks')
      .list('', { limit: 1000 });
    
    if (storageFiles && storageFiles.length > 0) {
      // Check each user folder
      for (const folder of storageFiles) {
        if (folder.id) continue; // Skip if it's a file, not a folder
        
        const { data: userFiles } = await supabase.storage
          .from('generated-looks')
          .list(folder.name, { limit: 500 });
        
        if (userFiles) {
          const orphanedFiles: string[] = [];
          
          for (const file of userFiles) {
            const fullPath = `${folder.name}/${file.name}`;
            const publicUrl = `${supabaseUrl}/storage/v1/object/public/generated-looks/${fullPath}`;
            
            // Check if this image is referenced in cache OR generated_looks table
            if (!cachedImageUrls.has(publicUrl)) {
              // Also check generated_looks table
              const { count: lookCount } = await supabase
                .from('generated_looks')
                .select('*', { count: 'exact', head: true })
                .eq('image_url', publicUrl);
              
              // Only delete if not referenced anywhere and older than 7 days
              const fileDate = new Date(file.created_at || file.updated_at || Date.now());
              const isOld = fileDate < sevenDaysAgo;
              
              if (lookCount === 0 && isOld) {
                orphanedFiles.push(fullPath);
              }
            }
          }
          
          if (orphanedFiles.length > 0) {
            const { error: deleteError } = await supabase.storage
              .from('generated-looks')
              .remove(orphanedFiles);
            
            if (!deleteError) {
              stats.storageFilesDeleted += orphanedFiles.length;
              console.log(`Deleted ${orphanedFiles.length} orphaned files from ${folder.name}/`);
            }
          }
        }
      }
    }

    // ============================================
    // Final Summary
    // ============================================
    console.log('Cache cleanup completed!');
    console.log(`Summary: ${JSON.stringify(stats)}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Multi-level cache cleanup completed',
        stats
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
