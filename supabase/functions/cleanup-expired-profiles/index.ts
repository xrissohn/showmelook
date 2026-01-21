/**
 * cleanup-expired-profiles
 * 
 * Premium 다운그레이드 시 초과 프로필에 대한 3일 유예 후 삭제 처리
 * 크론으로 매일 1회 실행
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const now = new Date().toISOString();

    // 1. 만료된 유예 기간 찾기 (grace_period_ends_at < now AND deleted_at IS NULL)
    const { data: expiredGrace, error: graceError } = await supabase
      .from('profile_deletion_grace')
      .select('*')
      .lt('grace_period_ends_at', now)
      .is('deleted_at', null);

    if (graceError) {
      console.error('Failed to fetch expired grace periods:', graceError);
      throw graceError;
    }

    if (!expiredGrace || expiredGrace.length === 0) {
      console.log('No expired grace periods found');
      return new Response(
        JSON.stringify({ success: true, message: 'No profiles to delete', deleted: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalDeleted = 0;

    for (const grace of expiredGrace) {
      const { user_id, profile_ids } = grace;

      // 2. 현재 사용자의 구독 확인
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('max_profiles, plan')
        .eq('user_id', user_id)
        .single();

      const maxProfiles = subscription?.max_profiles || 1;

      // 3. 현재 가족 프로필 수 확인
      const { count: currentCount } = await supabase
        .from('family_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('owner_user_id', user_id);

      // 현재 허용량 - 1 (본인) 가 가족 프로필 허용량
      const allowedFamilyProfiles = Math.max(0, maxProfiles - 1);

      // 4. 초과 프로필 삭제 (profile_ids 중에서 여전히 존재하는 것만)
      if (currentCount && currentCount > allowedFamilyProfiles) {
        const excessCount = currentCount - allowedFamilyProfiles;
        
        // 삭제 대상 프로필 (가장 오래된 것부터)
        const { data: profilesToDelete, error: fetchError } = await supabase
          .from('family_profiles')
          .select('id, full_name')
          .eq('owner_user_id', user_id)
          .in('id', profile_ids)
          .order('created_at', { ascending: true })
          .limit(excessCount);

        if (fetchError) {
          console.error(`Failed to fetch profiles to delete for user ${user_id}:`, fetchError);
          continue;
        }

        if (profilesToDelete && profilesToDelete.length > 0) {
          const idsToDelete = profilesToDelete.map(p => p.id);
          
          const { error: deleteError } = await supabase
            .from('family_profiles')
            .delete()
            .in('id', idsToDelete);

          if (deleteError) {
            console.error(`Failed to delete profiles for user ${user_id}:`, deleteError);
            continue;
          }

          console.log(`Deleted ${idsToDelete.length} profiles for user ${user_id}: ${profilesToDelete.map(p => p.full_name).join(', ')}`);
          totalDeleted += idsToDelete.length;
        }
      }

      // 5. 유예 기간 완료 표시
      await supabase
        .from('profile_deletion_grace')
        .update({ deleted_at: now })
        .eq('id', grace.id);
    }

    console.log(`Cleanup completed. Total profiles deleted: ${totalDeleted}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cleanup completed`,
        processed: expiredGrace.length,
        deleted: totalDeleted 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Cleanup error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
